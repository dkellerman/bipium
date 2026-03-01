import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Range } from './Range';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { sendOneEvent } from '@/tracking';
import type { NumberInput } from '@/types';

interface VolumeControlProps {
  compact?: boolean;
}

const int = (value: NumberInput) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function VolumeControl({ compact = false }: VolumeControlProps) {
  const { muted, setMuted, volume, setVolume } = useApp();
  const VolumeIcon = muted ? VolumeX : Volume2;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => {
            setMuted(value => !value);
            sendOneEvent(`set_mute_${muted ? 'off' : 'on'}`);
          }}
        >
          <VolumeIcon className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <Range
            min={0}
            max={100}
            step={1}
            value={volume}
            onDrag={value => {
              setVolume(int(value));
              sendOneEvent('set_volume', '', value, int(value));
            }}
          />
        </div>
      </div>
    );
  }

  const [showVolume, setShowVolume] = useState(false);
  const volumeControlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showVolume) return;

    const onPointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node | null;
      if (volumeControlRef.current && targetNode && !volumeControlRef.current.contains(targetNode)) {
        setShowVolume(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [showVolume]);

  return (
    <div className="mt-2 flex w-full justify-center">
      <div
        ref={volumeControlRef}
        className="relative h-12 w-[352px] max-w-[calc(100%-36px)]"
        onMouseLeave={() => setShowVolume(false)}
      >
        <div
          className={cn(
            'pointer-events-none absolute left-1/2 top-1/2 w-full',
            '-translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full',
            'border border-slate-300 bg-white px-3 shadow-sm transition-all duration-200',
            showVolume ? 'pointer-events-auto scale-x-100 opacity-100' : 'scale-x-0 opacity-0',
          )}
          style={{ transformOrigin: 'center center' }}
        >
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 rounded-full"
              aria-label={muted ? 'Unmute' : 'Mute'}
              onClick={() => {
                setMuted(value => !value);
                sendOneEvent(`mute_${muted ? 'off' : 'on'}`);
              }}
            >
              <VolumeIcon className="size-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <Range
                min={0}
                max={100}
                step={1}
                value={volume}
                onDrag={value => {
                  setVolume(int(value));
                  sendOneEvent('set_volume', '', value, int(value));
                }}
              />
            </div>
          </div>
        </div>

        {!showVolume && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(
              'absolute left-1/2 top-1/2 size-11 -translate-x-1/2 -translate-y-1/2',
              'rounded-full bg-white p-[8.8px] shadow-md',
            )}
            aria-label="Show volume controls"
            onMouseEnter={() => setShowVolume(true)}
            onFocus={() => setShowVolume(true)}
            onClick={() => setShowVolume(true)}
          >
            <VolumeIcon className="size-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
