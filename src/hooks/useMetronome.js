import { useRef } from 'react';
import { Metronome } from '../metronome/Metronome';

export function useMetronome(settings) {
  const m = useRef(new Metronome(settings));
  return m.current;
}
