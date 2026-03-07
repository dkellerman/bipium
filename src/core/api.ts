import qs from 'query-string';
import { z } from 'zod';
import {
  DRUM_LOOP_LANES,
  type Click,
  type DrumLoopPattern,
  type DrumLoopTiming,
  type FinalSoundSpec,
  type SoundPack,
  type SoundSpec,
} from './types';

export const API_VERSION = 1;
export const BIPIUM_API_VERSION = API_VERSION;

export const API_DISCOVERY = {
  ui: '/api',
  markdown: '/api.md',
  llms: '/llms.txt',
  agents: '/agents.txt',
} as const;
export const BIPIUM_API_DISCOVERY = API_DISCOVERY;

export type ApiSoundSlot = 'bar' | 'beat' | 'half' | 'subDiv' | 'user';
export type ApiSoundUrls = Partial<Record<ApiSoundSlot, string>>;

export interface ApiConfig {
  bpm: number;
  beats: number;
  subDivs: number;
  playSubDivs: boolean;
  swing: number;
  soundPack: string;
  volume: number;
  loopMode: boolean;
  loopRepeats: number;
  soundUrls: ApiSoundUrls;
  loopPattern: DrumLoopPattern;
}

export interface ApiSchemaJson {
  config: unknown;
  configPatch: unknown;
}

export type ValidationResult = { ok: true; value: ApiConfig } | { ok: false; error: string };

export interface RuntimeApi {
  version: number;
  entrypoint: 'window.bpm';
  discovery: {
    ui: string;
    markdown: string;
    llms: string;
    agents: string;
  };
  defaults: ApiConfig;
  schemas: {
    config: unknown;
    configPatch: unknown;
  };
  schemaJson: ApiSchemaJson;
  getSchemaJson(): ApiSchemaJson;
  start(
    bpm?: number,
    beats?: number,
    subDivs?: number,
    swing?: number,
    soundPack?: string,
    volume?: number,
  ): ApiConfig;
  stop(): void;
  toggle(): boolean;
  isStarted(): boolean;
  isLoopMode(): boolean;
  getLoopRepeats(): number;
  getSoundUrls(): ApiSoundUrls;
  getConfig(): ApiConfig;
  setConfig(partial: Partial<ApiConfig>): ApiConfig;
  getLoopPattern(): DrumLoopPattern;
  setLoopMode(enabled: boolean): ApiConfig;
  setLoopRepeats(repeats: number): ApiConfig;
  setSoundUrls(soundUrls: ApiSoundUrls): ApiConfig;
  setLoopPattern(pattern: DrumLoopPattern): ApiConfig;
  resetLoopPattern(): ApiConfig;
  validateConfig(input: unknown): ValidationResult;
  fromQuery(query?: string): ApiConfig;
  toQuery(config?: Partial<ApiConfig>): string;
  applyQuery(query?: string): ApiConfig;
  tap(): void;
  getSoundPacks(): string[];
  now(): number;
}

export type BipiumApiConfig = ApiConfig;
export type BipiumApiSchemaJson = ApiSchemaJson;
export type BipiumValidationResult = ValidationResult;
export type BipiumRuntimeApi = RuntimeApi;

function createLane(stepCount: number) {
  return Array.from({ length: stepCount }, () => false);
}

function getStepCount({ beats, subDivs }: DrumLoopTiming) {
  return Math.max(1, beats * subDivs);
}

export function createEmptyDrumLoopPattern(timing: DrumLoopTiming): DrumLoopPattern {
  const stepCount = getStepCount(timing);
  return {
    kick: createLane(stepCount),
    hat: createLane(stepCount),
    snare: createLane(stepCount),
  };
}

function getStepIndex({ beat, subDiv, subDivs }: Pick<Click, 'beat' | 'subDiv' | 'subDivs'>) {
  return (beat - 1) * subDivs + (subDiv - 1);
}

function isBeatAlignedStep(stepIndex: number, subDivs: number) {
  return stepIndex % subDivs === 0;
}

function getStepPositions({ beats, subDivs, swing }: DrumLoopTiming) {
  const totalSteps = getStepCount({ beats, subDivs, swing });
  const base = 1 / totalSteps;
  const swingOffset = base * (swing / 100);

  return Array.from({ length: totalSteps }, (_, index) => {
    const position = index * base;
    return index % 2 === 1 ? position + swingOffset : position;
  });
}

function nearestIndex(target: number, positions: number[]) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  positions.forEach((position, index) => {
    const distance = Math.abs(position - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

export function seedDrumLoopPattern(timing: DrumLoopTiming): DrumLoopPattern {
  const pattern = createEmptyDrumLoopPattern(timing);
  const midpointBeat = Math.ceil(timing.beats / 2) + 1;

  for (let stepIndex = 0; stepIndex < getStepCount(timing); stepIndex += 1) {
    const beat = Math.floor(stepIndex / timing.subDivs) + 1;
    const subDiv = (stepIndex % timing.subDivs) + 1;

    pattern.hat[stepIndex] = true;

    if (beat === 1 && subDiv === 1) {
      pattern.kick[stepIndex] = true;
    }

    if (beat === midpointBeat && subDiv === 1) {
      pattern.snare[stepIndex] = true;
    }
  }

  return pattern;
}

export function remapDrumLoopPattern(
  pattern: DrumLoopPattern,
  fromTiming: DrumLoopTiming,
  toTiming: DrumLoopTiming,
): DrumLoopPattern {
  const next = createEmptyDrumLoopPattern(toTiming);
  const fromPositions = getStepPositions(fromTiming);
  const toPositions = getStepPositions(toTiming);

  DRUM_LOOP_LANES.forEach(lane => {
    pattern[lane].forEach((active, index) => {
      if (!active) return;
      const targetIndex = nearestIndex(fromPositions[index] ?? 0, toPositions);
      next[lane][targetIndex] = true;
    });
  });

  return next;
}

function toFinalSoundSpec(soundSpec?: SoundSpec): FinalSoundSpec | null {
  if (!soundSpec) return null;
  if (Array.isArray(soundSpec)) return soundSpec as FinalSoundSpec;
  return [soundSpec, 1.0, 0.05];
}

export function resolveDrumLoopSounds(
  click: Pick<Click, 'beat' | 'subDiv' | 'subDivs'>,
  pattern: DrumLoopPattern,
  sounds: SoundPack,
): FinalSoundSpec[] {
  const stepIndex = getStepIndex(click);
  const resolved: FinalSoundSpec[] = [];

  if (pattern.kick[stepIndex]) {
    const kickSound = toFinalSoundSpec(sounds.bar || sounds.beat);
    if (kickSound) resolved.push(kickSound);
  }

  if (pattern.snare[stepIndex]) {
    const snareSound = toFinalSoundSpec(sounds.half || sounds.beat);
    if (snareSound) resolved.push(snareSound);
  }

  if (pattern.hat[stepIndex]) {
    const isBeat = isBeatAlignedStep(stepIndex, click.subDivs);
    const hatSound = toFinalSoundSpec(
      isBeat ? sounds.beat || sounds.subDiv : sounds.subDiv || sounds.beat,
    );
    if (hatSound) resolved.push(hatSound);
  }

  return resolved;
}

function getLoopTiming(config: Pick<ApiConfig, 'beats' | 'subDivs' | 'playSubDivs' | 'swing'>) {
  return {
    beats: config.beats,
    subDivs: config.playSubDivs ? config.subDivs : 1,
    swing: config.playSubDivs && config.subDivs % 2 === 0 ? config.swing : 0,
  } satisfies DrumLoopTiming;
}

function cloneLoopPattern(pattern: DrumLoopPattern): DrumLoopPattern {
  return {
    kick: [...pattern.kick],
    hat: [...pattern.hat],
    snare: [...pattern.snare],
  };
}

function cloneApiConfig(config: ApiConfig): ApiConfig {
  return {
    ...config,
    soundUrls: { ...config.soundUrls },
    loopPattern: cloneLoopPattern(config.loopPattern),
  };
}

function createDefaultLoopPattern() {
  return seedDrumLoopPattern({ beats: 4, subDivs: 1, swing: 0 });
}

export const API_DEFAULT_CONFIG: ApiConfig = {
  bpm: 80,
  beats: 4,
  subDivs: 1,
  playSubDivs: true,
  swing: 0,
  soundPack: 'drumkit',
  volume: 35,
  loopMode: false,
  loopRepeats: 0,
  soundUrls: {},
  loopPattern: createDefaultLoopPattern(),
};
export const BIPIUM_API_DEFAULT_CONFIG = API_DEFAULT_CONFIG;

function firstValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseBooleanLike(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (['true', 't', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', 'f', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return undefined;
}

function parseNumberLike(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numberFieldSchema(fieldName: keyof ApiConfig, min: number, max: number, integer = false) {
  return z
    .preprocess(value => parseNumberLike(value) ?? value, z.number())
    .refine(value => (integer ? Number.isInteger(value) : true), {
      message: `${fieldName} must be an integer.`,
    })
    .refine(value => value >= min && value <= max, {
      message: `${fieldName} must be between ${min} and ${max}.`,
    });
}

function createSoundPackSchema(knownSoundPacks: Set<string>) {
  return z
    .string()
    .min(1, 'soundPack must be a non-empty string.')
    .refine(value => knownSoundPacks.has(value), {
      message: `soundPack must be one of: ${Array.from(knownSoundPacks).join(', ')}.`,
    });
}

function createPlaySubDivsSchema() {
  return z.preprocess(value => parseBooleanLike(value) ?? value, z.boolean());
}

function createLoopModeSchema() {
  return z.preprocess(value => parseBooleanLike(value) ?? value, z.boolean());
}

function createLoopRepeatsSchema() {
  return numberFieldSchema('loopRepeats', 0, 128, true);
}

function createLoopPatternSchema() {
  return z
    .object({
      kick: z.array(z.boolean()),
      hat: z.array(z.boolean()),
      snare: z.array(z.boolean()),
    })
    .strict();
}

function createSoundUrlsSchema() {
  return z
    .object({
      bar: z.string().min(1).optional(),
      beat: z.string().min(1).optional(),
      half: z.string().min(1).optional(),
      subDiv: z.string().min(1).optional(),
      user: z.string().min(1).optional(),
    })
    .strict();
}

const SOUND_URL_QUERY_KEYS = {
  bar: 'soundBarUrl',
  beat: 'soundBeatUrl',
  half: 'soundHalfUrl',
  subDiv: 'soundSubDivUrl',
  user: 'soundUserUrl',
} satisfies Record<ApiSoundSlot, string>;

function validateLoopPatternLength(config: Pick<ApiConfig, 'beats' | 'subDivs' | 'playSubDivs'>) {
  return config.beats * (config.playSubDivs ? config.subDivs : 1);
}

function encodeLoopLane(values: boolean[]) {
  return values.map(active => (active ? '1' : '0')).join('');
}

function decodeLoopLane(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return [];
  if (!/^[01]+$/.test(normalized)) return null;
  return normalized.split('').map(char => char === '1');
}

function parseSoundUrlsFromQuery(parsed: ReturnType<typeof qs.parse>) {
  const soundUrls: ApiSoundUrls = {};

  (Object.keys(SOUND_URL_QUERY_KEYS) as ApiSoundSlot[]).forEach(slot => {
    const key = SOUND_URL_QUERY_KEYS[slot];
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) return;
    const value = firstValue(parsed[key]);
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`Invalid ${key} value.`);
    }
    soundUrls[slot] = value;
  });

  return soundUrls;
}

function parseLoopPatternFromQuery(
  parsed: ReturnType<typeof qs.parse>,
  config: ApiConfig,
): DrumLoopPattern | undefined {
  const loopLaneQueryKeys = {
    kick: 'loopKick',
    hat: 'loopHat',
    snare: 'loopSnare',
  } satisfies Record<keyof DrumLoopPattern, string>;

  const laneValues = DRUM_LOOP_LANES.map(lane => {
    const key = loopLaneQueryKeys[lane];
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) return null;
    return {
      lane,
      value: decodeLoopLane(firstValue(parsed[key])),
    };
  }).filter(Boolean) as Array<{ lane: keyof DrumLoopPattern; value: boolean[] | null }>;

  if (!laneValues.length) return undefined;

  const pattern = cloneLoopPattern(config.loopPattern);
  laneValues.forEach(({ lane, value }) => {
    if (!value) {
      throw new Error(`Invalid ${loopLaneQueryKeys[lane]} bitstring.`);
    }
    pattern[lane] = value;
  });

  return pattern;
}

function formatZodError(error: z.ZodError) {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return 'Invalid config.';
  }
  if (!firstIssue.path.length) {
    return firstIssue.message;
  }
  return `${firstIssue.path.join('.')}: ${firstIssue.message}`;
}

export function createSchemas(knownSoundPacks: Set<string>) {
  const configBase = z
    .object({
      bpm: numberFieldSchema('bpm', 20, 320),
      beats: numberFieldSchema('beats', 1, 12, true),
      subDivs: numberFieldSchema('subDivs', 1, 8, true),
      playSubDivs: createPlaySubDivsSchema(),
      swing: numberFieldSchema('swing', 0, 100),
      soundPack: createSoundPackSchema(knownSoundPacks),
      volume: numberFieldSchema('volume', 0, 100),
      soundUrls: createSoundUrlsSchema(),
      loopMode: createLoopModeSchema(),
      loopRepeats: createLoopRepeatsSchema(),
      loopPattern: createLoopPatternSchema(),
    })
    .strict();

  const config = configBase.superRefine((value, ctx) => {
    const stepCount = validateLoopPatternLength(value as ApiConfig);
    DRUM_LOOP_LANES.forEach(lane => {
      if (value.loopPattern[lane].length !== stepCount) {
        ctx.addIssue({
          code: 'custom',
          path: ['loopPattern', lane],
          message: `loopPattern.${lane} must contain ${stepCount} steps.`,
        });
      }
    });
  });

  const configPatch = configBase.partial().strict();

  const schemaJson: ApiSchemaJson = {
    config: z.toJSONSchema(config),
    configPatch: z.toJSONSchema(configPatch),
  };

  return {
    config,
    configPatch,
    schemaJson,
  };
}
export const createBipiumSchemas = createSchemas;

export function mergeConfig(
  base: ApiConfig,
  patchInput: unknown,
  schemas: ReturnType<typeof createSchemas>,
): ApiConfig {
  const patchResult = schemas.configPatch.safeParse(patchInput);
  if (!patchResult.success) {
    throw new Error(formatZodError(patchResult.error));
  }

  const merged = {
    ...base,
    ...patchResult.data,
    soundUrls: patchResult.data.soundUrls
      ? { ...base.soundUrls, ...patchResult.data.soundUrls }
      : { ...base.soundUrls },
    loopPattern: patchResult.data.loopPattern
      ? cloneLoopPattern(patchResult.data.loopPattern)
      : cloneLoopPattern(base.loopPattern),
  };

  const baseTiming = getLoopTiming(base);
  const mergedTiming = getLoopTiming(merged);
  const timingChanged =
    baseTiming.beats !== mergedTiming.beats ||
    baseTiming.subDivs !== mergedTiming.subDivs ||
    baseTiming.swing !== mergedTiming.swing;

  if (timingChanged && !Object.prototype.hasOwnProperty.call(patchResult.data, 'loopPattern')) {
    merged.loopPattern = remapDrumLoopPattern(base.loopPattern, baseTiming, mergedTiming);
  }

  const mergedResult = schemas.config.safeParse(merged);
  if (!mergedResult.success) {
    throw new Error(formatZodError(mergedResult.error));
  }

  return cloneApiConfig(mergedResult.data as ApiConfig);
}

export function validateConfig(
  base: ApiConfig,
  input: unknown,
  schemas: ReturnType<typeof createSchemas>,
): ValidationResult {
  try {
    return {
      ok: true,
      value: mergeConfig(base, input, schemas),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid config.',
    };
  }
}

export function fromQuery(
  base: ApiConfig,
  query: string | undefined,
  schemas: ReturnType<typeof createSchemas>,
): ApiConfig {
  const raw = typeof query === 'string' ? query : window.location.search;
  const queryString = raw.includes('://') ? new URL(raw).search : raw;
  const parsed = qs.parse(queryString.startsWith('?') ? queryString : `?${queryString}`);

  const patch: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(parsed, 'bpm')) patch.bpm = firstValue(parsed.bpm);
  if (Object.prototype.hasOwnProperty.call(parsed, 'beats')) patch.beats = firstValue(parsed.beats);
  if (Object.prototype.hasOwnProperty.call(parsed, 'subDivs')) {
    patch.subDivs = firstValue(parsed.subDivs);
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'playSubDivs')) {
    patch.playSubDivs = firstValue(parsed.playSubDivs);
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'swing')) patch.swing = firstValue(parsed.swing);
  if (Object.prototype.hasOwnProperty.call(parsed, 'soundPack')) {
    patch.soundPack = firstValue(parsed.soundPack);
  }
  const soundUrls = parseSoundUrlsFromQuery(parsed);
  if (Object.keys(soundUrls).length > 0) {
    patch.soundUrls = soundUrls;
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'volume')) {
    patch.volume = firstValue(parsed.volume);
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'loopMode')) {
    patch.loopMode = firstValue(parsed.loopMode);
  }
  if (Object.prototype.hasOwnProperty.call(parsed, 'loopRepeats')) {
    patch.loopRepeats = firstValue(parsed.loopRepeats);
  }

  const partialConfig = mergeConfig(base, patch, schemas);
  const loopPattern = parseLoopPatternFromQuery(parsed, partialConfig);
  if (loopPattern) {
    patch.loopPattern = loopPattern;
  }

  return mergeConfig(base, patch, schemas);
}

export function toQuery(config: ApiConfig): string {
  const params: Record<string, string | number | boolean> = {
    bpm: Number(config.bpm),
    beats: Number(config.beats),
    playSubDivs: Boolean(config.playSubDivs),
    volume: Number(config.volume),
  };

  if (config.playSubDivs) {
    params.subDivs = Number(config.subDivs);
    params.swing = Number(config.swing);
  }

  if (config.soundPack !== 'defaults') {
    params.soundPack = config.soundPack;
  }

  (Object.keys(SOUND_URL_QUERY_KEYS) as ApiSoundSlot[]).forEach(slot => {
    const value = config.soundUrls[slot];
    if (value) {
      params[SOUND_URL_QUERY_KEYS[slot]] = value;
    }
  });

  if (config.loopMode) {
    params.loopMode = true;
    params.loopKick = encodeLoopLane(config.loopPattern.kick);
    params.loopHat = encodeLoopLane(config.loopPattern.hat);
    params.loopSnare = encodeLoopLane(config.loopPattern.snare);
  }

  if (config.loopRepeats > 0) {
    params.loopRepeats = Number(config.loopRepeats);
  }

  const serialized = qs.stringify(params);
  return serialized ? `?${serialized}` : '';
}

export interface RuntimeControls {
  getConfig: () => ApiConfig;
  applyConfig: (config: ApiConfig) => void;
  startPlayback: () => void;
  stopPlayback: () => void;
  togglePlayback: () => boolean;
  isPlaying: () => boolean;
  tap: () => void;
  now: () => number;
  getSoundPacks: () => string[];
}
export type BipiumRuntimeControls = RuntimeControls;

export function createRuntimeApi(controls: RuntimeControls): RuntimeApi {
  const schemas = createSchemas(new Set(controls.getSoundPacks()));

  const mergeWithCurrent = (input: unknown) => mergeConfig(controls.getConfig(), input, schemas);

  return {
    version: API_VERSION,
    entrypoint: 'window.bpm',
    discovery: API_DISCOVERY,
    defaults: cloneApiConfig(API_DEFAULT_CONFIG),
    schemas: {
      config: schemas.config,
      configPatch: schemas.configPatch,
    },
    schemaJson: schemas.schemaJson,
    getSchemaJson() {
      return schemas.schemaJson;
    },
    start(bpm, beats, subDivs, swing, soundPack, volume) {
      const patch: Partial<ApiConfig> = {};

      if (bpm !== undefined) patch.bpm = bpm;
      if (beats !== undefined) patch.beats = beats;
      if (subDivs !== undefined) {
        patch.subDivs = subDivs;
        patch.playSubDivs = true;
      }
      if (swing !== undefined) {
        patch.swing = swing;
        patch.playSubDivs = true;
      }
      if (soundPack !== undefined) patch.soundPack = soundPack;
      if (volume !== undefined) patch.volume = volume;

      if (Object.keys(patch).length > 0) {
        const next = mergeWithCurrent(patch);
        controls.applyConfig(next);
      }

      controls.startPlayback();
      return cloneApiConfig(controls.getConfig());
    },
    stop() {
      controls.stopPlayback();
    },
    toggle() {
      return controls.togglePlayback();
    },
    isStarted() {
      return controls.isPlaying();
    },
    isLoopMode() {
      return controls.getConfig().loopMode;
    },
    getLoopRepeats() {
      return controls.getConfig().loopRepeats;
    },
    getSoundUrls() {
      return { ...controls.getConfig().soundUrls };
    },
    getConfig() {
      return cloneApiConfig(controls.getConfig());
    },
    setConfig(partial) {
      const next = mergeWithCurrent(partial);
      controls.applyConfig(next);
      return cloneApiConfig(controls.getConfig());
    },
    getLoopPattern() {
      return cloneLoopPattern(controls.getConfig().loopPattern);
    },
    setLoopMode(enabled) {
      const next = mergeWithCurrent({ loopMode: enabled });
      controls.applyConfig(next);
      return cloneApiConfig(controls.getConfig());
    },
    setLoopRepeats(repeats) {
      const next = mergeWithCurrent({ loopRepeats: repeats });
      controls.applyConfig(next);
      return cloneApiConfig(controls.getConfig());
    },
    setSoundUrls(soundUrls) {
      const next = mergeWithCurrent({ soundUrls });
      controls.applyConfig(next);
      return cloneApiConfig(controls.getConfig());
    },
    setLoopPattern(pattern) {
      const next = mergeWithCurrent({ loopPattern: pattern });
      controls.applyConfig(next);
      return cloneApiConfig(controls.getConfig());
    },
    resetLoopPattern() {
      const current = controls.getConfig();
      const next = mergeWithCurrent({
        loopPattern: seedDrumLoopPattern(getLoopTiming(current)),
      });
      controls.applyConfig(next);
      return cloneApiConfig(controls.getConfig());
    },
    validateConfig(input) {
      const result = validateConfig(controls.getConfig(), input, schemas);
      return result.ok ? { ok: true, value: cloneApiConfig(result.value) } : result;
    },
    fromQuery(query) {
      return fromQuery(controls.getConfig(), query, schemas);
    },
    toQuery(config) {
      const next = config ? mergeWithCurrent(config) : controls.getConfig();
      return toQuery(next);
    },
    applyQuery(query) {
      const next = fromQuery(controls.getConfig(), query, schemas);
      controls.applyConfig(next);
      return cloneApiConfig(controls.getConfig());
    },
    tap() {
      controls.tap();
    },
    getSoundPacks() {
      return controls.getSoundPacks();
    },
    now() {
      return controls.now();
    },
  };
}
export const createBipiumRuntimeApi = createRuntimeApi;

type RuntimeNamespaceTarget = {
  bpm?: Record<string, unknown>;
};

export function installWindowBpm(
  runtime: RuntimeApi,
  target: RuntimeNamespaceTarget = globalThis as RuntimeNamespaceTarget,
) {
  const previous = target.bpm;
  const next =
    previous && typeof previous === 'object'
      ? { ...previous, ...runtime }
      : ({ ...runtime } as Record<string, unknown>);

  target.bpm = next;

  return () => {
    if (target.bpm !== next) return;
    if (previous && typeof previous === 'object') {
      target.bpm = previous;
      return;
    }
    delete target.bpm;
  };
}
