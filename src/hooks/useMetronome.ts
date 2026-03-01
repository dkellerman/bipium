import { useRef } from 'react';
import { Metronome } from '@/core';
import type { MetronomeSettings } from '@/types';

export function useMetronome(settings: MetronomeSettings) {
  const m = useRef(new Metronome(settings));
  return m.current;
}
