import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Range } from './Range';
import { StepButtons } from './StepButtons';
import { useTapBPM } from '@/hooks';
import { useApp } from '@/AppContext';
import { cn, isEditableEventTarget } from '@/lib/utils';
import { sendEvent, sendOneEvent } from '@/tracking';
import type { NumberInput } from '@/types';

const bpmMin = 20.0;
const bpmMax = 320.0;

const float = (value: NumberInput) => {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const validBpm = (value: number) => {
  return Math.max(Math.min(bpmMax, value || 80), bpmMin);
};

export function BPMControls() {
  const { bpm, updateBPM, clicker, started, setStarted } = useApp();
  const [editingBPM, setEditingBPM] = useState(false);
  const {
    bpm: tappedBPM,
    confidence: tapConfidence,
    handleTap,
    reset: resetTap,
    lastTapAt,
    lastInterval,
  } = useTapBPM(bpm);
  const bpmRef = useRef<HTMLInputElement | null>(null);
  const tapStartThreshold = 0.8;
  const tapStartTimeoutRef = useRef<number | null>(null);

  const setBpm = (value: number) => {
    updateBPM(validBpm(float(value)));
  };

  useEffect(() => {
    setBpm(validBpm(float(tappedBPM) || bpm));
  }, [tappedBPM]);

  useEffect(() => {
    if (!started && tapConfidence >= tapStartThreshold) {
      const interval = lastInterval ?? 0;
      const tapAt = lastTapAt ?? 0;
      const now = Date.now();
      const delay = interval > 0 ? Math.max(0, interval - (now - tapAt)) : 0;
      if (tapStartTimeoutRef.current) {
        window.clearTimeout(tapStartTimeoutRef.current);
      }
      tapStartTimeoutRef.current = window.setTimeout(() => {
        setStarted(true);
        sendEvent('tap_auto_start', 'BPMControls', tapConfidence, 1);
        resetTap();
        tapStartTimeoutRef.current = null;
      }, delay);
    }
  }, [started, tapConfidence, setStarted, resetTap, lastInterval, lastTapAt]);

  useEffect(() => {
    if (started && tapStartTimeoutRef.current) {
      window.clearTimeout(tapStartTimeoutRef.current);
      tapStartTimeoutRef.current = null;
    }
  }, [started]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) return;
      if (event.key.toLowerCase() === 't') {
        handleTap();
        clicker?.click();
        sendOneEvent('tap');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTap, clicker]);

  useEffect(() => {
    if (editingBPM && bpmRef.current) {
      bpmRef.current.value = String(bpm);
      bpmRef.current.focus();
      bpmRef.current.select();
    }
  }, [editingBPM]);

  return (
    <div className="space-y-1 p-2.5 pb-0">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-1">
        <Button
          type="button"
          variant="outline"
          className="size-20 rounded-full p-0 text-2xl"
          title="Tap tempo"
          aria-label="Tap tempo"
          onClick={() => handleTap()}
          onMouseDown={() => {
            clicker.click();
            sendOneEvent('tap');
          }}
        >
          Tap
        </Button>

        <div className="flex justify-center">
          {editingBPM ? (
            <input
              ref={bpmRef}
              type="number"
              min={bpmMin}
              max={bpmMax}
              defaultValue={bpm}
              size={5}
              className={cn(
                'h-10 w-[140px] border-b border-dotted border-slate-500 bg-transparent px-1',
                'text-center text-4xl leading-none outline-none',
              )}
              onBlur={event => {
                const target = event.target as HTMLInputElement;
                setBpm(validBpm(float(target.value) || bpm));
                setEditingBPM(false);
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  const target = event.target as HTMLInputElement;
                  setBpm(validBpm(float(target.value) || bpm));
                  setEditingBPM(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className={cn(
                'whitespace-nowrap border-b border-dotted border-slate-500',
                'text-4xl leading-none',
              )}
              onClick={() => {
                setEditingBPM(true);
                sendEvent('edit_bpm');
              }}
            >
              {bpm} BPM
            </button>
          )}
        </div>

        <StepButtons
          onIncrement={() => {
            if (bpm >= 300) return;
            setBpm(bpm + 1);
          }}
          onDecrement={() => {
            if (bpm <= 20) return;
            setBpm(bpm - 1);
          }}
          disableIncrement={bpm >= 300}
          disableDecrement={bpm <= 20}
          incrementLabel="Increase BPM"
          decrementLabel="Decrease BPM"
        />
      </div>

      <div className="-mb-1 px-5">
        <Range
          min={bpmMin}
          max={bpmMax}
          step={1}
          value={bpm}
          onDrag={value => {
            setBpm(validBpm(value));
          }}
          labelRotation={-60}
          tickClassName="text-[19px] sm:text-[18px]"
          ticks={[50, 80, 100, 120, 140, 160, 180, 200, 220, 240, bpmMax]}
        />
      </div>
    </div>
  );
}
