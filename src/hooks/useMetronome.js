import { useRef } from 'react';
import { Metronome } from '../metronome';

export function useMetronome(settings) {
  const m = useRef(new Metronome(settings));
  return m.current;
}
