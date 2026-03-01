import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { Clicker, ClickerOptions, Metronome, MetronomeOptions, SoundPack } from '@/core';

export type Nullable<T> = T | null | undefined;
export type NumberLike = number | string;
export type NumberInput = NumberLike | null | undefined;
export type BooleanInput = boolean | number | string | null | undefined;

export type StateSetter<T> = Dispatch<SetStateAction<T>>;
export type TransformFn<T> = (value: unknown) => T;
export type UseSettingReturn<T> = [T, StateSetter<T>];

export interface StorageLike {
  getItem(key: string): unknown;
  setItem(key: string, value: unknown): unknown;
}

export interface WithChildrenProps {
  children?: ReactNode;
}

export interface ClickerHookOptions {
  audioContext?: any;
  volume?: number;
  sounds?: SoundPack;
}

export type SoundPacks = Record<string, SoundPack>;

export interface TapBPMResult {
  bpm: number;
  handleTap: () => void;
}

export interface GtagPayload {
  event_category: string;
  event_label: string | number | boolean;
  value: number | string | boolean | null;
}

export type GtagFn = (command: 'event', action: string, payload: GtagPayload) => void;

export interface TrackingWindow extends Window {
  gtag?: GtagFn;
  _sentEvents?: Record<string, boolean>;
}

export type MetronomeInstance = Metronome;
export type ClickerInstance = Clicker;
export type MetronomeSettings = MetronomeOptions;

export interface ApiConfig {
  bpm: number;
  beats: number;
  subDivs: number;
  playSubDivs: boolean;
  swing: number;
  soundPack: string;
  volume: number;
}

export interface ApiSchemaJson {
  config: unknown;
  configPatch: unknown;
}

export type ValidationResult =
  | { ok: true; value: ApiConfig }
  | { ok: false; error: string };

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
  getConfig(): ApiConfig;
  setConfig(partial: Partial<ApiConfig>): ApiConfig;
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
