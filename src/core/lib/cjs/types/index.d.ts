import { Metronome, MetronomeOptions } from './Metronome';
import { ClickerOptions } from './Clicker';
export declare function createMetronome(
  mOpts: Partial<MetronomeOptions>,
  clickerOpts?: Omit<Partial<ClickerOptions>, 'audioContext'>,
  audioContext?: AudioContext,
): Metronome;
export { Metronome, MetronomeOptions } from './Metronome';
export { Clicker, ClickerOptions, DEFAULT_SOUNDS } from './Clicker';
export { Visualizer, VisualizerOptions } from './Visualizer';
export { SoundPack } from './types';
//# sourceMappingURL=index.d.ts.map
