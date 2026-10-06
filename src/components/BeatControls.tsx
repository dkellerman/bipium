import { useEffect, useRef, useState } from 'react';
import { RowGap } from './RowGap';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Range } from './Range';
import { StepButtons } from './StepButtons';
import { useApp } from '@/AppContext';
import { cn } from '@/lib/utils';
import { sendEvent, sendOneEvent } from '@/tracking';
import type { NumberInput } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const int = (value: NumberInput) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const float = (value: NumberInput) => {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const validSwing = (value: NumberInput, fallback = 0) => {
  const fallbackNum = Number(fallback);
  const base = Number.isFinite(fallbackNum) ? fallbackNum : 0;
  const next = Number(value);
  if (!Number.isFinite(next)) return Math.max(0, Math.min(100, base));
  return Math.max(0, Math.min(100, next));
};

const formatSwing = (value: number) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return '0';
  return Number.isInteger(next) ? `${next}` : `${Number(next.toFixed(2))}`;
};

function PlaySubDivsRow() {
  const { playSubDivs, setPlaySubDivsWithTracking, swingEnabled, setSwingEnabledWithRestore } =
    useApp();

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex cursor-pointer items-center justify-center gap-2 rounded-md px-1"
      onClick={() => setPlaySubDivsWithTracking(!playSubDivs)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setPlaySubDivsWithTracking(!playSubDivs);
        }
      }}
    >
      <div className="flex items-center gap-2">
        <div onClick={event => event.stopPropagation()}>
          <Switch
            checked={playSubDivs}
            onCheckedChange={value => setPlaySubDivsWithTracking(value)}
          />
        </div>
        <label className="cursor-pointer text-lg leading-none pointer-fine:text-base">Play sub divs</label>
        {playSubDivs && (
          <div
            className="ml-4 flex items-center gap-1.5"
            onClick={event => event.stopPropagation()}
          >
            <Switch
              checked={swingEnabled}
              onCheckedChange={value => setSwingEnabledWithRestore(value)}
            />
            <span className="text-lg leading-none pointer-fine:text-base">Swing</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BeatsRow() {
  const { beats, setBeats } = useApp();

  return (
    <div className="flex w-full items-center justify-center gap-2">
      <div className="flex items-center gap-2">
        <label className="text-base leading-none pointer-fine:text-sm">Beats:</label>
        <Select
          value={String(beats)}
          onValueChange={raw => {
            const value = int(raw);
            setBeats(value);
            sendEvent('set_beats', 'App', value, value);
          }}
        >
          <SelectTrigger aria-label="Beats per bar" className="h-14 min-w-20 text-xl sm:h-12 pointer-fine:px-2.5 pointer-fine:text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {new Array(12).fill(0).map((_, index) => (
              <SelectItem key={`beats-${index + 1}`} value={String(index + 1)} className="text-lg">
                {index + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <StepButtons
        onIncrement={() => {
          if (beats >= 12) return;
          const next = beats + 1;
          setBeats(next);
          sendEvent('set_beats', 'App', 'step_up');
        }}
        onDecrement={() => {
          if (beats <= 1) return;
          const next = beats - 1;
          setBeats(next);
          sendEvent('set_beats', 'App', 'step_down');
        }}
        disableIncrement={beats >= 12}
        disableDecrement={beats <= 1}
        incrementLabel="Increase beats"
        decrementLabel="Decrease beats"
      />
    </div>
  );
}

const SUBDIVISION_OPTIONS = [
  ['8', '32nd notes'],
  ['7', 'Septuplets'],
  ['6', 'Sextuplets'],
  ['5', 'Quintuplets'],
  ['4', '16th notes'],
  ['3', 'Triplets'],
  ['2', '8th notes'],
  ['1', 'Quarter notes'],
] as const;

function SubDivsRow() {
  const { subDivs, setSubDivs } = useApp();

  return (
    <div className="flex w-full items-center gap-2">
      <Select
        value={String(subDivs)}
        onValueChange={raw => {
          const value = int(raw);
          setSubDivs(value);
          sendEvent('set_subdivs', 'App', value, value);
        }}
      >
        <SelectTrigger aria-label="Subdivisions" className="h-14 min-w-0 flex-1 text-base sm:h-12 pointer-fine:px-2 pointer-fine:text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUBDIVISION_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <StepButtons
        onIncrement={() => {
          if (subDivs >= 8) return;
          const next = subDivs + 1;
          setSubDivs(next);
          sendEvent('set_subdivs', 'App', 'step_up');
        }}
        onDecrement={() => {
          if (subDivs <= 1) return;
          const next = subDivs - 1;
          setSubDivs(next);
          sendEvent('set_subdivs', 'App', 'step_down');
        }}
        disableIncrement={subDivs >= 8}
        disableDecrement={subDivs <= 1}
        incrementLabel="Increase subdivisions"
        decrementLabel="Decrease subdivisions"
      />
    </div>
  );
}

function SwingControls() {
  const { playSubDivs, subDivs, swingEnabled, swing, setSwing } = useApp();
  const canSwing = subDivs % 2 === 0;

  const [editingSwing, setEditingSwing] = useState(false);
  const cancelSwingEditRef = useRef(false);
  const swingInputRef = useRef<HTMLInputElement | null>(null);

  const commitSwingInput = (rawValue: NumberInput) => {
    const next = validSwing(float(rawValue), swing);
    setSwing(next);
    setEditingSwing(false);
    sendOneEvent('update_swing', '', next, next);
  };

  useEffect(() => {
    if (!playSubDivs || !swingEnabled || !canSwing) {
      setEditingSwing(false);
    }
  }, [playSubDivs, swingEnabled, canSwing]);

  useEffect(() => {
    if (editingSwing && swingInputRef.current) {
      cancelSwingEditRef.current = false;
      swingInputRef.current.value = formatSwing(swing);
      swingInputRef.current.focus();
      swingInputRef.current.select();
    }
  }, [editingSwing, swing]);

  if (!swingEnabled) return null;

  return (
    <div className="pt-4! pb-0!">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <div className="flex items-center gap-2 text-lg leading-none text-slate-500 pointer-fine:text-base [&_*]:[text-box:trim-both_cap_alphabetic]">
            <span>Swing:</span>
            <div className="flex items-center gap-1.5">
              {editingSwing ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 border-b border-dotted border-slate-500',
                    'pb-px leading-none text-slate-600',
                  )}
                >
                  <input
                    ref={swingInputRef}
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    defaultValue={formatSwing(swing)}
                    className={cn('w-14 bg-transparent text-right leading-none', 'outline-none')}
                    onBlur={event => {
                      if (cancelSwingEditRef.current) {
                        cancelSwingEditRef.current = false;
                        return;
                      }
                      commitSwingInput(event.target.value);
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        cancelSwingEditRef.current = true;
                        setEditingSwing(false);
                      }
                    }}
                  />
                  <span>%</span>
                </span>
              ) : (
                <button
                  type="button"
                  className={cn(
                    'border-b border-dotted border-slate-500 pb-px leading-none',
                    'text-slate-600',
                  )}
                  disabled={!canSwing}
                  onClick={() => setEditingSwing(true)}
                >
                  {formatSwing(swing)}%
                </button>
              )}
              {/* Always laid out, so the row doesn't shift when it appears. */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  '-my-1 size-5 rounded-full p-0 text-slate-500 hover:text-slate-700',
                  !(canSwing && !editingSwing && swing > 0) && 'invisible',
                )}
                aria-label="Reset swing to 0"
                onClick={() => {
                  setSwing(0);
                  sendOneEvent('update_swing', '', 0, 0);
                }}
              >
                <X className="size-3" />
              </Button>
            </div>
          </div>
          {!canSwing && <div className="text-xs text-slate-500 pointer-fine:text-px-11">even sub divs only</div>}
        </div>
        <div className="min-w-0 flex-1 pl-3 pr-6">
          <Range
            min={0}
            max={50}
            step={1}
            value={Math.min(50, swing)}
            onDrag={value => {
              const next = validSwing(float(value), swing);
              setSwing(next);
              sendOneEvent('update_swing', '', next, next);
            }}
            disabled={!canSwing}
            ticks={[0, 15, 33, 50]}
            slim
          />
        </div>
        <div className="relative -top-0.5">
          <StepButtons
            onIncrement={() => {
              if (!canSwing || swing >= 100) return;
              const next = Math.min(100, float(swing) + 1);
              setSwing(next);
              sendEvent('set_swing', 'App', 'step_up');
            }}
            onDecrement={() => {
              if (!canSwing || swing <= 0) return;
              const next = Math.max(0, float(swing) - 1);
              setSwing(next);
              sendEvent('set_swing', 'App', 'step_down');
            }}
            disableIncrement={!canSwing || swing >= 100}
            disableDecrement={!canSwing || swing <= 0}
            incrementLabel="Increase swing"
            decrementLabel="Decrease swing"
          />
        </div>
      </div>
    </div>
  );
}

export function BeatControls() {
  const { playSubDivs, swingEnabled } = useApp();

  return (
    <div className="contents *:mx-4 *:w-auto! *:self-stretch">
      <PlaySubDivsRow />
      <RowGap />
      <BeatsRow />
      {playSubDivs && (
        <>
          <RowGap />
          <SubDivsRow />
          {swingEnabled && <RowGap />}
          <SwingControls />
        </>
      )}
    </div>
  );
}
