import qs from 'query-string';
import { z } from 'zod';
import type {
  ApiConfig,
  ApiSchemaJson,
  RuntimeApi,
  ValidationResult,
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

export const API_DEFAULT_CONFIG: ApiConfig = {
  bpm: 80,
  beats: 4,
  subDivs: 1,
  playSubDivs: true,
  swing: 0,
  soundPack: 'drumkit',
  volume: 35,
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

function numberFieldSchema(
  fieldName: keyof ApiConfig,
  min: number,
  max: number,
  integer = false,
) {
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
  const config = z
    .object({
      bpm: numberFieldSchema('bpm', 20, 320),
      beats: numberFieldSchema('beats', 1, 12, true),
      subDivs: numberFieldSchema('subDivs', 1, 8, true),
      playSubDivs: createPlaySubDivsSchema(),
      swing: numberFieldSchema('swing', 0, 100),
      soundPack: createSoundPackSchema(knownSoundPacks),
      volume: numberFieldSchema('volume', 0, 100),
    })
    .strict();

  const configPatch = config.partial().strict();

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

  const merged = { ...base, ...patchResult.data };
  const mergedResult = schemas.config.safeParse(merged);
  if (!mergedResult.success) {
    throw new Error(formatZodError(mergedResult.error));
  }

  return mergedResult.data as ApiConfig;
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
  if (Object.prototype.hasOwnProperty.call(parsed, 'volume')) {
    patch.volume = firstValue(parsed.volume);
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
    defaults: { ...API_DEFAULT_CONFIG },
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
      return controls.getConfig();
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
    getConfig() {
      return { ...controls.getConfig() };
    },
    setConfig(partial) {
      const next = mergeWithCurrent(partial);
      controls.applyConfig(next);
      return controls.getConfig();
    },
    validateConfig(input) {
      return validateConfig(controls.getConfig(), input, schemas);
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
      return controls.getConfig();
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
