import React, { useMemo } from 'react';
import type { Metronome } from '@/core';
import { DRUM_LOOP_LANES, type DrumLoopLane, type DrumLoopPattern } from '@/lib/drumLoop';
import { DefaultVisualizer } from './DefaultVisualizer';
import { DrumLoopPixiOverlay } from './DrumLoopPixiOverlay';

interface DrumLoopVisualizerProps {
  metronome: Metronome;
  pattern: DrumLoopPattern;
  width?: number;
  height?: number;
  onToggleStep: (lane: DrumLoopLane, stepIndex: number) => void;
}

const LABEL_WIDTH = 44;
const laneMeta = {
  kick: {
    label: 'Kick',
    shortLabel: 'K',
  },
  hat: {
    label: 'Hat',
    shortLabel: 'H',
  },
  snare: {
    label: 'Snare',
    shortLabel: 'S',
  },
} satisfies Record<
  DrumLoopLane,
  {
    label: string;
    shortLabel: string;
  }
>;

export function DrumLoopVisualizer({
  metronome: m,
  pattern,
  width = 350,
  height = 124,
  onToggleStep,
}: DrumLoopVisualizerProps) {
  const innerHeight = Math.max(1, height);
  const rowHeight = useMemo(() => innerHeight / DRUM_LOOP_LANES.length, [innerHeight]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">
        <DefaultVisualizer
          metronome={m}
          width={width}
          height={innerHeight}
          showGrid
          showNow
          showCount={false}
          showClicks={false}
        />
      </div>

      <div className="absolute inset-0 z-10 flex items-stretch">
        <div className="flex shrink-0 flex-col justify-between" style={{ width: LABEL_WIDTH }}>
          {DRUM_LOOP_LANES.map(lane => {
            const { label, shortLabel } = laneMeta[lane];
            return (
              <div
                className="flex items-center justify-center rounded-sm border border-slate-300/30 bg-transparent text-xs font-semibold tracking-wide text-slate-200"
                key={lane}
                style={{ height: rowHeight }}
                title={label}
              >
                <span aria-hidden="true">{shortLabel}</span>
                <span className="sr-only">{label}</span>
              </div>
            );
          })}
        </div>

        <DrumLoopPixiOverlay
          metronome={m}
          pattern={pattern}
          width={width}
          height={innerHeight}
          onToggleStep={onToggleStep}
        />
      </div>
    </div>
  );
}
