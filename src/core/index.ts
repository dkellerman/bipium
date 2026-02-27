import { Metronome } from './Metronome';
import { Clicker } from './Clicker';
import type { MetronomeOptions } from './Metronome';
import type { ClickerOptions } from './Clicker';

// utility method for creating a default metronome/clicker setup
export function createMetronome(
  mOpts: Partial<MetronomeOptions>,
  clickerOpts: Omit<Partial<ClickerOptions>, 'audioContext'> = {},
  audioContext = new AudioContext(),
) {
  const clicker = new Clicker({ audioContext, ...clickerOpts });
  return new Metronome({
    timerFn: () => audioContext.currentTime,
    clicker,
    ...mOpts,
  });
}

export { Metronome } from './Metronome';
export { Clicker, DEFAULT_SOUNDS } from './Clicker';
export { Visualizer } from './Visualizer';
export type { MetronomeOptions } from './Metronome';
export type { ClickerOptions } from './Clicker';
export type { VisualizerOptions } from './Visualizer';
export type { SoundPack } from './types';
