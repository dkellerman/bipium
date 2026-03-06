import { useRef } from 'react';
import { Clicker, DEFAULT_SOUNDS } from '@/core';
import type { SoundPack } from '@/core';
import type { SoundSpec } from '@/core/types';
import type { ApiSoundSlot, ApiSoundUrls, ClickerHookOptions, SoundPacks } from '@/types';

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

export const API_SOUND_SLOTS: ApiSoundSlot[] = ['bar', 'beat', 'half', 'subDiv', 'user'];

function cloneSoundSpec(sound: SoundSpec | string | undefined) {
  return Array.isArray(sound) ? ([...sound] as SoundSpec) : sound;
}

export function buildConfiguredSoundPack(
  soundPackKey: string,
  soundUrls: ApiSoundUrls = {},
  forceDrumkit = false,
) {
  const baseKey = forceDrumkit ? 'drumkit' : soundPackKey;
  const basePack = SOUND_PACKS[baseKey] ?? SOUND_PACKS.defaults;
  const nextPack: SoundPack = {};

  Object.entries(basePack).forEach(([key, value]) => {
    nextPack[key] = cloneSoundSpec(value as SoundSpec | string);
  });

  API_SOUND_SLOTS.forEach(slot => {
    const url = soundUrls[slot];
    if (!url) return;

    const current = nextPack[slot];
    if (Array.isArray(current)) {
      nextPack[slot] = [url, current[1], current[2]];
      return;
    }

    nextPack[slot] = [url, 1.0, 0.05];
  });

  return nextPack;
}

const defaultClickerOptions: ClickerHookOptions = {
  volume: 100,
  sounds: buildConfiguredSoundPack('defaults'),
};

export function useClicker(options: ClickerHookOptions = defaultClickerOptions) {
  const { audioContext, volume = 100, sounds = buildConfiguredSoundPack('defaults') } = options;
  const clicker = useRef(
    new Clicker({
      audioContext: audioContext as AudioContext,
      volume,
      sounds,
    }),
  );

  return clicker.current;
}
