import React, { useMemo } from 'react';
import { DRUM_LOOP_LANES, type DrumLoopLane } from '@/core/index';

interface DrumLoopViewProps {
  height?: number;
  visible?: boolean;
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

export function DrumLoopView({ height = 124, visible = true }: DrumLoopViewProps) {
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
  );
}
