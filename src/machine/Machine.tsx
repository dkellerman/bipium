import { ListenControl } from '@/components/ListenControl';
/*
 * Machine UI — hardware drum-machine interface served at /machine.
 * Green LCD readout, chunky mechanical keys with hard shadows, mono type.
 * Self-contained in src/machine/; the classic UI never imports from here.
 */
import { useEffect, useRef, useState } from 'react';
import { Drum, Eraser, Menu, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '@/AppContext';
import { SOUND_PACKS } from '@/hooks';
import { cn } from '@/lib/utils';
import {
  BpmEditable,
  MachineRange,
  SUBDIV_OPTIONS,
  VisualizerCore,
  subdivShort,
  useTapTempo,
  useViewport,
  type MachineProps,
} from './shared';

const RANGE_LCD = '[--track:#173420] [--fill:#6cf59a] [--thumb:#6cf59a]';
const RANGE_PANEL = '[--track:#b8b2a0] [--fill:#1c1917] [--thumb:#1c1917]';
const BPM_TICKS = [50, 80, 100, 120, 140, 160, 180, 200, 220, 240, 320];
const SWING_TICKS = [15, 33, 50];

const SOUND_PACK_LABELS: Record<string, string> = {
  defaults: 'Beeps',
  drumkit: 'Drum Kit',
};

function packLabel(key: string) {
  const named = SOUND_PACKS[key]?.name;
  return SOUND_PACK_LABELS[key] ?? (typeof named === 'string' ? named : key);
}

function Key({
  onClick,
  onPointerDown,
  label,
  active = false,
  disabled = false,
  className,
  children,
}: {
  onClick?: () => void;
  onPointerDown?: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        'h-14 rounded-md border-[3px] border-stone-900 text-[15px] font-bold uppercase',
        'shadow-[3px_3px_0_#1c1917] transition-[transform,box-shadow,background-color] duration-75',
        'active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_#1c1917]',
        'disabled:opacity-40',
        active ? 'bg-yellow-300' : 'bg-[#f6f3ea]',
        className,
      )}
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      {children}
    </button>
  );
}

export function Machine({ extras }: MachineProps) {
  const app = useApp();
  const tap = useTapTempo();
  const { width: vw } = useViewport();

  const isDrum = extras.renderedVisualizerMode === 'drumLoop';
  const canSwing = app.subDivs % 2 === 0;
  const vizWidth = Math.min(vw, 480) - 30;

  // The screen fills whatever faceplate space the controls leave over: measure
  // the flex-1 slot and size the pixi canvas to it (capped so desktop doesn't
  // get a comically tall screen; leftover then centers evenly around it).
  const vizBoxRef = useRef<HTMLDivElement | null>(null);
  const [vizHeight, setVizHeight] = useState(160);

  // The subdiv strip stays open (showing "1" when subdivisions are off) until
  // the Subdivs key collapses it; collapsed, the visualizer takes the space.
  const [stripOpen, setStripOpen] = useState(app.playSubDivs);

  useEffect(() => {
    const el = vizBoxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const slot = Math.floor(el.getBoundingClientRect().height);
      // Leave ~30px of faceplate visible around the screen; centering the
      // frame splits it evenly above and below so it reads as a screen bay.
      setVizHeight(Math.max(80, Math.min(340, slot - 30)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <main className="fixed inset-0 flex justify-center overflow-hidden bg-[#d8d3c4] font-mono text-stone-900">
      <div className="flex h-full w-full max-w-[480px] flex-col gap-2 px-3 pb-[max(env(safe-area-inset-bottom),14px)] pt-2.5">
        {/* faceplate header */}
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[16px] font-bold tracking-[0.3em]">BIPIUM</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label={`Change sounds (current: ${packLabel(app.soundPack)})`}
              title="Change sounds"
              className={cn(
                'h-10 rounded-md border-[3px] border-stone-900 bg-[#f6f3ea] px-2.5',
                'text-[10px] font-bold uppercase tracking-wider',
                'shadow-[2px_2px_0_#1c1917] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1c1917]',
              )}
              onClick={() => {
                const keys = Object.keys(SOUND_PACKS);
                const next = keys[(keys.indexOf(app.soundPack) + 1) % keys.length];
                app.setSoundPack(next);
              }}
            >
              {packLabel(app.soundPack)}
            </button>
            <ListenControl variant="machine" />
            <button
              type="button"
              aria-label="Open menu"
              className={cn(
                'grid size-10 place-items-center rounded-md border-[3px] border-stone-900 bg-[#f6f3ea]',
                'shadow-[2px_2px_0_#1c1917] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1c1917]',
              )}
              onClick={() => app.setShowSideBar(true)}
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>

        <div id="voice-text-machine" className="shrink-0 text-stone-700" />

        {/* LCD */}
        <div className="rounded-lg border-[3px] border-stone-900 bg-[#0d2113] px-4 pb-1.5 pt-2 shadow-[5px_5px_0_#1c1917]">
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <BpmEditable
                displayClassName={cn(
                  'text-[54px] font-bold leading-none tabular-nums text-[#6cf59a]',
                  '[text-shadow:0_0_14px_rgba(108,245,154,0.55)]',
                )}
                inputClassName="w-[140px] text-[54px] font-bold leading-none text-[#6cf59a]"
              />
              <span className="text-xs font-bold text-[#6cf59a]/70">BPM</span>
            </div>
            <div className="pb-1 text-right text-[11px] font-bold uppercase leading-4 text-[#6cf59a]/80">
              <div>{app.beats} beats</div>
              <div>{app.playSubDivs ? `subdivs ${subdivShort(app.subDivs)}` : 'no subdivs'}</div>
              <div>{app.swingEnabled && canSwing ? `swing ${app.swing}%` : 'swing off'}</div>
            </div>
          </div>
          <MachineRange
            label="BPM"
            min={20}
            max={320}
            value={app.bpm}
            onChange={value => app.updateBPM(value)}
            className={RANGE_LCD}
            ticks={BPM_TICKS}
            labelRotation={-60}
            tickClassName="text-[#6cf59a]/80 hover:text-[#6cf59a]"
            tickLineClassName="bg-[#6cf59a]"
          />
        </div>

        {/* tempo row */}
        <div className="grid grid-cols-4 gap-2">
          <Key label="Decrease BPM" onClick={() => app.updateBPM(app.bpm - 1)} className="text-xl">
            −
          </Key>
          <Key label="Increase BPM" onClick={() => app.updateBPM(app.bpm + 1)} className="text-xl">
            +
          </Key>
          <Key label="Tap tempo" onPointerDown={tap} className="col-span-2 bg-[#ffd76a]">
            Tap
          </Key>
        </div>

        {/* rhythm row */}
        <div className="grid grid-cols-4 gap-2">
          <Key label="Decrease beats" onClick={() => app.setBeats(Math.max(1, app.beats - 1))}>
            Beats −
          </Key>
          <Key label="Increase beats" onClick={() => app.setBeats(Math.min(12, app.beats + 1))}>
            Beats +
          </Key>
          <Key
            label="Toggle subdivisions"
            active={app.playSubDivs}
            onClick={() => {
              // The key toggles the strip; collapsing always lands on "off",
              // even from the "1" (already off) position.
              const opening = !stripOpen;
              setStripOpen(opening);
              if (opening) {
                app.setPlaySubDivsWithTracking(true);
                // Opening always lands on a real division (1 means "off").
                if (app.subDivs < 2) app.setSubDivs(2);
              } else {
                if (app.playSubDivs) app.setPlaySubDivsWithTracking(false);
                // Swing must never re-arm itself; it only turns on by its own key.
                if (app.swingEnabled) app.setSwingEnabledWithRestore(false);
              }
            }}
            className="text-[13px]"
          >
            Subdivs
          </Key>
          <Key
            label="Toggle swing"
            active={app.swingEnabled && app.playSubDivs}
            disabled={!app.playSubDivs || !canSwing}
            onClick={() => app.setSwingEnabledWithRestore(!app.swingEnabled)}
            className="text-[13px]"
          >
            Swing
          </Key>
        </div>

        {/* subdiv strip: shown while open, in its own row; the Subdivs key
            collapses it and the visualizer below expands into the space. The
            row hugs its content so the column's gap stays even. */}
        {stripOpen && (
          <div className="flex shrink-0 items-center gap-2">
            <>
              <div className="flex min-w-0 flex-1 gap-1">
                {SUBDIV_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={option.label}
                    title={option.label}
                    className={cn(
                      'h-11 min-w-0 flex-1 rounded border-2 border-stone-900 text-[13px] font-bold',
                      'shadow-[2px_2px_0_#1c1917] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1c1917]',
                      (app.playSubDivs ? app.subDivs : 1) === option.value
                        ? 'bg-stone-900 text-[#6cf59a]'
                        : 'bg-[#f6f3ea]',
                    )}
                    onClick={() => {
                      if (option.value === 1) {
                        // 1 is the same as off: unlatch subdivisions entirely.
                        app.setSubDivs(1);
                        app.setPlaySubDivsWithTracking(false);
                        if (app.swingEnabled) app.setSwingEnabledWithRestore(false);
                        return;
                      }
                      // Odd divisions suspend swing (it resumes on an even
                      // division); only explicit offs clear swingEnabled.
                      app.setSubDivs(option.value);
                      if (!app.playSubDivs) app.setPlaySubDivsWithTracking(true);
                    }}
                  >
                    {option.short}
                  </button>
                ))}
              </div>
              {app.playSubDivs && app.swingEnabled && canSwing && (
                <div className="flex w-[150px] shrink-0 items-start gap-1.5">
                  <MachineRange
                    label="Swing"
                    min={0}
                    max={50}
                    value={app.swing}
                    onChange={value => {
                      // Dragging to zero is the same as turning swing off.
                      if (value === 0) app.setSwingEnabledWithRestore(false);
                      else app.setSwing(value);
                    }}
                    className={RANGE_PANEL}
                    ticks={SWING_TICKS}
                    labelRotation={-60}
                    tickClassName="text-stone-700 hover:text-stone-900"
                    tickLineClassName="bg-stone-700"
                  />
                  <span className="mt-3.5 w-9 shrink-0 text-right text-xs font-bold tabular-nums">
                    {app.swing}%
                  </span>
                </div>
              )}
            </>
          </div>
        )}

        {/* visualizer screen — fills whatever faceplate space is left */}
        <div ref={vizBoxRef} className="flex min-h-[104px] flex-1 items-center justify-center">
          <div className="relative overflow-hidden rounded border-[3px] border-stone-900 shadow-[3px_3px_0_#1c1917,0_3px_0_#1c1917,3px_0_0_#1c1917]">
            <VisualizerCore width={vizWidth} height={vizHeight} extras={extras} />
            <div className="absolute right-1 top-1 z-30 flex gap-1">
              {isDrum && (
                <button
                  type="button"
                  aria-label="Clear drum loop"
                  className="grid size-8 place-items-center rounded border-2 border-[#6cf59a]/60 bg-black/70 text-[#6cf59a]"
                  onClick={extras.clearDrumLoopPattern}
                >
                  <Eraser className="size-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={isDrum ? 'Switch to standard visualizer' : 'Switch to drum loop mode'}
                aria-pressed={isDrum}
                className={cn(
                  'grid size-8 place-items-center rounded border-2 bg-black/70',
                  isDrum ? 'border-[#6cf59a] text-[#6cf59a]' : 'border-white/40 text-white/80',
                )}
                onClick={extras.toggleVisualizerMode}
              >
                <Drum className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* transport row */}
        <div className="grid grid-cols-1 gap-2">
          {!app.started ? (
            <Key
              label="Start"
              onClick={extras.start}
              className="h-16 bg-[#e5484d] text-xl tracking-[0.2em] text-white"
            >
              Start
            </Key>
          ) : (
            <Key
              label="Stop"
              onClick={extras.stopAll}
              className="h-16 bg-[#ffd76a] text-xl tracking-[0.2em] text-stone-900"
            >
              Stop
            </Key>
          )}
        </div>

        {/* volume strip */}
        <div className="mt-2 flex items-center gap-3 px-1">
          <button
            type="button"
            aria-label={app.muted ? 'Unmute' : 'Mute'}
            aria-pressed={app.muted}
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-md border-[3px] border-stone-900',
              'shadow-[2px_2px_0_#1c1917] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1c1917]',
              app.muted ? 'bg-yellow-300' : 'bg-[#f6f3ea]',
            )}
            onClick={() => app.setMuted(value => !value)}
          >
            {app.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
          <MachineRange
            label="Volume"
            min={0}
            max={100}
            value={app.volume}
            onChange={value => app.setVolume(Math.round(value))}
            className={cn(RANGE_PANEL, 'h-8')}
          />
        </div>
      </div>
    </main>
  );
}
