/* Guitar tuner shown in voice mode when open strings are heard ringing (see lib/tuner.ts).
 * A round gauge for each string ringing, low to high: a tick every 5 cents, lit from the
 * center out to the string's reading, with the note in the middle. When they fall silent
 * the last ones stay, dimmed. */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tuning, TunerReading } from '@/lib/tuner';

const RANGE = 50; // cents shown either side of in tune
const STEP = 5; // cents per tick
const SWEEP = 130; // degrees either side of the top
const IN_TUNE = 3;

const signed = (cents: number) => `${cents > 0 ? '+' : '−'}${Math.round(Math.abs(cents))}`;

function tone(cents: number) {
  const off = Math.abs(cents);
  return off <= IN_TUNE + 2 ? '#10b981' : off <= 15 ? '#f59e0b' : '#f43f5e';
}

function Gauge({
  name,
  octave,
  cents,
  sounding,
  machine,
}: {
  name: string;
  octave: number;
  cents: number | null;
  sounding: boolean;
  machine: boolean;
}) {
  const reading = cents === null ? null : Math.max(-RANGE, Math.min(RANGE, cents));
  const unlit = machine ? 'rgba(28,25,23,0.18)' : 'var(--tuner-unlit)';
  const ticks = [];
  for (let c = -RANGE; c <= RANGE; c += STEP) {
    const angle = ((c / RANGE) * SWEEP * Math.PI) / 180;
    const center = c === 0;
    const inner = center ? 33 : 37;
    const lit =
      reading !== null &&
      (center ||
        (Math.sign(c) === Math.sign(reading) && Math.abs(c) <= Math.abs(reading) + STEP / 2));
    const tip = reading !== null && Math.abs(c - reading) <= STEP / 2;
    ticks.push(
      <line
        key={c}
        x1={50 + inner * Math.sin(angle)}
        y1={50 - inner * Math.cos(angle)}
        x2={50 + 46 * Math.sin(angle)}
        y2={50 - 46 * Math.cos(angle)}
        stroke={lit ? tone(reading!) : unlit}
        strokeOpacity={lit && !tip && !center ? 0.55 : 1}
        strokeWidth={tip || center ? 4 : 3}
        strokeLinecap="round"
        style={{ transition: 'stroke 120ms, stroke-opacity 120ms' }}
      />,
    );
  }
  const label = cents === null ? '–' : Math.abs(cents) <= IN_TUNE ? 'in tune' : `${signed(cents)}¢`;
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full"
      role="img"
      aria-label={`${name}${octave}: ${label}${sounding ? '' : ' (not ringing)'}`}
      style={{ opacity: sounding || cents === null ? 1 : 0.4, transition: 'opacity 200ms' }}
    >
      {ticks}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        className="font-semibold"
        fontSize="28"
        fill={cents === null ? (machine ? 'rgba(28,25,23,0.35)' : '#94a3b8') : 'currentColor'}
      >
        {name}
        <tspan fontSize="11" dy="2">
          {octave}
        </tspan>
      </text>
      <text
        x="50"
        y="80"
        textAnchor="middle"
        fontSize="11"
        fill={cents === null ? (machine ? 'rgba(28,25,23,0.35)' : '#94a3b8') : tone(cents)}
        className="font-semibold"
      >
        {label}
      </text>
    </svg>
  );
}

function wholeGuitar(offset: number | null) {
  if (offset === null)
    return 'Reading against A440 until three strings are heard; then against each other.';
  if (Math.abs(offset) <= IN_TUNE) return 'Whole guitar: in tune with A440.';
  return `Whole guitar: ${Math.round(Math.abs(offset))}¢ ${offset < 0 ? 'flat' : 'sharp'} of A440.`;
}

export function TunerPopup({
  reading,
  variant,
  onClose,
}: {
  reading: TunerReading;
  variant: 'classic' | 'machine' | 'api';
  onClose: () => void;
}) {
  const machine = variant === 'machine';
  const ringing = reading.sounding.flatMap((on, string) => (on ? [string] : []));
  const last = useRef<{ tuning: Tuning; strings: number[] } | null>(null);
  if (ringing.length) last.current = { tuning: reading.tuning, strings: ringing };
  const shown = ringing.length
    ? ringing
    : last.current?.tuning === reading.tuning
      ? last.current.strings
      : [];
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-labelledby="tuner-title"
        className={cn(
          'relative w-full max-w-sm px-4 pb-4 pt-3 text-left sm:px-5',
          shown.length > 3 && 'sm:max-w-2xl',
          machine
            ? 'rounded-xl border-[3px] border-stone-900 bg-[#f6f3ea] text-stone-900 shadow-[4px_4px_0_#1c1917]'
            : 'rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="tuner-title" className="flex items-center gap-2 text-lg font-semibold">
            Tuner
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-px-11 font-semibold uppercase tracking-wide',
                machine
                  ? 'border-2 border-stone-900 bg-[#ffd76a]'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
              )}
            >
              {reading.tuning.name}
              {reading.guessed && '?'}
            </span>
          </h2>
          <button
            type="button"
            aria-label="Close tuner"
            title="Close"
            onClick={onClose}
            className={cn(
              'grid size-9 place-items-center rounded-md',
              machine ? 'hover:bg-stone-900/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800',
            )}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <p
          className={cn(
            'text-sm',
            machine ? 'text-stone-600' : 'text-slate-600 dark:text-slate-400',
          )}
        >
          {wholeGuitar(reading.offset)}
        </p>
        <div className="mt-3 flex min-h-32 flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {shown.length ? (
            shown.map(string => (
              <div
                key={string}
                className={
                  shown.length === 1
                    ? 'w-48'
                    : shown.length <= 3
                      ? 'w-[30%]'
                      : 'w-[30%] sm:w-[calc(16.66%-0.625rem)]'
                }
              >
                <Gauge
                  name={reading.tuning.names[string]}
                  octave={Math.floor(reading.tuning.notes[string] / 12) - 1}
                  cents={reading.cents[string]}
                  sounding={reading.sounding[string]}
                  machine={machine}
                />
              </div>
            ))
          ) : (
            <p
              className={cn(
                'text-sm',
                machine ? 'text-stone-500' : 'text-slate-500 dark:text-slate-400',
              )}
            >
              Pluck an open string.
            </p>
          )}
        </div>
        <p
          className={cn(
            'mt-2 text-center text-xs',
            machine ? 'text-stone-500' : 'text-slate-500 dark:text-slate-400',
          )}
        >
          Let any open strings ring to tune them. Strum all six to check them together.
        </p>
      </div>
    </div>,
    document.body,
  );
}
