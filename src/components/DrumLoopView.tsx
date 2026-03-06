import React, { useMemo } from 'react';
import type { Metronome } from '@/core';
import { DRUM_LOOP_LANES, type DrumLoopLane, type DrumLoopPattern } from '@/lib/drumLoop';
import { DefaultVisualizer } from './DefaultVisualizer';

interface DrumLoopViewProps {
  metronome: Metronome;
  pattern: DrumLoopPattern;
  width?: number;
  height?: number;
  onToggleStep: (lane: DrumLoopLane, stepIndex: number) => void;
}

const LABEL_WIDTH = 18;
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

export function DrumLoopView({
  metronome: m,
  pattern,
  width = 350,
  height = 124,
  onToggleStep,
}: DrumLoopViewProps) {
  const innerHeight = Math.max(1, height);
  const rowHeight = useMemo(() => innerHeight / DRUM_LOOP_LANES.length, [innerHeight]);
  const horizontalLines = useMemo(
    () => DRUM_LOOP_LANES.slice(1).map((_, index) => rowHeight * (index + 1)),
    [rowHeight],
  );

  return (
    <div className="relative h-full w-full">
      <DefaultVisualizer
        metronome={m}
        width={width}
        height={innerHeight}
        showGrid
        showNow
        showCount={false}
        showClicks={false}
        horizontalLines={horizontalLines}
        drumLoopPattern={pattern}
        onToggleDrumStep={onToggleStep}
      />

      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-stretch">
        <div className="flex shrink-0 flex-col justify-between" style={{ width: LABEL_WIDTH }}>
          {DRUM_LOOP_LANES.map(lane => {
            const { label, shortLabel } = laneMeta[lane];
            return (
              <div
                className="flex items-center justify-center bg-transparent text-[10px] font-black leading-none tracking-tight text-slate-100"
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
      </div>
    </div>
  );
}
