/*
 * Machine UI — lane labels overlaid on the drum-loop visualizer.
 * Copy of components/DrumLoopView with full-word labels; kept here so the
 * classic UI's version stays untouched.
 */
import React, { useMemo } from 'react';
import { DRUM_LOOP_LANES, type DrumLoopLane } from '@/core/index';

interface DrumLaneLabelsProps {
  height?: number;
  visible?: boolean;
}

const LABEL_WIDTH = 48;
const laneMeta = {
  kick: {
    label: 'Kick',
    shortLabel: 'Kick',
  },
  hat: {
    label: 'Hi-hat',
    shortLabel: 'Hi-hat',
  },
  snare: {
    label: 'Snare',
    shortLabel: 'Snare',
  },
} satisfies Record<
  DrumLoopLane,
  {
    label: string;
    shortLabel: string;
  }
>;

export function DrumLaneLabels({ height = 124, visible = true }: DrumLaneLabelsProps) {
  if (!visible) {
    return null;
  }

  const innerHeight = Math.max(1, height);
  const rowHeight = useMemo(() => innerHeight / DRUM_LOOP_LANES.length, [innerHeight]);

  return (
    <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-stretch">
      <div className="flex shrink-0 flex-col justify-between" style={{ width: LABEL_WIDTH }}>
        {DRUM_LOOP_LANES.map(lane => {
          const { label, shortLabel } = laneMeta[lane];
          return (
            <div
              className="flex items-center justify-start whitespace-nowrap bg-transparent pl-1.5 text-[11px] font-black leading-none tracking-tight text-slate-100"
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
  );
}
