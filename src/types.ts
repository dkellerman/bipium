import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { Clicker, ClickerOptions, Metronome, MetronomeOptions, SoundPack } from './core';

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

export type RangeValueChange = (value: number) => void;

export interface RangeProps {
  ticks?: Array<number | string>;
  labelRotation?: number;
  disabled?: boolean;
  min: NumberLike;
  max: NumberLike;
  step: NumberLike;
  value: NumberLike;
  onChange?: RangeValueChange;
  onDrag?: RangeValueChange;
}

export interface DefaultVisualizerProps {
  id?: string;
  metronome: Metronome;
  width?: number;
  height?: number;
  showGrid?: boolean;
  showNow?: boolean;
  showCount?: boolean;
  showClicks?: boolean;
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
