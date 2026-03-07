import { useEffect, useRef, useState } from 'react';
import { AudioContext } from 'standardized-audio-context';
import {
  API_DEFAULT_CONFIG,
  Clicker,
  createRuntimeApi,
  installWindowBpm,
  Metronome,
  resolveDrumLoopSounds,
} from '@/core/index';
import type { ApiConfig, RuntimeApi } from '@/types';
import { buildConfiguredSoundPack } from './useClicker';

function getEffectiveSwing(config: ApiConfig) {
  if (!config.playSubDivs) return 0;
  if (config.subDivs % 2 !== 0) return 0;
  return config.swing;
}

function getEffectiveLoopRepeats(config: ApiConfig) {
  if (!config.loopMode) return 0;
  return Math.max(0, config.loopRepeats);
}

export function useApi(onConfigChange?: (config: ApiConfig) => void) {
  const onConfigChangeRef = useRef(onConfigChange);
  const [runtimeApi, setRuntimeApi] = useState<RuntimeApi | null>(null);

  const configRef = useRef<ApiConfig>({ ...API_DEFAULT_CONFIG });
  const startedRef = useRef(false);

  const audioContextRef = useRef<any | null>(null);
  const clickerRef = useRef<Clicker | null>(null);
  const metronomeRef = useRef<Metronome | null>(null);

  function applyConfig(next: ApiConfig) {
    configRef.current = {
      ...next,
      soundUrls: { ...next.soundUrls },
      loopPattern: {
        kick: [...next.loopPattern.kick],
        hat: [...next.loopPattern.hat],
        snare: [...next.loopPattern.snare],
      },
    };
    const clicker = clickerRef.current;
    const metronome = metronomeRef.current;

    if (clicker) {
      clicker.setVolume(next.volume);
      void clicker.setSounds(
        buildConfiguredSoundPack(next.soundPack, next.soundUrls, next.loopMode),
      );

      if (next.loopMode) {
        clicker.setResolveScheduledSounds(click =>
          resolveDrumLoopSounds(click, configRef.current.loopPattern, clicker.sounds),
        );
      } else {
        clicker.setResolveScheduledSounds(undefined);
      }
    }

    metronome?.update({
      bpm: next.bpm,
      beats: next.beats,
      subDivs: next.playSubDivs ? next.subDivs : 1,
      swing: getEffectiveSwing(next),
      maxBars: getEffectiveLoopRepeats(next),
    });

    onConfigChangeRef.current?.({
      ...next,
      soundUrls: { ...next.soundUrls },
      loopPattern: {
        kick: [...next.loopPattern.kick],
        hat: [...next.loopPattern.hat],
        snare: [...next.loopPattern.snare],
      },
    });
  }

  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  useEffect(() => {
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const clicker = new Clicker({
      audioContext: audioContext as any,
      volume: configRef.current.volume,
      sounds: buildConfiguredSoundPack(
        configRef.current.soundPack,
        configRef.current.soundUrls,
        configRef.current.loopMode,
      ),
    });
    clickerRef.current = clicker;
    const metronome = new Metronome({
      timerFn: () => audioContext.currentTime,
      clicker,
      bpm: configRef.current.bpm,
      beats: configRef.current.beats,
      subDivs: configRef.current.playSubDivs ? configRef.current.subDivs : 1,
      swing: getEffectiveSwing(configRef.current),
      maxBars: getEffectiveLoopRepeats(configRef.current),
      onStop: () => {
        startedRef.current = false;
      },
      workerUrl: '/dist/worker.min.js',
    });
    metronomeRef.current = metronome;

    const runtime = createRuntimeApi({
      getConfig: () => ({ ...configRef.current }),
      applyConfig,
      startPlayback: () => {
        const currentMetronome = metronomeRef.current;
        if (!currentMetronome) return;
        if (startedRef.current) return;
        startedRef.current = true;
        currentMetronome.start();
      },
      stopPlayback: () => {
        const currentMetronome = metronomeRef.current;
        if (!currentMetronome) return;
        if (!startedRef.current) return;
        startedRef.current = false;
        currentMetronome.stop();
      },
      togglePlayback: () => {
        const currentMetronome = metronomeRef.current;
        if (!currentMetronome) return startedRef.current;
        const next = !startedRef.current;
        startedRef.current = next;
        if (next) currentMetronome.start();
        else currentMetronome.stop();
        return next;
      },
      isPlaying: () => startedRef.current,
      tap: () => {
        clickerRef.current?.click();
      },
      now: () => audioContextRef.current?.currentTime ?? 0,
      getSoundPacks: () => ['defaults', 'drumkit'],
    });

    applyConfig(configRef.current);
    setRuntimeApi(runtime);
    const uninstallWindowBpm = installWindowBpm(runtime);

    return () => {
      metronomeRef.current?.stop();
      startedRef.current = false;
      uninstallWindowBpm();
      metronomeRef.current = null;
      clickerRef.current = null;
      audioContextRef.current = null;
      void audioContext.close();
      setRuntimeApi(null);
    };
  }, []);

  return runtimeApi;
}
