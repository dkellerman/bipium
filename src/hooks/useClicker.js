import { useRef } from 'react';
import { Clicker, DEFAULT_SOUNDS } from '../metronome';

export const SOUND_PACKS = {
  defaults: {
    ...DEFAULT_SOUNDS,
    user: '/audio/click.mp3',
  },
  percussion: {
    name: 'Percussion',
    bar: '/audio/kick.mp3',
    beat: '/audio/snare.mp3',
    subDiv: ['/audio/click2.mp3', .7],
    user: '/audio/click3.mp3',
  },
};

export function useClicker({ audioContext, volume = 100, sounds = SOUND_PACKS.defaults } = {}) {
  const clicker = useRef(
    new Clicker({
      audioContext,
      volume,
      sounds,
    }),
  );

  return clicker.current;
}
