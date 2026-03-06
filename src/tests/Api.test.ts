import { describe, expect, it } from 'vitest';
import {
  API_DEFAULT_CONFIG,
  createRuntimeApi,
  createSchemas,
  fromQuery,
  mergeConfig,
  toQuery,
} from '@/api';
import { seedDrumLoopPattern, type DrumLoopPattern } from '@/lib/drumLoop';
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
});
