import { useState, useRef, useCallback } from 'react';
import type { TapBPMResult } from '@/types';

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const steadyDeviationBpm = 6;
const wildDeviationBpm = 15;
const confidenceUp = 0.2;
const wildConfidenceDown = 0.6;

export function useTapBPM(defVal: number): TapBPMResult {
  const [bpm, setBPM] = useState(defVal);
  const [confidence, setConfidence] = useState(0);
  const [lastTapAt, setLastTapAt] = useState<number | null>(null);
  const [lastInterval, setLastInterval] = useState<number | null>(null);
  const taps = useRef<number[]>([]);
  const confidenceRef = useRef(0);
  const estimateBpmRef = useRef<number | null>(null);

  const intervalCountForConfidence = 3;
  const maxTapHistory = intervalCountForConfidence + 1;
  const estimateAlpha = 0.25;

  const reset = useCallback(() => {
    taps.current = [];
    confidenceRef.current = 0;
    estimateBpmRef.current = null;
    setConfidence(0);
    setLastTapAt(null);
    setLastInterval(null);
  }, []);

  const handleTap = useCallback(() => {
    const now = Date.now();
    taps.current.push(now);
    setLastTapAt(now);
    if (taps.current.length > 1) {
      const lastTap = taps.current[taps.current.length - 2];
      const elapsed = now - lastTap;
      setLastInterval(elapsed);
      if (elapsed >= 2000) {
        taps.current = [now];
        confidenceRef.current = 0;
        estimateBpmRef.current = null;
        setConfidence(0);
        return;
      } else if (taps.current.length > 2) {
        let difs = 0;
        for (let i = 1; i < taps.current.length; i++) {
          difs += taps.current[i] - taps.current[i - 1];
        }
        const avgDif = difs / (taps.current.length - 1);
        setBPM(Math.round(60000 / avgDif));
        if (taps.current.length > maxTapHistory) {
          taps.current.shift();
        }
      }
    }

    const interval =
      taps.current.length > 1
        ? taps.current[taps.current.length - 1] - taps.current[taps.current.length - 2]
        : 0;
    const instantBpm = interval > 0 ? 60000 / interval : 0;

    if (Number.isFinite(instantBpm) && instantBpm > 0) {
      if (estimateBpmRef.current === null) {
        estimateBpmRef.current = instantBpm;
      } else {
        estimateBpmRef.current =
          estimateBpmRef.current * (1 - estimateAlpha) + instantBpm * estimateAlpha;
      }
    }

    const estimateBpm = estimateBpmRef.current ?? 0;
    const deviation = estimateBpm > 0 ? Math.abs(instantBpm - estimateBpm) : 0;

    if (taps.current.length - 1 >= intervalCountForConfidence && estimateBpm > 0) {
      if (deviation <= steadyDeviationBpm) {
        confidenceRef.current = clamp(confidenceRef.current + confidenceUp);
      } else if (deviation >= wildDeviationBpm) {
        confidenceRef.current = clamp(confidenceRef.current - wildConfidenceDown);
      }
    }

    setConfidence(confidenceRef.current);
  }, []);

  return {
    handleTap,
    bpm,
    confidence,
    reset,
    lastTapAt,
    lastInterval,
  };
}
