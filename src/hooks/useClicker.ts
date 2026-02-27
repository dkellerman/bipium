import { useRef } from 'react';
import { Clicker, DEFAULT_SOUNDS } from '../core';
import type { ClickerHookOptions, SoundPacks } from '../types';

export const SOUND_PACKS: SoundPacks = {
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

const defaultClickerOptions: ClickerHookOptions = {
  volume: 100,
  sounds: SOUND_PACKS.defaults,
};

export function useClicker(options: ClickerHookOptions = defaultClickerOptions) {
  const { audioContext, volume = 100, sounds = SOUND_PACKS.defaults } = options;
  const clicker = useRef(
    new Clicker({
      audioContext: audioContext as AudioContext,
      volume,
      sounds,
    }),
  );

  return clicker.current;
}
