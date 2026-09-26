import { describe, expect, it } from 'vitest';
import {
  API_DEFAULT_CONFIG,
  createRuntimeApi,
  createSchemas,
  fromQuery,
  installWindowBpm,
  mergeConfig,
  seedDrumLoopPattern,
  toQuery,
  type DrumLoopPattern,
} from '@/core/index';
import type { ApiConfig } from '@/types';

function cloneLoopPattern(pattern: DrumLoopPattern): DrumLoopPattern {
  return {
    kick: [...pattern.kick],
    hat: [...pattern.hat],
    snare: [...pattern.snare],
  };
}

function createConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    ...API_DEFAULT_CONFIG,
    ...overrides,
    soundUrls: { ...API_DEFAULT_CONFIG.soundUrls, ...overrides.soundUrls },
    loopPattern: cloneLoopPattern(overrides.loopPattern ?? API_DEFAULT_CONFIG.loopPattern),
  };
}

describe('browser api loop support', () => {
  const schemas = createSchemas(new Set(['defaults', 'drumkit']));

  it('remaps the existing loop pattern when timing changes without a new pattern', () => {
    const base = createConfig({
      loopMode: true,
      loopPattern: {
        kick: [true, false, false, false],
        hat: [true, true, true, true],
        snare: [false, false, true, false],
      },
    });

    const next = mergeConfig(base, { beats: 2 }, schemas);

    expect(next.loopPattern.kick).toEqual([true, false]);
    expect(next.loopPattern.hat).toEqual([true, true]);
    expect(next.loopPattern.snare).toEqual([false, true]);
  });

  it('round-trips loop mode and pattern through query params', () => {
    const config = createConfig({
      beats: 4,
      subDivs: 2,
      playSubDivs: true,
      soundUrls: {
        beat: 'https://example.com/beat.mp3',
        user: '/audio/custom-stick.mp3',
      },
      loopMode: true,
      loopRepeats: 3,
      loopPattern: {
        kick: [true, false, false, false, false, false, true, false],
        hat: [true, true, true, true, true, true, true, true],
        snare: [false, false, false, false, true, false, false, false],
      },
    });

    const next = fromQuery(API_DEFAULT_CONFIG, toQuery(config), schemas);

    expect(next.loopMode).toBe(true);
    expect(next.loopRepeats).toBe(3);
    expect(next.soundUrls).toEqual(config.soundUrls);
    expect(next.loopPattern).toEqual(config.loopPattern);
    expect(next.subDivs).toBe(2);
  });

  it('exposes loop helpers on the runtime api', () => {
    let current = createConfig();

    const runtime = createRuntimeApi({
      getConfig: () => createConfig(current),
      applyConfig: next => {
        current = createConfig(next);
      },
      startPlayback: () => {},
      stopPlayback: () => {},
      togglePlayback: () => false,
      isPlaying: () => false,
      tap: () => {},
      now: () => 0,
      getSoundPacks: () => ['defaults', 'drumkit'],
    });

    runtime.setLoopMode(true);
    expect(runtime.isLoopMode()).toBe(true);
    runtime.setLoopRepeats(2);
    expect(runtime.getLoopRepeats()).toBe(2);
    runtime.setSoundUrls({ beat: 'https://example.com/beat.mp3' });
    expect(runtime.getSoundUrls()).toEqual({ beat: 'https://example.com/beat.mp3' });

    const pattern: DrumLoopPattern = {
      kick: [true, false, false, false],
      hat: [true, true, true, true],
      snare: [false, false, true, false],
    };
    runtime.setLoopPattern(pattern);
    expect(runtime.getLoopPattern()).toEqual(pattern);
    expect(runtime.getLoopPattern()).not.toBe(current.loopPattern);

    runtime.resetLoopPattern();
    expect(runtime.getLoopPattern()).toEqual(
      seedDrumLoopPattern({ beats: current.beats, subDivs: 1, swing: 0 }),
    );
  });

  it('clears the active grid without altering controls, then resets every setting and stops', () => {
    let current = createConfig();
    let playing = true;
    const runtime = createRuntimeApi({
      getConfig: () => current,
      applyConfig: next => {
        current = next;
      },
      startPlayback: () => {
        playing = true;
      },
      stopPlayback: () => {
        playing = false;
      },
      togglePlayback: () => playing,
      isPlaying: () => playing,
      tap: () => {},
      now: () => 0,
      getSoundPacks: () => ['defaults', 'drumkit'],
    });
    runtime.setConfig({
      bpm: 137,
      beats: 3,
      subDivs: 2,
      playSubDivs: true,
      swing: 23,
      volume: 67,
      loopMode: true,
      loopRepeats: 9,
      soundUrls: { beat: 'https://example.com/custom.wav' },
    });
    const before = runtime.getConfig();
    const cleared = runtime.clearLoopPattern();
    expect(cleared).toEqual({
      ...before,
      loopPattern: {
        kick: Array(6).fill(false),
        hat: Array(6).fill(false),
        snare: Array(6).fill(false),
      },
    });
    expect(playing).toBe(true);
    cleared.loopPattern.kick[0] = true;
    expect(runtime.getLoopPattern().kick[0]).toBe(false);
    const reset = runtime.resetToDefaults();
    expect(playing).toBe(false);
    expect(reset).toEqual(API_DEFAULT_CONFIG);
    expect(runtime.getConfig()).toEqual(API_DEFAULT_CONFIG);
    reset.soundUrls.beat = 'https://example.com/other.wav';
    expect(runtime.getSoundUrls()).toEqual({});
    runtime.setConfig({ beats: 5, subDivs: 4, playSubDivs: false });
    expect(runtime.clearLoopPattern().loopPattern.kick).toEqual(Array(5).fill(false));
  });

  it('merges runtime methods onto an existing window.bpm namespace and restores it', () => {
    const target = {
      bpm: {
        Visualizer: 'existing-visualizer',
      },
    };

    const runtime = createRuntimeApi({
      getConfig: () => createConfig(),
      applyConfig: () => {},
      startPlayback: () => {},
      stopPlayback: () => {},
      togglePlayback: () => false,
      isPlaying: () => false,
      tap: () => {},
      now: () => 0,
      getSoundPacks: () => ['defaults', 'drumkit'],
    });

    const uninstall = installWindowBpm(runtime, target);

    expect(target.bpm).toMatchObject({
      Visualizer: 'existing-visualizer',
      entrypoint: 'window.bpm',
    });

    uninstall();

    expect(target.bpm).toEqual({
      Visualizer: 'existing-visualizer',
    });
  });
});
