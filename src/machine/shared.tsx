/*
 * Machine UI — shared plumbing for the /machine route. Everything in this
 * folder is self-contained: it reads app state via AppContext but the classic
 * UI never imports from here.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DRUM_LOOP_LANES, type DrumLoopLane, type DrumLoopPattern } from '@/core/index';
import { useApp } from '@/AppContext';
import { useTapBPM } from '@/hooks';
import { cn, isEditableEventTarget } from '@/lib/utils';
import { sendOneEvent } from '@/tracking';
import { DefaultVisualizer } from '@/components/DefaultVisualizer';
import { DrumLaneLabels } from './DrumLaneLabels';

export interface MachineExtras {
  renderedVisualizerMode: 'default' | 'drumLoop';
  toggleVisualizerMode: () => void;
  clearDrumLoopPattern: () => void;
  drumPattern: DrumLoopPattern;
  toggleDrumLoopStep: (lane: DrumLoopLane, stepIndex: number) => void;
  start: () => void;
  stopAll: () => void;
}

export interface MachineProps {
  extras: MachineExtras;
}

export const SUBDIV_OPTIONS = [
  { value: 1, short: '1', label: 'Quarter notes' },
  { value: 2, short: '2', label: '8th notes' },
  { value: 3, short: '3', label: 'Triplets' },
  { value: 4, short: '4', label: '16th notes' },
  { value: 5, short: '5', label: 'Quintuplets' },
  { value: 6, short: '6', label: 'Sextuplets' },
  { value: 7, short: '7', label: 'Septuplets' },
  { value: 8, short: '8', label: '32nd notes' },
] as const;

export const subdivShort = (value: number) =>
  SUBDIV_OPTIONS.find(option => option.value === value)?.short ?? String(value);

export function useViewport() {
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 390,
    height: typeof window !== 'undefined' ? window.innerHeight : 844,
  }));

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

/**
 * Tap tempo with the same behavior as the classic BPMControls: taps update the
 * BPM, play a click, keyboard "t" taps, and confident tapping auto-starts.
 */
export function useTapTempo() {
  const { bpm, updateBPM, clicker, started, setStarted } = useApp();
  const {
    bpm: tappedBPM,
    confidence,
    handleTap: rawTap,
    reset,
    lastTapAt,
    lastInterval,
  } = useTapBPM(bpm);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (Number.isFinite(tappedBPM) && tappedBPM > 0) updateBPM(tappedBPM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tappedBPM]);

  useEffect(() => {
    if (!started && confidence >= 0.8) {
      const interval = lastInterval ?? 0;
      const tapAt = lastTapAt ?? 0;
      const delay = interval > 0 ? Math.max(0, interval - (Date.now() - tapAt)) : 0;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setStarted(true);
        reset();
        timeoutRef.current = null;
      }, delay);
    }
  }, [started, confidence, setStarted, reset, lastInterval, lastTapAt]);

  useEffect(() => {
    if (started && timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [started]);

  const tap = useCallback(() => {
    rawTap();
    clicker.click();
    sendOneEvent('tap');
  }, [rawTap, clicker]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) return;
      if (event.key.toLowerCase() === 't') tap();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tap]);

  return tap;
}

/** Editable BPM readout: tap the number to type a value. */
export function BpmEditable({
  displayClassName,
  inputClassName,
}: {
  displayClassName?: string;
  inputClassName?: string;
}) {
  const { bpm, updateBPM } = useApp();
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.value = String(bpm);
      inputRef.current.focus();
      inputRef.current.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = (raw: string) => {
    const next = Number.parseFloat(raw);
    if (Number.isFinite(next)) updateBPM(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={20}
        max={320}
        defaultValue={bpm}
        className={cn('bg-transparent text-center outline-none', inputClassName)}
        onBlur={event => commit(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className={displayClassName}
      title="Edit BPM"
      onClick={() => setEditing(true)}
    >
      {bpm}
    </button>
  );
}

/**
 * Styled native range input; color via CSS vars (--track/--fill/--thumb, see
 * machine.css). Optional clickable tick presets under the track, ported from
 * the classic Range component.
 */
export function MachineRange({
  min,
  max,
  step = 1,
  value,
  onChange,
  disabled = false,
  className,
  label,
  ticks = [],
  labelRotation = 0,
  tickClassName,
  tickLineClassName,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  ticks?: number[];
  labelRotation?: number;
  tickClassName?: string;
  tickLineClassName?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const input = (
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      className={cn('machine-range w-full', className)}
      style={{ '--pct': `${Math.max(0, Math.min(100, pct))}%` } as React.CSSProperties}
      onChange={event => onChange(Number(event.target.value))}
    />
  );

  if (ticks.length === 0) return input;

  return (
    <div className="w-full">
      {input}
      <div className={cn('relative -mt-2.5 select-none', labelRotation === 0 ? 'h-7' : 'h-8')}>
        {ticks.map((tick, index) => {
          const left = `${((tick - min) / (max - min)) * 100}%`;
          const isFirst = index === 0;
          const isLast = index === ticks.length - 1;
          const xOffset = isFirst ? '-25%' : isLast ? '-100%' : '-50%';

          return (
            <button
              type="button"
              key={`tick-${tick}`}
              disabled={disabled}
              className={cn(
                // w-6/h-9 is the tap target; the visible label stays small and
                // centered so the layout doesn't change.
                'absolute top-0 h-9 w-6 text-[11px] leading-none',
                tickClassName,
              )}
              style={{ left, transform: `translateX(${xOffset})` }}
              onClick={() => onChange(tick)}
            >
              <span
                className={cn(
                  'absolute -top-px left-1/2 h-[10px] w-px -translate-x-1/2 bg-current opacity-60',
                  tickLineClassName,
                )}
              />
              <span
                className="absolute left-1/2 top-[13px] inline-block whitespace-nowrap"
                style={
                  labelRotation === 0
                    ? { transform: 'translateX(-50%)', transformOrigin: 'top center' }
                    : {
                        transform: `translateX(-100%) rotate(${labelRotation}deg)`,
                        transformOrigin: 'top right',
                      }
                }
              >
                {tick}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function drumLines(height: number) {
  return DRUM_LOOP_LANES.slice(1).map(
    (_, index) => (height / DRUM_LOOP_LANES.length) * (index + 1),
  );
}

/** The pixi visualizer, frameless — Machine wraps it in its own chrome. */
export function VisualizerCore({
  width,
  height,
  extras,
}: {
  width: number;
  height: number;
  extras: MachineExtras;
}) {
  const { metronome, visualizers } = useApp();
  const isDrum = extras.renderedVisualizerMode === 'drumLoop';
  const lines = useMemo(() => drumLines(height), [height]);

  return (
    <div className="relative overflow-hidden bg-black" style={{ width, height }}>
      <DefaultVisualizer
        skipEdgeGridLines
        id={visualizers[0]}
        metronome={metronome}
        width={width}
        height={height}
        showCount={!isDrum}
        showClicks={!isDrum}
        horizontalLines={isDrum ? lines : []}
        drumLoopPattern={isDrum ? extras.drumPattern : undefined}
        onToggleDrumStep={isDrum ? extras.toggleDrumLoopStep : undefined}
      />
      <DrumLaneLabels height={height} visible={isDrum} />
    </div>
  );
}
