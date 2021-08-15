import { useState, useRef, useCallback } from 'react';

export function useTapBPM(defVal) {
  const [bpm, setBPM] = useState(defVal);
  const taps = useRef([]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    taps.current.push(now);
    if (taps.current.length > 1) {
      const lastTap = taps.current[taps.current.length - 2];
      const elapsed = now - lastTap;
      if (elapsed >= 2000) {
        taps.current = [now];
      } else if (taps.current.length > 2) {
        let difs = 0;
        for (let i = 1; i < taps.current.length; i++) {
          difs += taps.current[i] - taps.current[i - 1];
        }
        const avgDif = difs / (taps.current.length - 1);
        setBPM(Math.round(60000 / avgDif));
        if (taps.current.length > 4) {
          taps.current.shift();
        }
      }
    }
  }, []);

  return {
    handleTap,
    bpm,
  };
}
