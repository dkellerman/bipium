/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import qs from 'query-string';
import copyToClipboard from 'copy-to-clipboard';
import { AudioContext } from 'standardized-audio-context';
import { Settings } from 'lucide-react';
import { API_DEFAULT_CONFIG, createRuntimeApi } from '@/api';
import { BPMControls } from '@/components/BPMControls';
import { BeatControls } from '@/components/BeatControls';
import { DefaultVisualizer } from '@/components/DefaultVisualizer';
import { NavBar } from '@/components/NavBar';
import { SettingsDrawer } from '@/components/SettingsDrawer';
import { VolumeControl } from '@/components/VolumeControl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AppProvider } from '@/context/AppContext';
import type { AppContextValue } from '@/context/AppContext';
import { SOUND_PACKS, useClicker, useMetronome, useSetting } from '@/hooks';
import { cn } from '@/lib/utils';
import { sendEvent, sendFrameRate } from '@/tracking';
import type { ApiConfig, BooleanInput, NumberInput } from '@/types';

interface ConfigurationQuery {
  bpm: number;
  beats: number;
  playSubDivs: boolean;
  swing?: number;
  subDivs?: number;
  soundPack?: string;
}

const int = (value: NumberInput) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const float = (value: NumberInput) => {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const bool = (value: BooleanInput) => {
  return (value && [true, 1, '1', 'true', 't'].includes(value)) || false;
};

const bpmMin = 20.0;
const bpmMax = 320.0;
const bpmDefault = 80.0;
const validBpm = (value: number) => Math.max(Math.min(bpmMax, value || bpmDefault), bpmMin);
const validSwing = (value: NumberInput, fallback = 0) => {
  const fallbackNum = Number(fallback);
  const base = Number.isFinite(fallbackNum) ? fallbackNum : 0;
  const next = Number(value);
  if (!Number.isFinite(next)) return Math.max(0, Math.min(100, base));
  return Math.max(0, Math.min(100, next));
};

const buildSha = import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || '';

function App() {
  const queryParams = qs.parse(window.location.search);
  const hasUrlParams = Object.keys(queryParams).length > 0;
  const hasSwingParam = Object.prototype.hasOwnProperty.call(queryParams, 'swing');
  const swingFromUrl = validSwing(float(queryParams.swing as NumberInput), 0);

  const [bpmState, setBpmState] = useSetting('bpm', bpmDefault, float);
  const bpm = useRef<number>(bpmState);
  const [beats, setBeats] = useSetting('beats', 4, int);
  const [subDivs, setSubDivs] = useSetting('subDivs', 1, int);
  const [swing, setSwing] = useSetting('swing', 0, float);
  const [swingEnabled, setSwingEnabled] = useSetting('swingEnabled', false, bool);
  const [playSubDivs, setPlaySubDivs] = useSetting('playSubDivs', true, bool);
  const [volume, setVolume] = useSetting('volume', 35, int, localStorage);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const [soundPack, setSoundPack] = useSetting('soundPack', 'drumkit', String);
  const [visualizers] = useSetting<string[]>('visualizers', ['default'], value => {
    if (Array.isArray(value)) return value.map(String);
    return String(value).split(',');
  });

  const [showSideBar, setShowSideBar] = useState(false);
  const [copiedURL, setCopiedURL] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 390,
  );
  const [, setUpdate] = useState(false);
  const forceRender = () => setUpdate(value => !value);

  const previousSwingRef = useRef(swing || 0);
  const audioContext = useRef(new AudioContext());
  const beatsRef = useRef(beats);
  const subDivsRef = useRef(subDivs);
  const playSubDivsRef = useRef(playSubDivs);
  const swingRef = useRef(swing);
  const soundPackRef = useRef(soundPack);
  const volumeRef = useRef(volume);
  const startedRef = useRef(started);

  bpm.current = validBpm(float(bpmState));
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

  const metronome = useMetronome({
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
    setStarted(value => !value);
  }, []);

  const updateBPM = useCallback(
    (value: number) => {
      const next = validBpm(float(value));
      bpm.current = next;
      setBpmState(next);
      if (metronome.started) {
        metronome.update({ bpm: next });
      }
    },
    [setBpmState, metronome],
  );

  const setSwingEnabledWithRestore = useCallback(
    (value: boolean) => {
      if (!value) {
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

  const setPlaySubDivsWithTracking = useCallback((value: boolean) => {
    setPlaySubDivs(value);
    sendEvent('set_play_subdivs', 'App', value, value ? 1 : 0);
  }, []);

  useEffect(() => {
    if (clicker) clicker.setVolume(muted ? 0 : volume);
  }, [volume, muted]);

  useEffect(() => {
    if (window.location.search.indexOf('?reset') === 0) {
      window.location.replace('/');
    }
  }, []);

  useEffect(() => {
    metronome.update({
      subDivs: playSubDivs ? subDivs : 1,
      swing: swingActive ? swing : 0,
      beats,
      bpm: bpm.current,
    });
    forceRender();
  }, [playSubDivs, subDivs, swing, swingEnabled, canSwing, beats, metronome.started]);

  const getApiConfig = useCallback(
    (): ApiConfig => ({
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
    (next: ApiConfig) => {
      const normalized: ApiConfig = {
        ...API_DEFAULT_CONFIG,
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
    const runtime = createRuntimeApi({
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSideBar(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!started) {
      metronome.stop();
      sendFrameRate();
    } else {
      metronome.start();
    }
    forceRender();

    return () => {
      metronome.stop();
    };
  }, [started]);

  useEffect(() => {
    if (showSideBar) {
      setCopiedURL(null);
    }
  }, [showSideBar]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const copyConfigurationURL = useCallback(() => {
    const query: ConfigurationQuery = {
      bpm: bpm.current,
      beats,
      playSubDivs,
    };

    if (playSubDivs) {
      query.swing = swingActive ? swing : 0;
      query.subDivs = subDivs;
    }

    if (soundPack !== 'defaults') {
      query.soundPack = soundPack;
    }

    const url = qs.stringifyUrl({
      url: `${window.location.protocol}//${window.location.host}`,
      query: query as any,
    });

    copyToClipboard(url, {
      format: 'text/plain',
      onCopy: () => setCopiedURL(url),
    });
  }, [beats, playSubDivs, swing, swingActive, subDivs, soundPack]);

  const appContextValue = useMemo<AppContextValue>(
    () => ({
      buildSha,
      bpm: bpm.current,
      beats,
      subDivs,
      playSubDivs,
      swing,
      swingEnabled,
      volume,
      muted,
      soundPack,
      started,
      showSideBar,
      copiedURL,
      visualizers,
      visualizerWidth,
      visualizerHeight,
      clicker,
      metronome,
      setStarted,
      setBeats,
      setSubDivs,
      setSwing,
      setVolume,
      setMuted,
      setSoundPack,
      setShowSideBar,
      setPlaySubDivsWithTracking,
      setSwingEnabledWithRestore,
      copyConfigurationURL,
      updateBPM,
    }),
    [
      buildSha,
      beats,
      subDivs,
      playSubDivs,
      swing,
      swingEnabled,
      volume,
      muted,
      soundPack,
      started,
      showSideBar,
      copiedURL,
      visualizers,
      visualizerWidth,
      visualizerHeight,
      clicker,
      metronome,
      setPlaySubDivsWithTracking,
      setSwingEnabledWithRestore,
      copyConfigurationURL,
      updateBPM,
    ],
  );

  return (
    <AppProvider value={appContextValue}>
      <main
        className={cn(
          'mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center',
          'bg-white pb-2 text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
        )}
      >
        <NavBar>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1 size-9"
            onClick={() => setShowSideBar(true)}
          >
            <Settings className="size-6" />
            <span className="sr-only">Open settings</span>
          </Button>
        </NavBar>

        <SettingsDrawer />

        <Card className={cn('mt-2 w-[calc(100%-16px)]', 'border-0 bg-transparent shadow-none')}>
          <CardContent className="p-0">
            <BPMControls />
            <BeatControls />
          </CardContent>
        </Card>

        {visualizers.map((id, index) => (
          <Card
            className={cn('w-[calc(100%-16px)]', index === 0 ? (playSubDivs ? '-mt-px' : 'mt-2') : '-mt-px')}
            key={`v-${index}`}
          >
            <CardContent className="p-1.5">
              <div className="flex w-full justify-center leading-none">
                <DefaultVisualizer
                  id={id}
                  metronome={metronome}
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
              className={cn(
                'h-[60.8px] bg-emerald-700 px-10 text-[25.6px] text-white',
                'hover:bg-emerald-800 sm:h-[54.4px]',
              )}
              onClick={event => {
                event.preventDefault();
                start();
                sendEvent('start');
              }}
            >
              Start
            </Button>
          ) : (
            <Button
              type="button"
              className={cn(
                'h-[60.8px] bg-red-700 px-10 text-[25.6px] text-white',
                'hover:bg-red-800 sm:h-[54.4px]',
              )}
              onClick={event => {
                event.preventDefault();
                stop();
                sendEvent('stop');
              }}
            >
              Stop
            </Button>
          )}
        </div>

        <VolumeControl />
      </main>
    </AppProvider>
  );
}

export default App;
