import { useRef } from 'react';
import { Clicker, DEFAULT_SOUNDS } from '../core';

export const SOUND_PACKS = {
  defaults: {
    ...DEFAULT_SOUNDS,
    user: ['/audio/stick.mp3', 1.0, 0.25],
  },
  drumkit: {
    name: 'Drum Kit',
    bar: ['/audio/kick1.mp3', 1.0, 0.5],
    beat: ['/audio/hihat1.mp3', 1.0, 0.25],
    half: ['/audio/snare1.mp3', 1.0, 0.25],
    subDiv: ['/audio/hihat2.mp3', 0.7, 0.15],
    user: ['/audio/stick.mp3', 1.0, 0.25],
  },
};

export function useClicker({
  audioContext,
  volume = 100,
  sounds = SOUND_PACKS.defaults,
  pattern,
} = {}) {
  const clicker = useRef(
    new Clicker({
      audioContext,
      volume,
      sounds,
      pattern,
    }),
  );

  return clicker.current;
}
