/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import qs from 'query-string';
import copyToClipboard from 'copy-to-clipboard';
import { Link } from 'react-router-dom';
import localStorage from 'local-storage-fallback';
import { AudioContext } from 'standardized-audio-context';
import { Settings, Volume2, VolumeX, X } from 'lucide-react';
import { DefaultVisualizer } from './DefaultVisualizer';
import { useTapBPM, useSetting, useClicker, useMetronome, SOUND_PACKS } from './hooks';
import { NavBar } from './NavBar';
import { Range } from './Range';
import { sendEvent, sendOneEvent, sendFrameRate } from './tracking';
import { Button } from './components/ui/button';
import { Card, CardContent } from './components/ui/card';
import { Separator } from './components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './components/ui/sheet';
import { Switch } from './components/ui/switch';
import { BIPIUM_API_DEFAULT_CONFIG, createBipiumRuntimeApi } from './lib/api';
import { cn } from './lib/utils';
import type {
  BipiumApiConfig,
  BooleanInput,
  ClickerInstance,
  NumberInput,
  StateSetter,
} from './types';

type NumberConverter = (value: NumberInput) => number;
type StepSetter = StateSetter<number>;

interface StepButtonsProps {
  val: number;
  setter: StepSetter;
  min: number;
  max: number;
  step?: number;
  conv?: NumberConverter;
  disabled?: boolean;
  event?: string | null;
  className?: string;
}

interface BPMAreaProps {
  clicker: ClickerInstance;
  onChange?: (value: number) => void;
  className?: string;
}

interface ConfigurationQuery {
  bpm: number;
  beats: number;
  playSubDivs: boolean;
  swing?: number;
  subDivs?: number;
  soundPack?: string;
}

const int: NumberConverter = value => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const float: NumberConverter = value => {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const bool = (value: BooleanInput) =>
  (value && [true, 1, '1', 'true', 't'].includes(value)) || false;

const bpmMin = 20.0;
const bpmMax = 320.0;
const bpmDefault = 80.0;
const validBpm = (val: number) => Math.max(Math.min(bpmMax, val || bpmDefault), bpmMin);
const validSwing = (val: NumberInput, fallback = 0) => {
  const fallbackNum = Number(fallback);
  const base = Number.isFinite(fallbackNum) ? fallbackNum : 0;
  const n = Number(val);
  if (!Number.isFinite(n)) return Math.max(0, Math.min(100, base));
  return Math.max(0, Math.min(100, n));
};
const formatSwing = (val: number) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? `${n}` : `${Number(n.toFixed(2))}`;
};
const buildSha = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || '';
const panelClass = 'mt-2 w-[calc(100%-1rem)]';

function App() {
  const queryParams = qs.parse(window.location.search);
  const hasUrlParams = Object.keys(queryParams).length > 0;
  const hasSwingParam = Object.prototype.hasOwnProperty.call(queryParams, 'swing');
  const swingFromUrl = validSwing(float(queryParams.swing as NumberInput), 0);

  const bpm = useRef<number>(bpmDefault);
  const [beats, setBeats] = useSetting('beats', 4, int);
  const [subDivs, setSubDivs] = useSetting('subDivs', 1, int);
  const [swing, setSwing] = useSetting('swing', 0, float);
  const [swingEnabled, setSwingEnabled] = useSetting('swingEnabled', false, bool);
  const [playSubDivs, setPlaySubDivs] = useSetting('playSubDivs', true, bool);
  const [volume, setVolume] = useSetting('volume', 35, int, localStorage);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const [soundPack, setSoundPack] = useSetting('soundPack', 'drumkit', String);
  const [visualizers] = useSetting<string[]>('visualizers', ['default'], val => {
    if (Array.isArray(val)) return val.map(String);
    return String(val).split(',');
  });

  const [showSideBar, setShowSideBar] = useState(false);
  const [copiedURL, setCopiedURL] = useState<string | null>(null);
  const [showVolume, setShowVolume] = useState(false);
  const [editingSwing, setEditingSwing] = useState(false);
  const cancelSwingEditRef = useRef(false);
  const previousSwingRef = useRef(swing || 0);
  const swingInputRef = useRef<HTMLInputElement | null>(null);
  const volumeControlRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 390,
  );
  const [, _update] = useState(false);
  const forceRender = () => _update(x => !x);

  const audioContext = useRef(new AudioContext());
  const beatsRef = useRef(beats);
  const subDivsRef = useRef(subDivs);
  const playSubDivsRef = useRef(playSubDivs);
  const swingRef = useRef(swing);
  const soundPackRef = useRef(soundPack);
  const volumeRef = useRef(volume);
  const startedRef = useRef(started);

  beatsRef.current = beats;
  subDivsRef.current = subDivs;
  playSubDivsRef.current = playSubDivs;
  swingRef.current = swing;
  soundPackRef.current = soundPack;
  volumeRef.current = volume;
  startedRef.current = started;

  const canSwing = subDivs % 2 === 0;
  const swingActive = playSubDivs && canSwing && swingEnabled;
  const visualizerWidth = Math.max(272, Math.min(450, viewportWidth - 30));
  const visualizerHeight = 100;

  const clicker = useClicker({
    audioContext: audioContext.current,
    volume,
    sounds: SOUND_PACKS[soundPack],
  });

  const m = useMetronome({
    timerFn: () => audioContext.current.currentTime,
    clicker,
    bpm: bpm.current,
    beats,
    subDivs: playSubDivs ? subDivs : 1,
    swing: swingActive ? swing : 0,
    workerUrl: '/dist/worker.min.js',
  });

  const start = useCallback(() => {
    setStarted(true);
  }, []);

  const stop = useCallback(() => {
    setStarted(false);
  }, []);

  const toggle = useCallback(() => {
    setStarted(s => !s);
  }, []);

  const setSwingEnabledWithRestore = useCallback(
    (val: boolean) => {
      if (!val) {
        previousSwingRef.current = swing;
        setSwingEnabled(false);
        setSwing(0);
        sendEvent('set_swing_enabled', 'App', false, 0);
        return;
      }

      setSwingEnabled(true);
      setSwing(previousSwingRef.current > 0 ? previousSwingRef.current : 33);
      sendEvent('set_swing_enabled', 'App', true, 1);
    },
    [swing],
  );

  const setPlaySubDivsWithTracking = useCallback((val: boolean) => {
    setPlaySubDivs(val);
    sendEvent('set_play_subdivs', 'App', val, val ? 1 : 0);
  }, []);

  const commitSwingInput = useCallback(
    (rawValue: NumberInput) => {
      const next = validSwing(float(rawValue), swing);
      setSwing(next);
      setEditingSwing(false);
      sendOneEvent('update_swing', '', next, next);
    },
    [swing],
  );

  useEffect(() => {
    if (clicker) clicker.setVolume(muted ? 0 : volume);
  }, [volume, muted]);

  useEffect(() => {
    if (window.location.search.indexOf('?reset') === 0) window.location.replace(`/`);
  }, []);

  useEffect(() => {
    m.update({
      subDivs: playSubDivs ? subDivs : 1,
      swing: swingActive ? swing : 0,
      beats,
      bpm: bpm.current,
    });
    forceRender();
  }, [playSubDivs, subDivs, swing, swingEnabled, canSwing, beats, m.started]);

  const updateBPM = React.useCallback((val: number) => {
    bpm.current = val;
    if (m.started) {
      m.update({ bpm: val });
    }
  }, []);

  const getApiConfig = useCallback(
    (): BipiumApiConfig => ({
      bpm: bpm.current,
      beats: beatsRef.current,
      subDivs: subDivsRef.current,
      playSubDivs: playSubDivsRef.current,
      swing: swingRef.current,
      soundPack: soundPackRef.current,
      volume: volumeRef.current,
    }),
    [],
  );

  const applyApiConfig = useCallback(
    (next: BipiumApiConfig) => {
      const normalized: BipiumApiConfig = {
        ...BIPIUM_API_DEFAULT_CONFIG,
        ...next,
      };

      updateBPM(normalized.bpm);
      setBeats(int(normalized.beats));
      setPlaySubDivs(Boolean(normalized.playSubDivs));
      setSubDivs(int(normalized.subDivs));
      setSwing(validSwing(normalized.swing, 0));
      setSwingEnabled(normalized.swing > 0);
      previousSwingRef.current = normalized.swing > 0 ? normalized.swing : 0;
      setSoundPack(normalized.soundPack);
      setVolume(int(normalized.volume));
    },
    [updateBPM],
  );

  useEffect(() => {
    const runtime = createBipiumRuntimeApi({
      getConfig: getApiConfig,
      applyConfig: applyApiConfig,
      startPlayback: () => {
        setStarted(true);
      },
      stopPlayback: () => {
        setStarted(false);
      },
      togglePlayback: () => {
        const next = !startedRef.current;
        setStarted(next);
        return next;
      },
      isPlaying: () => startedRef.current,
      tap: () => {
        clicker.click();
      },
      now: () => audioContext.current.currentTime,
      getSoundPacks: () => Object.keys(SOUND_PACKS),
    });

    window.bpm = runtime;

    return () => {
      if (window.bpm === runtime) {
        delete window.bpm;
      }
    };
  }, [applyApiConfig, clicker, getApiConfig]);

  useEffect(() => {
    clicker.setSounds(SOUND_PACKS[soundPack || 'defaults']);
  }, [soundPack]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSideBar(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!started) {
      m?.stop();
      sendFrameRate();
    } else {
      m?.start();
    }
    forceRender();

    return () => {
      m?.stop();
    };
  }, [started]);

  useEffect(() => {
    if (showSideBar) {
      setCopiedURL(null);
    }
  }, [showSideBar]);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!showVolume) return;

    const onPointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node | null;
      if (
        volumeControlRef.current &&
        targetNode &&
        !volumeControlRef.current.contains(targetNode)
      ) {
        setShowVolume(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [showVolume]);

  useEffect(() => {
    if (!playSubDivs || !swingEnabled || !canSwing) {
      setEditingSwing(false);
    }
  }, [playSubDivs, swingEnabled, canSwing]);

  useEffect(() => {
    if (!hasUrlParams) return;

    if (hasSwingParam && swingFromUrl > 0) {
      setSwing(swingFromUrl);
      setSwingEnabled(true);
      previousSwingRef.current = swingFromUrl;
      return;
    }

    setSwing(0);
    setSwingEnabled(false);
    previousSwingRef.current = 0;
  }, []);

  useEffect(() => {
    if (editingSwing && swingInputRef.current) {
      cancelSwingEditRef.current = false;
      swingInputRef.current.value = formatSwing(swing);
      swingInputRef.current.focus();
      swingInputRef.current.select();
    }
  }, [editingSwing, swing]);

  const copyConfigurationURL = useCallback(() => {
    const q: ConfigurationQuery = { bpm: bpm.current, beats, playSubDivs };
    if (playSubDivs) {
      q.swing = swingActive ? swing : 0;
      q.subDivs = subDivs;
    }
    if (soundPack !== 'defaults') {
      q.soundPack = soundPack;
    }
    const url = qs.stringifyUrl({
      url: `${window.location.protocol}//${window.location.host}`,
      query: q as any,
    });
    copyToClipboard(url, {
      format: 'text/plain',
      onCopy: () => {
        setCopiedURL(url);
      },
    });
  }, [bpm.current, beats, playSubDivs, swing, swingActive, subDivs, soundPack]);

  return (
    <main
      className={cn(
        'mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center bg-white pb-2 text-slate-900',
        'shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
      )}
    >
      <NavBar>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-2 top-1 h-9 w-9"
          onClick={() => setShowSideBar(true)}
        >
          <Settings className="h-6 w-6" />
          <span className="sr-only">Open settings</span>
        </Button>
      </NavBar>

      <Sheet open={showSideBar} onOpenChange={setShowSideBar}>
        <SheetContent
          side="right"
          className="w-[320px] border-l border-slate-300 bg-slate-50 px-5 pt-12 text-[15px] sm:w-[320px]"
        >
          <SheetHeader>
            <SheetTitle className="text-[1.1rem]">Settings</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <p className="font-medium">Volume</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  onClick={() => {
                    setMuted(val => !val);
                    sendOneEvent(`set_mute_${muted ? 'off' : 'on'}`);
                  }}
                >
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
                <Range
                  min={0}
                  max={100}
                  step={1}
                  value={volume}
                  onDrag={val => {
                    setVolume(int(val));
                    sendOneEvent('set_volume', '', val, int(val));
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-medium">Sounds</label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 outline-none"
                value={soundPack}
                onChange={e => {
                  setSoundPack(e.target.value);
                  sendEvent('set_sound_pack', 'App', e.target.value);
                }}
              >
                {Object.keys(SOUND_PACKS).map((key, idx) => (
                  <option key={`sp-${idx + 1}`} value={key}>
                    {typeof SOUND_PACKS[key]?.name === 'string' ||
                    typeof SOUND_PACKS[key]?.name === 'number'
                      ? SOUND_PACKS[key]?.name
                      : key}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col items-start gap-2">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-[15px]"
                onClick={e => {
                  e.preventDefault();
                  sendEvent('reset');
                  window.location.replace(`/?reset`);
                }}
              >
                Reset all settings
              </Button>

              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-[15px]"
                onClick={e => {
                  e.preventDefault();
                  copyConfigurationURL();
                  sendEvent('copy_configuration_url');
                }}
              >
                Copy configuration URL
              </Button>

              {copiedURL && (
                <p className="text-[13px] text-slate-600">
                  Copied{' '}
                  <a className="underline" href={copiedURL} target="_blank" rel="noreferrer">
                    configuration URL
                  </a>{' '}
                  to clipboard.
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-1.5 text-[15px]">
              <Link className="underline" to="/about">
                About
              </Link>
              <a
                className="block underline"
                href="https://github.com/dkellerman/bipium"
                target="_blank"
                rel="noreferrer"
                onClick={() => sendEvent('code')}
              >
                Code
              </a>
              <Link className="block underline" to="/api">
                API
              </Link>
              {buildSha && (
                <p className="text-xs text-slate-500">Build: {buildSha.substring(1, 5)}</p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Card className={cn(panelClass, 'border-0 bg-transparent shadow-none')}>
        <CardContent className="p-0">
          <BPMArea
            clicker={clicker}
            className="space-y-1 p-2.5 pb-0"
            onChange={val => {
              updateBPM(val);
              sendEvent('set_bpm', 'App', val, float(val));
            }}
          />

          <div className="flex w-full items-center justify-center gap-2 p-2">
            <div className="flex items-center gap-2">
              <label className="text-[1rem] leading-none">Beats:</label>
              <select
                className={cn(
                  'h-11 min-w-16 rounded-md border border-slate-300 bg-white px-2',
                  'text-[1.35rem] leading-none outline-none',
                )}
                value={beats}
                onChange={e => {
                  const val = int(e.target.value);
                  setBeats(val);
                  sendEvent('set_beats', 'App', val, val);
                }}
              >
                {new Array(12).fill(0).map((_, idx) => (
                  <option key={`beats-${idx + 1}`} value={idx + 1}>
                    {idx + 1}
                  </option>
                ))}
              </select>
            </div>
            <StepButtons val={beats} setter={setBeats} min={1} max={12} event="set_beats" />
          </div>

          <div className="space-y-4 px-2 pt-2 pb-0">
            <div
              role="button"
              tabIndex={0}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md px-1"
              onClick={() => setPlaySubDivsWithTracking(!playSubDivs)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setPlaySubDivsWithTracking(!playSubDivs);
                }
              }}
            >
              <div className="flex items-center gap-2">
                <div onClick={e => e.stopPropagation()}>
                  <Switch
                    checked={playSubDivs}
                    onCheckedChange={val => setPlaySubDivsWithTracking(val)}
                  />
                </div>
                <label className="cursor-pointer text-[1.15rem] leading-none">Play sub divs</label>
                {playSubDivs && (
                  <div
                    className="ml-4 flex items-center gap-1.5"
                    onClick={e => e.stopPropagation()}
                  >
                    <Switch
                      checked={swingEnabled}
                      onCheckedChange={val => setSwingEnabledWithRestore(val)}
                    />
                    <span className="text-[1.15rem] leading-none">Swing</span>
                  </div>
                )}
              </div>
            </div>

            {playSubDivs && (
              <>
                <div className="flex w-full items-center gap-2">
                  <select
                    className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-[1.05rem] outline-none"
                    value={subDivs}
                    onChange={e => {
                      const val = int(e.target.value);
                      setSubDivs(val);
                      sendEvent('set_subdivs', 'App', val, val);
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
                    val={subDivs}
                    setter={setSubDivs}
                    min={1}
                    max={8}
                    event="set_subdivs"
                  />
                </div>

                <div className="pt-1">
                  <div className="space-y-2">
                    {swingEnabled && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[1.1rem] leading-none text-slate-500">
                          <span>Swing:</span>
                          <div className="flex items-center gap-1.5">
                            {!canSwing ? (
                              <span className="text-slate-500">even sub divs only</span>
                            ) : editingSwing ? (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-0.5 border-b border-dotted border-slate-500 pb-px',
                                  'leading-none text-slate-600',
                                )}
                              >
                                <input
                                  ref={swingInputRef}
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.1"
                                  defaultValue={formatSwing(swing)}
                                  className="w-[3.5rem] bg-transparent text-right leading-none outline-none"
                                  onBlur={e => {
                                    if (cancelSwingEditRef.current) {
                                      cancelSwingEditRef.current = false;
                                      return;
                                    }
                                    commitSwingInput(e.target.value);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      e.currentTarget.blur();
                                    }
                                    if (e.key === 'Escape') {
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
                                className="border-b border-dotted border-slate-500 pb-px leading-none text-slate-600"
                                disabled={!canSwing}
                                onClick={() => setEditingSwing(true)}
                              >
                                {formatSwing(swing)}%
                              </button>
                            )}
                            {canSwing && !editingSwing && Number(swing) > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 rounded-full p-0 text-slate-500 hover:text-slate-700"
                                aria-label="Reset swing to 0"
                                onClick={() => {
                                  setSwing(0);
                                  sendOneEvent('update_swing', '', 0, 0);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <StepButtons
                          val={swing}
                          setter={setSwing}
                          min={0}
                          max={100}
                          conv={float}
                          disabled={!canSwing}
                          event="set_swing"
                        />
                      </div>
                    )}
                    {swingEnabled && (
                      <>
                        <div className="w-full pl-4 pr-0">
                          <Range
                            min={0}
                            max={100}
                            step={1}
                            value={swing}
                            onDrag={val => {
                              const next = validSwing(float(val), swing);
                              setSwing(next);
                              sendOneEvent('update_swing', '', next, next);
                            }}
                            disabled={!canSwing}
                            ticks={[0, 33, 50]}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {visualizers.map((id, idx) => (
        <Card
          className={cn(
            'w-[calc(100%-1rem)]',
            idx === 0 ? (playSubDivs ? '-mt-px' : 'mt-2') : '-mt-px',
          )}
          key={`v-${idx}`}
        >
          <CardContent className="p-1.5">
            <div className="flex w-full justify-center leading-none">
              <DefaultVisualizer
                id={id}
                metronome={m}
                width={visualizerWidth}
                height={visualizerHeight}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="mt-2">
        {!started ? (
          <Button
            type="button"
            className="h-[3.8rem] bg-emerald-700 px-10 text-[1.6rem] text-white hover:bg-emerald-800 sm:h-[3.4rem]"
            onClick={e => {
              e.preventDefault();
              start();
              sendEvent('start');
            }}
          >
            Start
          </Button>
        ) : (
          <Button
            type="button"
            className="h-[3.8rem] bg-red-700 px-10 text-[1.6rem] text-white hover:bg-red-800 sm:h-[3.4rem]"
            onClick={e => {
              e.preventDefault();
              stop();
              sendEvent('stop');
            }}
          >
            Stop
          </Button>
        )}
      </div>

      <div className="mt-2 flex w-full justify-center">
        <div
          ref={volumeControlRef}
          className="relative h-12 w-[352px] max-w-[calc(100%-2.25rem)]"
          onMouseLeave={() => setShowVolume(false)}
        >
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2',
              'overflow-hidden rounded-full border border-slate-300 bg-white px-3 shadow-sm',
              'transition-all duration-200',
              showVolume ? 'pointer-events-auto scale-x-100 opacity-100' : 'scale-x-0 opacity-0',
            )}
            style={{ transformOrigin: 'center center' }}
          >
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-full"
                aria-label={muted ? 'Unmute' : 'Mute'}
                onClick={() => {
                  setMuted(val => !val);
                  sendOneEvent(`mute_${muted ? 'off' : 'on'}`);
                }}
              >
                {muted ? (
                  <VolumeX className="h-[18px] w-[18px]" />
                ) : (
                  <Volume2 className="h-[18px] w-[18px]" />
                )}
              </Button>
              <div className="min-w-0 flex-1">
                <Range
                  min={0}
                  max={100}
                  step={1}
                  value={volume}
                  onDrag={val => {
                    setVolume(int(val));
                    sendOneEvent('set_volume', '', val, int(val));
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
                'absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full',
                'bg-white p-[0.55rem] shadow-md',
              )}
              aria-label="Show volume controls"
              onMouseEnter={() => setShowVolume(true)}
              onFocus={() => setShowVolume(true)}
              onClick={() => {
                setShowVolume(true);
              }}
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

const BPMArea = ({ clicker, onChange, className }: BPMAreaProps) => {
  const [bpm, setBpm] = useSetting('bpm', bpmDefault, float);
  const [editingBPM, setEditingBPM] = useState(false);
  const { bpm: tappedBPM, handleTap } = useTapBPM(bpm);
  const bpmRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setBpm(validBpm(float(tappedBPM) || bpm));
  }, [tappedBPM]);

  useEffect(() => {
    onChange?.(bpm);
  }, [bpm]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 't') {
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
    <div className={className}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-1">
        <Button
          type="button"
          variant="outline"
          className="h-[4.85rem] w-[4.85rem] rounded-full p-0 text-[1.55rem]"
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
                'h-10 w-[8.75rem] border-b border-dotted border-slate-500 bg-transparent px-1',
                'text-center text-[2.1rem] leading-none outline-none',
              )}
              onBlur={e => {
                const target = e.target as HTMLInputElement;
                setBpm(validBpm(float(target.value) || bpm));
                setEditingBPM(false);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLInputElement;
                  setBpm(validBpm(float(target.value) || bpm));
                  setEditingBPM(false);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="whitespace-nowrap border-b border-dotted border-slate-500 text-[2.1rem] leading-none"
              onClick={() => {
                setEditingBPM(true);
                sendEvent('edit_bpm');
              }}
            >
              {bpm} BPM
            </button>
          )}
        </div>

        <StepButtons val={bpm} setter={setBpm} min={20} max={300} conv={float} />
      </div>

      <div className="-mb-1 px-5">
        <Range
          min={bpmMin}
          max={bpmMax}
          step={1}
          value={bpm}
          onDrag={val => {
            setBpm(validBpm(val));
          }}
          labelRotation={-60}
          tickClassName="text-[19px] sm:text-[18px]"
          ticks={[50, 80, 100, 120, 140, 160, 180, 200, 220, 240, bpmMax]}
        />
      </div>
    </div>
  );
};

const StepButtons = ({
  val,
  setter,
  min,
  max,
  step = 1,
  conv = int,
  disabled = false,
  event = null,
  className,
}: StepButtonsProps) => {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-[3.35rem] w-[3.35rem] p-[0.7rem] text-[1.9rem] sm:h-12 sm:w-12 sm:p-[0.55rem]"
        disabled={disabled || Number(val) >= Number(max)}
        onClick={() => {
          setter(x => (x < max ? Math.min(Number(max), conv(x) + step) : x));
          if (event) sendEvent(event, 'App', 'step_up');
        }}
      >
        +
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-[3.35rem] w-[3.35rem] p-[0.7rem] text-[1.9rem] sm:h-12 sm:w-12 sm:p-[0.55rem]"
        disabled={disabled || Number(val) <= Number(min)}
        onClick={() => {
          setter(x => (x > min ? Math.max(Number(min), conv(x) - step) : x));
          if (event) sendEvent(event, 'App', 'step_down');
        }}
      >
        -
      </Button>
    </div>
  );
};

export default App;
