import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Range } from './Range';
import { StepButtons } from './StepButtons';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { sendEvent, sendOneEvent } from '@/tracking';
import type { NumberInput } from '@/types';

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
  const {
    playSubDivs,
    setPlaySubDivsWithTracking,
    swingEnabled,
    setSwingEnabledWithRestore,
  } = useApp();

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
          <Switch checked={playSubDivs} onCheckedChange={value => setPlaySubDivsWithTracking(value)} />
        </div>
        <label className="cursor-pointer text-lg leading-none">Play sub divs</label>
        {playSubDivs && (
          <div className="ml-4 flex items-center gap-1.5" onClick={event => event.stopPropagation()}>
            <Switch
              checked={swingEnabled}
              onCheckedChange={value => setSwingEnabledWithRestore(value)}
            />
            <span className="text-lg leading-none">Swing</span>
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
        <label className="text-base leading-none">Beats:</label>
        <select
          className={cn(
            'h-11 min-w-16 rounded-md border border-slate-300 bg-white px-2',
            'text-xl leading-none outline-none',
          )}
          value={beats}
          onChange={event => {
            const value = int(event.target.value);
            setBeats(value);
            sendEvent('set_beats', 'App', value, value);
          }}
        >
          {new Array(12).fill(0).map((_, index) => (
            <option key={`beats-${index + 1}`} value={index + 1}>
              {index + 1}
            </option>
          ))}
        </select>
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
      />
    </div>
  );
}

function SubDivsRow() {
  const { subDivs, setSubDivs } = useApp();

  return (
    <div className="flex w-full items-center gap-2">
      <select
        className={cn(
          'h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3',
          'text-base outline-none',
        )}
        value={subDivs}
        onChange={event => {
          const value = int(event.target.value);
          setSubDivs(value);
          sendEvent('set_subdivs', 'App', value, value);
        }}
      >
        <option value="8">32nd notes</option>
        <option value="7">Septuplets</option>
        <option value="6">Sextuplets</option>
        <option value="5">Quintuplets</option>
        <option value="4">16th notes</option>
        <option value="3">Triplets</option>
        <option value="2">8th notes</option>
        <option value="1">Quarter notes</option>
      </select>
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
    <div className="pt-1">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg leading-none text-slate-500">
            <span>Swing:</span>
            <div className="flex items-center gap-1.5">
              {!canSwing ? (
                <span className="text-slate-500">even sub divs only</span>
              ) : editingSwing ? (
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
              {canSwing && !editingSwing && swing > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-5 rounded-full p-0 text-slate-500 hover:text-slate-700"
                  aria-label="Reset swing to 0"
                  onClick={() => {
                    setSwing(0);
                    sendOneEvent('update_swing', '', 0, 0);
                  }}
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
          </div>
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
          />
        </div>

        <div className="w-full pl-4 pr-0">
          <Range
            min={0}
            max={100}
            step={1}
            value={swing}
            onDrag={value => {
              const next = validSwing(float(value), swing);
              setSwing(next);
              sendOneEvent('update_swing', '', next, next);
            }}
            disabled={!canSwing}
            ticks={[0, 15, 33, 50]}
          />
        </div>
      </div>
    </div>
  );
}

export function BeatControls() {
  const { playSubDivs } = useApp();

  return (
    <div className="space-y-4 px-2 pt-2 pb-0">
      <PlaySubDivsRow />
      <BeatsRow />
      {playSubDivs && (
        <>
          <SubDivsRow />
          <SwingControls />
        </>
      )}
    </div>
  );
}
