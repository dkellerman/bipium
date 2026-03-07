import { Metronome } from './Metronome';
import type { MetronomeOptions } from './Metronome';
import type { ClickerOptions } from './Clicker';
export declare function createMetronome(
  mOpts: Partial<MetronomeOptions>,
  clickerOpts?: Omit<Partial<ClickerOptions>, 'audioContext'>,
  audioContext?: AudioContext,
): Metronome;
export { Metronome } from './Metronome';
export { Clicker, DEFAULT_SOUNDS } from './Clicker';
export { Visualizer } from './Visualizer';
export type { MetronomeOptions } from './Metronome';
export type { ClickerOptions } from './Clicker';
export type { VisualizerOptions } from './Visualizer';
export { DRUM_LOOP_LANES } from './types';
export type {
  Click,
  DrumLoopLane,
  DrumLoopPattern,
  DrumLoopTiming,
  FinalSoundSpec,
  SoundPack,
  SoundSpec,
} from './types';
export * from './api';
//# sourceMappingURL=index.d.ts.map
