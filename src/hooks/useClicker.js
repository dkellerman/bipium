import { useRef } from 'react';
import { AudioContext } from 'standardized-audio-context';
import { Clicker, DEFAULT_SOUNDS } from '../metronome/Clicker';

export const SOUND_PACKS = {
  defaults: {
    ...DEFAULT_SOUNDS,
    user: '/audio/click.mp3',
  },
  percussion: {
    name: 'Percussion',
    bar: '/audio/kick.mp3',
    beat: '/audio/snare.mp3',
    subDiv: '/audio/click2.mp3',
    user: '/audio/click3.mp3',
  },
};

export function useClicker({
  volume = 100,
  sounds = SOUND_PACKS.defaults,
  audioContext = new AudioContext(),
} = {}) {
  const clicker = useRef(
    new Clicker({
      audioContext,
      volume,
      sounds,
    }),
  );

  return clicker.current;
}
