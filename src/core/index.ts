import { Metronome, MetronomeOptions } from './Metronome';
import { Clicker, ClickerOptions } from './Clicker';

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

export { Metronome, MetronomeOptions } from './Metronome';
export { Clicker, ClickerOptions, DEFAULT_SOUNDS } from './Clicker';
export { Visualizer, VisualizerOptions } from './Visualizer';
export { SoundPack } from './types';
