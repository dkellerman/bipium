import React, { useCallback, useMemo } from 'react';
import { extend } from '@pixi/react';
import { Graphics, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import type { Metronome } from '@/core';
import { DRUM_LOOP_LANES, type DrumLoopLane, type DrumLoopPattern } from '@/lib/drumLoop';

interface DrumLoopOverlayProps {
  metronome: Metronome;
  width: number;
  height: number;
  pattern: DrumLoopPattern;
  horizontalLines?: number[];
  onToggleStep?: (lane: DrumLoopLane, stepIndex: number) => void;
}

const DIV_COLOR = 0xbbbbbb;
const DRUM_LANE_STYLES = {
  kick: { color: 0x34d399, alpha: 0.28 },
  hat: { color: 0x38bdf8, alpha: 0.28 },
  snare: { color: 0xfbbf24, alpha: 0.28 },
} satisfies Record<DrumLoopLane, { color: number; alpha: number }>;

extend({ Graphics });

type StepRect = {
  start: number;
  end: number;
};

function getStepRects(metronome: Metronome, totalSteps: number, width: number): StepRect[] {
  const barTime = metronome.barTime;
  const gridTimes = metronome.gridTimes;

  if (!barTime || !gridTimes.length || gridTimes.length !== totalSteps) {
    return Array.from({ length: totalSteps }, (_, index) => ({
      start: (index / totalSteps) * width,
      end: ((index + 1) / totalSteps) * width,
    }));
  }

  const boundaries = [...gridTimes, barTime];

  return Array.from({ length: totalSteps }, (_, index) => ({
    start: Math.max(0, Math.min(width, (boundaries[index] / barTime) * width)),
    end: Math.max(0, Math.min(width, (boundaries[index + 1] / barTime) * width)),
  }));
}

export function DrumLoopOverlay({
  metronome: m,
  width,
  height,
  pattern,
  horizontalLines = [],
  onToggleStep,
}: DrumLoopOverlayProps) {
  const totalSteps = pattern.kick.length;
  const rowHeight = DRUM_LOOP_LANES.length > 0 ? height / DRUM_LOOP_LANES.length : height;
  const stepRects = useMemo(
    () => getStepRects(m, totalSteps, width),
    [m, totalSteps, width, m.opts.beats, m.opts.subDivs, m.opts.swing, m.barTime, m.gridTimes],
  );
  const hitArea = useMemo(
    () => (onToggleStep ? new Rectangle(0, 0, width, height) : undefined),
    [height, onToggleStep, width],
  );

  const handlePointerTap = useCallback(
    (event: FederatedPointerEvent) => {
      if (!onToggleStep) {
        return;
      }

      const local = event.getLocalPosition(event.currentTarget);
      const laneIndex = Math.floor(local.y / rowHeight);

      if (laneIndex < 0 || laneIndex >= DRUM_LOOP_LANES.length) {
        return;
      }

      const stepIndex = stepRects.findIndex((rect, index) => {
        if (index === stepRects.length - 1) {
          return local.x >= rect.start && local.x <= rect.end;
        }
        return local.x >= rect.start && local.x < rect.end;
      });

      if (stepIndex < 0) {
        return;
      }

      onToggleStep(DRUM_LOOP_LANES[laneIndex], stepIndex);
    },
    [onToggleStep, rowHeight, stepRects],
  );

  return (
    <>
      <pixiGraphics
        draw={g => {
          g.clear();

          DRUM_LOOP_LANES.forEach((lane, laneIndex) => {
            const { color, alpha } = DRUM_LANE_STYLES[lane];

            pattern[lane].forEach((active, stepIndex) => {
              if (!active) {
                return;
              }

              const rect = stepRects[stepIndex];
              if (!rect || rect.end <= rect.start) {
                return;
              }

              g.rect(rect.start, laneIndex * rowHeight, rect.end - rect.start, rowHeight).fill({
                color,
                alpha,
              });
            });
          });

          horizontalLines.forEach(y => {
            g.setStrokeStyle({ width: 1, color: DIV_COLOR });
            g.moveTo(0, y);
            g.lineTo(width, y);
            g.stroke();
          });
        }}
      />

      {onToggleStep ? (
        <pixiGraphics
          hitArea={hitArea}
          eventMode="static"
          cursor="pointer"
          onPointerTap={handlePointerTap}
          draw={g => {
            g.clear();
            g.rect(0, 0, width, height).fill({ color: 0xffffff, alpha: 0.001 });
          }}
        />
      ) : null}
    </>
  );
}
