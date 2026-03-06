import React, { useCallback, useMemo } from 'react';
import { Application, extend } from '@pixi/react';
import { Graphics, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import type { Metronome } from '@/core';
import { DRUM_LOOP_LANES, type DrumLoopLane, type DrumLoopPattern } from '@/lib/drumLoop';

interface DrumLoopPixiOverlayProps {
  metronome: Metronome;
  pattern: DrumLoopPattern;
  width: number;
  height: number;
  onToggleStep: (lane: DrumLoopLane, stepIndex: number) => void;
}

const HORIZONTAL_LINE_COLOR = 0xbbbbbb;

const laneStyles = {
  kick: { color: 0x34d399, alpha: 0.28 },
  hat: { color: 0x38bdf8, alpha: 0.28 },
  snare: { color: 0xfbbf24, alpha: 0.28 },
} satisfies Record<DrumLoopLane, { color: number; alpha: number }>;

extend({ Graphics });

type StepRect = {
  start: number;
  end: number;
};

function getStepRects(metronome: Metronome, totalSteps: number, width: number) {
  const barTime = metronome.barTime;
  const gridTimes = metronome.gridTimes;

  if (!barTime || !gridTimes.length || gridTimes.length !== totalSteps) {
    return Array.from({ length: totalSteps }, (_, index) => {
      const start = (index / totalSteps) * width;
      const end = ((index + 1) / totalSteps) * width;
      return { start, end };
    });
  }

  const boundaries = [...gridTimes, barTime];

  return Array.from({ length: totalSteps }, (_, index) => {
    const start = (boundaries[index] / barTime) * width;
    const end = (boundaries[index + 1] / barTime) * width;

    return {
      start: Math.max(0, Math.min(width, start)),
      end: Math.max(0, Math.min(width, end)),
    };
  });
}

export function DrumLoopPixiOverlay({
  metronome: m,
  pattern,
  width,
  height,
  onToggleStep,
}: DrumLoopPixiOverlayProps) {
  const totalSteps = pattern.kick.length;
  const rowHeight = height / DRUM_LOOP_LANES.length;
  const stepRects = useMemo(
    () => getStepRects(m, totalSteps, width),
    [m, totalSteps, width, m.opts.beats, m.opts.subDivs, m.opts.swing, m.barTime],
  );
  const hitArea = useMemo(() => new Rectangle(0, 0, width, height), [width, height]);

  const handlePointerTap = useCallback(
    (event: FederatedPointerEvent) => {
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
    <div className="absolute inset-0 z-10">
      <Application
        key={`${m.opts.beats}:${m.opts.subDivs}:${m.opts.swing}:${width}:${height}`}
        width={width}
        height={height}
        antialias={false}
        autoDensity
        resolution={1}
        roundPixels
        backgroundAlpha={0}
      >
        <pixiGraphics
          draw={g => {
            g.clear();

            DRUM_LOOP_LANES.slice(1).forEach((_, index) => {
              const y = rowHeight * (index + 1);
              g.setStrokeStyle({ width: 1, color: HORIZONTAL_LINE_COLOR, alpha: 1 });
              g.moveTo(0, y);
              g.lineTo(width, y);
              g.stroke();
            });

            DRUM_LOOP_LANES.forEach((lane, laneIndex) => {
              const { color, alpha } = laneStyles[lane];

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
          }}
        />

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
      </Application>
    </div>
  );
}
