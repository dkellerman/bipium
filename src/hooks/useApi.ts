import { useEffect, useRef, useState } from 'react';
import { AudioContext } from 'standardized-audio-context';
import { Clicker, Metronome } from '../core';
import { BIPIUM_API_DEFAULT_CONFIG, createBipiumRuntimeApi } from '../lib/api';
import type { BipiumApiConfig, BipiumRuntimeApi } from '../types';
import { SOUND_PACKS } from './useClicker';

function getEffectiveSwing(config: BipiumApiConfig) {
  if (!config.playSubDivs) return 0;
  if (config.subDivs % 2 !== 0) return 0;
  return config.swing;
}

export function useApi(onConfigChange?: (config: BipiumApiConfig) => void) {
  const onConfigChangeRef = useRef(onConfigChange);
  const [runtimeApi, setRuntimeApi] = useState<BipiumRuntimeApi | null>(null);

  const configRef = useRef<BipiumApiConfig>({ ...BIPIUM_API_DEFAULT_CONFIG });
  const startedRef = useRef(false);

  const audioContextRef = useRef<any | null>(null);
  const clickerRef = useRef<Clicker | null>(null);
  const metronomeRef = useRef<Metronome | null>(null);

  function applyConfig(next: BipiumApiConfig) {
    configRef.current = { ...next };
    const clicker = clickerRef.current;
    const metronome = metronomeRef.current;

    if (clicker) {
      clicker.setVolume(next.volume);
      void clicker.setSounds(SOUND_PACKS[next.soundPack] ?? SOUND_PACKS.defaults);
    }

    metronome?.update({
      bpm: next.bpm,
      beats: next.beats,
      subDivs: next.playSubDivs ? next.subDivs : 1,
      swing: getEffectiveSwing(next),
    });

    onConfigChangeRef.current?.({ ...next });
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
      sounds: SOUND_PACKS[configRef.current.soundPack] ?? SOUND_PACKS.defaults,
    });
    clickerRef.current = clicker;
    const metronome = new Metronome({
      timerFn: () => audioContext.currentTime,
      clicker,
      bpm: configRef.current.bpm,
      beats: configRef.current.beats,
      subDivs: configRef.current.playSubDivs ? configRef.current.subDivs : 1,
      swing: getEffectiveSwing(configRef.current),
      workerUrl: '/dist/worker.min.js',
    });
    metronomeRef.current = metronome;

    const runtime = createBipiumRuntimeApi({
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
      getSoundPacks: () => Object.keys(SOUND_PACKS),
    });

    applyConfig(configRef.current);
    setRuntimeApi(runtime);
    window.bpm = runtime;

    return () => {
      metronomeRef.current?.stop();
      startedRef.current = false;
      if (window.bpm === runtime) {
        delete window.bpm;
      }
      metronomeRef.current = null;
      clickerRef.current = null;
      audioContextRef.current = null;
      void audioContext.close();
      setRuntimeApi(null);
    };
  }, []);

  return runtimeApi;
}
