import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { Visualizer } from '@/core';
import type { Metronome } from '@/core';
import {
  DRUM_LOOP_LANES,
  isBeatAlignedStep,
  type DrumLoopLane,
  type DrumLoopPattern,
} from '@/lib/drumLoop';
import { cn } from '@/lib/utils';

interface DrumLoopVisualizerProps {
  metronome: Metronome;
  pattern: DrumLoopPattern;
  subDivs: number;
  width?: number;
  height?: number;
  onToggleStep: (lane: DrumLoopLane, stepIndex: number) => void;
}

const LABEL_WIDTH = 44;
const FRAME_INSET = 10;

const laneMeta = {
  kick: {
    label: 'Kick',
    shortLabel: 'K',
    activeClassName: 'bg-emerald-700 text-white border-emerald-900',
  },
  hat: {
    label: 'Hat',
    shortLabel: 'H',
    activeClassName: 'bg-sky-700 text-white border-sky-950',
  },
  snare: {
    label: 'Snare',
    shortLabel: 'S',
    activeClassName: 'bg-amber-700 text-white border-amber-950',
  },
} satisfies Record<
  DrumLoopLane,
  {
    label: string;
    shortLabel: string;
    activeClassName: string;
  }
>;

export function DrumLoopVisualizer({
  metronome: m,
  pattern,
  subDivs,
  width = 350,
  height = 124,
  onToggleStep,
}: DrumLoopVisualizerProps) {
  const mAny = m as any;
  const visualizerRef = useRef(new Visualizer({ metronome: mAny }));
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);
  const totalSteps = pattern.kick.length;
  const innerHeight = Math.max(1, height - FRAME_INSET);
  const innerWidth = Math.max(LABEL_WIDTH + 180, width - FRAME_INSET);
  const gridWidth = Math.max(innerWidth - LABEL_WIDTH, 180);
  const columnTemplate = useMemo(() => {
    const gridTimes = m.gridTimes;
    if (!gridTimes?.length || gridTimes.length !== totalSteps) {
      return `repeat(${totalSteps}, minmax(0, 1fr))`;
    }

    const boundaries = [...gridTimes, m.barTime];
    return boundaries
      .slice(0, totalSteps)
      .map((start, index) => {
        const width = Math.max(0.001, boundaries[index + 1] - start);
        return `${width}fr`;
      })
      .join(' ');
  }, [m, totalSteps, m.opts.beats, m.opts.subDivs, m.opts.swing, m.barTime]);

  const rowHeight = useMemo(
    () => Math.max(28, Math.floor(innerHeight / DRUM_LOOP_LANES.length)),
    [innerHeight],
  );

  useEffect(() => {
    const draw = () => {
      if (!mAny.started) return;

      visualizerRef.current.update();
      const lastClick = m.lastClick;

      startTransition(() => {
        setProgress(visualizerRef.current.progress);
        setCurrentStep(lastClick ? m.getClickBarIndex(lastClick) : -1);
      });

      frameRef.current = window.requestAnimationFrame(draw);
    };

    if (!mAny.started) {
      visualizerRef.current.stop();
      setProgress(0);
      setCurrentStep(-1);
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    visualizerRef.current.start();
    frameRef.current = window.requestAnimationFrame(draw);

    return () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [m, mAny.started]);

  return (
    <div className="box-border flex h-full w-full items-stretch rounded-md border border-slate-800/80 bg-transparent p-1">
      <div
        className="mr-1 flex shrink-0 flex-col justify-between"
        style={{ width: LABEL_WIDTH - 8 }}
      >
        {DRUM_LOOP_LANES.map(lane => {
          const { label, shortLabel } = laneMeta[lane];
          return (
            <div
              className="flex items-center justify-center rounded-sm border border-slate-800/60 bg-slate-950/40 text-xs font-semibold tracking-wide text-slate-300"
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

      <div className="relative" style={{ width: gridWidth, height: innerHeight }}>
        <div
          className="absolute inset-y-0 z-10 w-0.5 bg-emerald-400/95 shadow-[0_0_8px_rgba(74,222,128,0.7)]"
          style={{ left: `${Math.max(0, Math.min(100, progress * 100))}%` }}
        />

        <div
          className="grid gap-px rounded-sm bg-slate-700/80"
          style={{
            gridTemplateColumns: columnTemplate,
            gridTemplateRows: `repeat(${DRUM_LOOP_LANES.length}, ${rowHeight}px)`,
          }}
        >
          {DRUM_LOOP_LANES.map(lane =>
            pattern[lane].map((active, stepIndex) => {
              const isCurrentStep = stepIndex === currentStep;
              const isBeatStep = isBeatAlignedStep(stepIndex, subDivs);
              const meta = laneMeta[lane];

              return (
                <button
                  type="button"
                  key={`${lane}-${stepIndex}`}
                  className={cn(
                    'min-h-0 min-w-0 border transition-colors',
                    'focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                    isBeatStep
                      ? 'border-slate-500 bg-slate-800/90'
                      : 'border-slate-700 bg-slate-950/70',
                    active ? meta.activeClassName : 'text-slate-300',
                    isCurrentStep &&
                      'shadow-[inset_0_0_0_2px_rgba(255,255,255,0.55),0_0_0_1px_rgba(255,255,255,0.15)]',
                  )}
                  aria-label={`${meta.label} step ${stepIndex + 1}`}
                  aria-pressed={active}
                  onClick={() => onToggleStep(lane, stepIndex)}
                >
                  <span className="sr-only">
                    {active ? `Disable ${meta.label}` : `Enable ${meta.label}`} on step{' '}
                    {stepIndex + 1}
                  </span>
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
