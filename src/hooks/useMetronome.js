import { useRef } from 'react';
import { Metronome } from '../core';

export function useMetronome(settings) {
  const m = useRef(new Metronome(settings));
  return m.current;
}
