import { z } from 'zod';
import {
  type Click,
  type DrumLoopPattern,
  type DrumLoopTiming,
  type FinalSoundSpec,
  type SoundPack,
} from './types';
export declare const API_VERSION = 1;
export declare const BIPIUM_API_VERSION = 1;
export declare const API_DISCOVERY: {
  readonly ui: '/api';
  readonly markdown: '/api.md';
  readonly llms: '/llms.txt';
  readonly agents: '/agents.txt';
};
export declare const BIPIUM_API_DISCOVERY: {
  readonly ui: '/api';
  readonly markdown: '/api.md';
  readonly llms: '/llms.txt';
  readonly agents: '/agents.txt';
};
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
export type ValidationResult =
  | {
      ok: true;
      value: ApiConfig;
    }
  | {
      ok: false;
      error: string;
    };
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
export declare function createEmptyDrumLoopPattern(timing: DrumLoopTiming): DrumLoopPattern;
export declare function seedDrumLoopPattern(timing: DrumLoopTiming): DrumLoopPattern;
export declare function remapDrumLoopPattern(
  pattern: DrumLoopPattern,
  fromTiming: DrumLoopTiming,
  toTiming: DrumLoopTiming,
): DrumLoopPattern;
export declare function resolveDrumLoopSounds(
  click: Pick<Click, 'beat' | 'subDiv' | 'subDivs'>,
  pattern: DrumLoopPattern,
  sounds: SoundPack,
): FinalSoundSpec[];
export declare const API_DEFAULT_CONFIG: ApiConfig;
export declare const BIPIUM_API_DEFAULT_CONFIG: ApiConfig;
export declare function createSchemas(knownSoundPacks: Set<string>): {
  config: z.ZodObject<
    {
      bpm: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>;
      beats: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>;
      subDivs: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>;
      playSubDivs: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodBoolean>;
      swing: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>;
      soundPack: z.ZodString;
      volume: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>;
      soundUrls: z.ZodObject<
        {
          bar: z.ZodOptional<z.ZodString>;
          beat: z.ZodOptional<z.ZodString>;
          half: z.ZodOptional<z.ZodString>;
          subDiv: z.ZodOptional<z.ZodString>;
          user: z.ZodOptional<z.ZodString>;
        },
        z.core.$strict
      >;
      loopMode: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodBoolean>;
      loopRepeats: z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>;
      loopPattern: z.ZodObject<
        {
          kick: z.ZodArray<z.ZodBoolean>;
          hat: z.ZodArray<z.ZodBoolean>;
          snare: z.ZodArray<z.ZodBoolean>;
        },
        z.core.$strict
      >;
    },
    z.core.$strict
  >;
  configPatch: z.ZodObject<
    {
      bpm: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>>;
      beats: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>>;
      subDivs: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>>;
      playSubDivs: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodBoolean>>;
      swing: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>>;
      soundPack: z.ZodOptional<z.ZodString>;
      volume: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>>;
      soundUrls: z.ZodOptional<
        z.ZodObject<
          {
            bar: z.ZodOptional<z.ZodString>;
            beat: z.ZodOptional<z.ZodString>;
            half: z.ZodOptional<z.ZodString>;
            subDiv: z.ZodOptional<z.ZodString>;
            user: z.ZodOptional<z.ZodString>;
          },
          z.core.$strict
        >
      >;
      loopMode: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodBoolean>>;
      loopRepeats: z.ZodOptional<z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodNumber>>;
      loopPattern: z.ZodOptional<
        z.ZodObject<
          {
            kick: z.ZodArray<z.ZodBoolean>;
            hat: z.ZodArray<z.ZodBoolean>;
            snare: z.ZodArray<z.ZodBoolean>;
          },
          z.core.$strict
        >
      >;
    },
    z.core.$strict
  >;
  schemaJson: ApiSchemaJson;
};
export declare const createBipiumSchemas: typeof createSchemas;
export declare function mergeConfig(
  base: ApiConfig,
  patchInput: unknown,
  schemas: ReturnType<typeof createSchemas>,
): ApiConfig;
export declare function validateConfig(
  base: ApiConfig,
  input: unknown,
  schemas: ReturnType<typeof createSchemas>,
): ValidationResult;
export declare function fromQuery(
  base: ApiConfig,
  query: string | undefined,
  schemas: ReturnType<typeof createSchemas>,
): ApiConfig;
export declare function toQuery(config: ApiConfig): string;
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
export declare function createRuntimeApi(controls: RuntimeControls): RuntimeApi;
export declare const createBipiumRuntimeApi: typeof createRuntimeApi;
type RuntimeNamespaceTarget = {
  bpm?: Record<string, unknown>;
};
export declare function installWindowBpm(
  runtime: RuntimeApi,
  target?: RuntimeNamespaceTarget,
): () => void;
export {};
//# sourceMappingURL=api.d.ts.map
