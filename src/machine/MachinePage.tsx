/* eslint-disable react-hooks/exhaustive-deps */
/*
 * Machine UI — stateful page for the /machine route. Owns the metronome,
 * clicker, runtime API, and URL-config wiring (adapted from pages/App.tsx)
 * and renders the Machine faceplate. Self-contained in src/machine/.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import qs from 'query-string';
import copyToClipboard from 'copy-to-clipboard';
import { AudioContext } from 'standardized-audio-context';
import {
  API_DEFAULT_CONFIG,
  DRUM_LOOP_LANES,
  createEmptyDrumLoopPattern,
  createRuntimeApi,
  createSchemas,
  fromQuery,
  installWindowBpm,
  remapDrumLoopPattern,
  resolveDrumLoopSounds,
  seedDrumLoopPattern,
  toQuery,
  type DrumLoopLane,
  type DrumLoopPattern,
  type DrumLoopTiming,
} from '@/core/index';
import { AppProvider } from '@/AppContext';
import type { AppContextValue } from '@/AppContext';
import {
  buildConfiguredSoundPack,
  SOUND_PACKS,
  useClicker,
  useMetronome,
  useSetting,
} from '@/hooks';
import { isEditableEventTarget } from '@/lib/utils';
import { sendEvent, sendFrameRate } from '@/tracking';
import type { ApiConfig, BooleanInput, NumberInput } from '@/types';
import { Machine } from './Machine';
import { MachineDrawer } from './MachineDrawer';
import type { MachineExtras } from './shared';
import './machine.css';

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
type VisualizerMode = 'default' | 'drumLoop';

function cloneLoopPattern(pattern: DrumLoopPattern): DrumLoopPattern {
  return {
    kick: [...pattern.kick],
    hat: [...pattern.hat],
    snare: [...pattern.snare],
  };
}

function getLoopTimingFromConfig(
  config: Pick<ApiConfig, 'beats' | 'subDivs' | 'playSubDivs' | 'swing'>,
) {
  const activeSubDivs = config.playSubDivs ? config.subDivs : 1;
  const swing = config.playSubDivs && config.subDivs % 2 === 0 ? config.swing : 0;

  return {
    beats: config.beats,
    subDivs: activeSubDivs,
    swing,
  } satisfies DrumLoopTiming;
}

function isSeedLoopPattern(pattern: DrumLoopPattern, timing: DrumLoopTiming) {
  return JSON.stringify(pattern) === JSON.stringify(seedDrumLoopPattern(timing));
}

function isEmptyLoopPattern(pattern: DrumLoopPattern) {
  return DRUM_LOOP_LANES.every(lane => pattern[lane].every(step => !step));
}

function shouldUseLoopVisualizer(
  config: Pick<ApiConfig, 'loopPattern' | 'beats' | 'subDivs' | 'playSubDivs' | 'swing'>,
) {
  return !isSeedLoopPattern(config.loopPattern, getLoopTimingFromConfig(config));
}

function MachinePage() {
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
  const [playSubDivs, setPlaySubDivs] = useSetting('playSubDivs', false, bool);
  const [volume, setVolume] = useSetting('volume', 35, int, localStorage);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);
  const [soundPack, setSoundPack] = useSetting('soundPack', 'drumkit', String);
  const [loopRepeats, setLoopRepeats] = useSetting('loopRepeats', 0, int);
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
  // One context for the page's lifetime. Passing new AudioContext() straight
  // to useRef constructs a throwaway context on every render; mobile browsers
  // cap live contexts and freeze the oldest, which is the one the ref keeps.
  const [audioContextInstance] = useState(() => new AudioContext());
  const audioContext = useRef(audioContextInstance);
  const beatsRef = useRef(beats);
  const subDivsRef = useRef(subDivs);
  const playSubDivsRef = useRef(playSubDivs);
  const swingRef = useRef(swing);
  const soundPackRef = useRef(soundPack);
  const volumeRef = useRef(volume);
  const loopRepeatsRef = useRef(loopRepeats);
  const startedRef = useRef(started);
  const soundUrlsRef = useRef(API_DEFAULT_CONFIG.soundUrls);

  bpm.current = validBpm(float(bpmState));
  beatsRef.current = beats;
  subDivsRef.current = subDivs;
  playSubDivsRef.current = playSubDivs;
  swingRef.current = swing;
  soundPackRef.current = soundPack;
  volumeRef.current = volume;
  loopRepeatsRef.current = loopRepeats;
  startedRef.current = started;

  const canSwing = subDivs % 2 === 0;
  const swingActive = playSubDivs && canSwing && swingEnabled;
  const activeSubDivs = playSubDivs ? subDivs : 1;
  const loopTiming = useMemo<DrumLoopTiming>(
    () => ({
      beats,
      subDivs: activeSubDivs,
      swing: swingActive ? swing : 0,
    }),
    [beats, activeSubDivs, swingActive, swing],
  );
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('default');
  // Mirrors kept in sync synchronously so the window.bpm API reads correct
  // values immediately after a call, before React re-renders.
  const visualizerModeRef = useRef<VisualizerMode>('default');
  visualizerModeRef.current = visualizerMode;
  const [renderedVisualizerMode, setRenderedVisualizerMode] = useState<VisualizerMode>('default');
  const [soundUrls, setSoundUrls] = useState(() => ({ ...API_DEFAULT_CONFIG.soundUrls }));
  const [drumPattern, setDrumPattern] = useState<DrumLoopPattern>(() =>
    seedDrumLoopPattern(loopTiming),
  );
  const [drumPatternDirty, setDrumPatternDirty] = useState(false);
  const visualizerWidth = Math.max(272, Math.min(450, viewportWidth - 30));
  const visualizerHeight = 124;
  const clicker = useClicker({
    audioContext: audioContext.current,
    volume,
    sounds: buildConfiguredSoundPack(soundPack, soundUrls),
  });

  const metronome = useMetronome({
    timerFn: () => audioContext.current.currentTime,
    clicker,
    bpm: bpm.current,
    beats,
    subDivs: activeSubDivs,
    swing: loopTiming.swing,
    maxBars: 0,
    onStop: () => {
      startedRef.current = false;
      if (mountedRef.current) {
        setStarted(false);
      }
    },
    workerUrl: '/dist/worker.min.js',
  });
  const drumPatternRef = useRef(drumPattern);
  const loopTimingRef = useRef(loopTiming);
  const pendingRenderedVisualizerModeRef = useRef<VisualizerMode | null>(null);
  const apiSchemasRef = useRef(createSchemas(new Set(Object.keys(SOUND_PACKS))));
  const initialQueryAppliedRef = useRef(false);
  const mountedRef = useRef(true);

  drumPatternRef.current = drumPattern;
  soundUrlsRef.current = soundUrls;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Resume inside the user-gesture call stack. Mobile Safari can park the
  // context in an 'interrupted' state that the core's suspended-only resume
  // check never clears, leaving the clock (and the visualizer) frozen.
  const resumeAudioContext = useCallback(() => {
    void audioContext.current.resume().catch(() => undefined);
  }, []);

  const start = useCallback(() => {
    resumeAudioContext();
    startedRef.current = true;
    setStarted(true);
  }, [resumeAudioContext]);

  const stop = useCallback(() => {
    startedRef.current = false;
    setStarted(false);
  }, []);

  const toggle = useCallback(() => {
    resumeAudioContext();
    const next = !startedRef.current;
    startedRef.current = next;
    setStarted(next);
  }, [resumeAudioContext]);

  const toggleVisualizerMode = useCallback(() => {
    const nextMode = visualizerMode === 'drumLoop' ? 'default' : 'drumLoop';
    if (visualizerMode === 'drumLoop') {
      const nextPattern = seedDrumLoopPattern(loopTimingRef.current);
      drumPatternRef.current = nextPattern;
      setDrumPattern(nextPattern);
      setDrumPatternDirty(false);
    }
    pendingRenderedVisualizerModeRef.current = nextMode;
    visualizerModeRef.current = nextMode;
    setVisualizerMode(nextMode);
    sendEvent('toggle_visualizer_mode', 'App', nextMode);
  }, [visualizerMode]);

  const toggleDrumLoopStep = useCallback((lane: DrumLoopLane, stepIndex: number) => {
    setDrumPattern(previous => {
      const nextLane = [...previous[lane]];
      nextLane[stepIndex] = !nextLane[stepIndex];
      return {
        ...previous,
        [lane]: nextLane,
      };
    });
    setDrumPatternDirty(true);
  }, []);

  const clearDrumLoopPattern = useCallback(() => {
    const nextPattern = createEmptyDrumLoopPattern(loopTimingRef.current);
    drumPatternRef.current = nextPattern;
    setDrumPattern(nextPattern);
    setDrumPatternDirty(!isSeedLoopPattern(nextPattern, loopTimingRef.current));
    sendEvent('clear_drum_loop', 'App');
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
      window.location.replace(window.location.pathname);
    }
  }, []);

  useEffect(() => {
    metronome.update({
      subDivs: activeSubDivs,
      swing: loopTiming.swing,
      beats,
      bpm: bpm.current,
      maxBars: visualizerMode === 'drumLoop' ? Math.max(0, loopRepeats) : 0,
    });
    if (pendingRenderedVisualizerModeRef.current) {
      setRenderedVisualizerMode(pendingRenderedVisualizerModeRef.current);
      pendingRenderedVisualizerModeRef.current = null;
    }
    forceRender();
  }, [activeSubDivs, beats, loopRepeats, loopTiming.swing, visualizerMode, metronome.started]);

  useEffect(() => {
    const previousTiming = loopTimingRef.current;
    const timingChanged =
      previousTiming.beats !== loopTiming.beats ||
      previousTiming.subDivs !== loopTiming.subDivs ||
      previousTiming.swing !== loopTiming.swing;

    if (!timingChanged) return;

    setDrumPattern(previous =>
      drumPatternDirty
        ? remapDrumLoopPattern(previous, previousTiming, loopTiming)
        : seedDrumLoopPattern(loopTiming),
    );
    loopTimingRef.current = loopTiming;
  }, [loopTiming, drumPatternDirty]);

  const getApiConfig = useCallback(
    (): ApiConfig => ({
      bpm: bpm.current,
      beats: beatsRef.current,
      subDivs: subDivsRef.current,
      playSubDivs: playSubDivsRef.current,
      swing: swingRef.current,
      soundPack: soundPackRef.current,
      volume: volumeRef.current,
      soundUrls: { ...soundUrlsRef.current },
      loopMode: visualizerModeRef.current === 'drumLoop',
      loopRepeats: loopRepeatsRef.current,
      loopPattern: cloneLoopPattern(drumPatternRef.current),
    }),
    [],
  );

  const applyApiConfig = useCallback(
    (next: ApiConfig) => {
      const normalized: ApiConfig = {
        ...API_DEFAULT_CONFIG,
        ...next,
        soundUrls: { ...API_DEFAULT_CONFIG.soundUrls, ...next.soundUrls },
        loopPattern: cloneLoopPattern(next.loopPattern ?? API_DEFAULT_CONFIG.loopPattern),
      };
      const nextLoopTiming = getLoopTimingFromConfig(normalized);
      const nextVisualizerMode = shouldUseLoopVisualizer(normalized) ? 'drumLoop' : 'default';
      const nextBpm = validBpm(float(normalized.bpm));
      const nextBeats = int(normalized.beats);
      const nextSubDivs = int(normalized.subDivs);
      const nextPlaySubDivs = Boolean(normalized.playSubDivs);
      const nextSwing = validSwing(normalized.swing, 0);
      const nextVolume = int(normalized.volume);
      const nextLoopRepeats = int(normalized.loopRepeats);
      const nextPattern = cloneLoopPattern(normalized.loopPattern);
      const nextSoundUrls = { ...normalized.soundUrls };

      bpm.current = nextBpm;
      beatsRef.current = nextBeats;
      subDivsRef.current = nextSubDivs;
      playSubDivsRef.current = nextPlaySubDivs;
      swingRef.current = nextSwing;
      soundPackRef.current = normalized.soundPack;
      soundUrlsRef.current = nextSoundUrls;
      volumeRef.current = nextVolume;
      loopRepeatsRef.current = nextLoopRepeats;
      drumPatternRef.current = nextPattern;

      loopTimingRef.current = nextLoopTiming;
      pendingRenderedVisualizerModeRef.current = nextVisualizerMode;
      visualizerModeRef.current = nextVisualizerMode;
      clicker.setVolume(nextVolume);
      void clicker.setSounds(
        buildConfiguredSoundPack(
          normalized.soundPack || 'defaults',
          nextSoundUrls,
          nextVisualizerMode === 'drumLoop',
        ),
      );
      clicker.setResolveScheduledSounds(
        nextVisualizerMode === 'drumLoop'
          ? click => resolveDrumLoopSounds(click, drumPatternRef.current, clicker.sounds)
          : undefined,
      );
      metronome.update({
        bpm: nextBpm,
        beats: nextBeats,
        subDivs: nextLoopTiming.subDivs,
        swing: nextLoopTiming.swing,
        maxBars: nextVisualizerMode === 'drumLoop' ? Math.max(0, nextLoopRepeats) : 0,
      });

      setBpmState(nextBpm);
      setBeats(nextBeats);
      setPlaySubDivs(nextPlaySubDivs);
      setSubDivs(nextSubDivs);
      setSwing(nextSwing);
      setSwingEnabled(nextSwing > 0);
      previousSwingRef.current = nextSwing > 0 ? nextSwing : 0;
      setSoundPack(normalized.soundPack);
      setSoundUrls(nextSoundUrls);
      setVolume(nextVolume);
      setVisualizerMode(nextVisualizerMode);
      setLoopRepeats(nextLoopRepeats);
      setDrumPattern(nextPattern);
      setDrumPatternDirty(!isSeedLoopPattern(nextPattern, nextLoopTiming));
    },
    [clicker, metronome, setBpmState, setLoopRepeats],
  );

  useEffect(() => {
    const runtime = createRuntimeApi({
      getConfig: getApiConfig,
      applyConfig: applyApiConfig,
      startPlayback: () => {
        resumeAudioContext();
        startedRef.current = true;
        setStarted(true);
      },
      stopPlayback: () => {
        startedRef.current = false;
        setStarted(false);
      },
      togglePlayback: () => {
        resumeAudioContext();
        const next = !startedRef.current;
        startedRef.current = next;
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

    return installWindowBpm(runtime);
  }, [applyApiConfig, clicker, getApiConfig]);

  useEffect(() => {
    if (initialQueryAppliedRef.current || !hasUrlParams) return;
    initialQueryAppliedRef.current = true;

    try {
      const next = fromQuery(getApiConfig(), window.location.search, apiSchemasRef.current);
      applyApiConfig(next);
    } catch {
      // Ignore invalid query params and keep the current local/session-backed state.
    }
  }, [applyApiConfig, getApiConfig, hasUrlParams]);

  useEffect(() => {
    clicker.setSounds(
      buildConfiguredSoundPack(soundPack || 'defaults', soundUrls, visualizerMode === 'drumLoop'),
    );
  }, [clicker, soundPack, soundUrls, visualizerMode]);

  useEffect(() => {
    if (visualizerMode !== 'drumLoop') {
      clicker.setResolveScheduledSounds(undefined);
      return;
    }

    clicker.setResolveScheduledSounds(click =>
      resolveDrumLoopSounds(click, drumPatternRef.current, clicker.sounds),
    );
  }, [clicker, visualizerMode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) return;
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
      if (isEditableEventTarget(event.target)) return;
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
    const url = qs.stringifyUrl({
      url: `${window.location.protocol}//${window.location.host}`,
      query: qs.parse(toQuery(getApiConfig())),
    });

    copyToClipboard(url, {
      format: 'text/plain',
      onCopy: () => setCopiedURL(url),
    });
  }, [getApiConfig]);

  const appContextValue = useMemo<AppContextValue>(
    () => ({
      buildSha,
      bpm: bpmState,
      beats,
      subDivs,
      playSubDivs,
      swing,
      swingEnabled,
      volume,
      muted,
      soundPack,
      loopMode: visualizerMode === 'drumLoop',
      loopRepeats,
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
      setLoopRepeats,
      setShowSideBar,
      setPlaySubDivsWithTracking,
      setSwingEnabledWithRestore,
      copyConfigurationURL,
      updateBPM,
    }),
    [
      buildSha,
      bpmState,
      beats,
      subDivs,
      playSubDivs,
      swing,
      swingEnabled,
      volume,
      muted,
      soundPack,
      visualizerMode,
      loopRepeats,
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
  // Everything the Machine faceplate needs beyond AppContext.
  const machineExtras: MachineExtras = {
    renderedVisualizerMode,
    toggleVisualizerMode,
    clearDrumLoopPattern,
    drumPattern,
    toggleDrumLoopStep,
    start,
    stopAll: stop,
  };

  return (
    <AppProvider value={appContextValue}>
      <Machine extras={machineExtras} />
      <MachineDrawer />
    </AppProvider>
  );
}

export default MachinePage;
