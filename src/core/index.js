import { Metronome } from './Metronome';
import { Clicker } from './Clicker';

// utility method for creating a default metronome/clicker setup
export function createMetronome(
  mSettings = {},
  clickerSettings = {},
  audioContext = new AudioContext(),
) {
  const clicker = new Clicker({ audioContext, ...clickerSettings });
  return new Metronome({
    timerFn: () => audioContext.currentTime,
    clicker,
    ...mSettings,
  });
}

export { Metronome } from './Metronome';
export { Clicker, DEFAULT_SOUNDS } from './Clicker';
export { Visualizer } from './Visualizer';
