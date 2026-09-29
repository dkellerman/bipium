import { useState } from 'react';
import { Metronome } from '@/core/index';
import type { MetronomeSettings } from '@/types';

export function useMetronome(settings: MetronomeSettings) {
  const [metronome] = useState(() => new Metronome(settings));
  return metronome;
}
