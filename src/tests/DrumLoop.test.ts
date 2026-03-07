import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioContext } from 'standardized-audio-context-mock';
import {
  createEmptyDrumLoopPattern,
  Clicker,
  DEFAULT_SOUNDS,
  remapDrumLoopPattern,
  resolveDrumLoopSounds,
  seedDrumLoopPattern,
  type DrumLoopPattern,
  type DrumLoopTiming,
} from '@/core/index';
import { SOUND_PACKS } from '@/hooks';

function createPattern(
  timing: DrumLoopTiming,
  active: Partial<Record<keyof DrumLoopPattern, number[]>>,
): DrumLoopPattern {
  const pattern = createEmptyDrumLoopPattern(timing);

  Object.entries(active).forEach(([lane, steps]) => {
    steps?.forEach(stepIndex => {
      pattern[lane as keyof DrumLoopPattern][stepIndex] = true;
    });
  });

  return pattern;
}

describe('drum loop helpers', () => {
  it('seeds quarter-note loop from the current metronome accents', () => {
    const pattern = seedDrumLoopPattern({ beats: 4, subDivs: 1, swing: 0 });

    expect(pattern.kick).toEqual([true, false, false, false]);
    expect(pattern.snare).toEqual([false, false, true, false]);
    expect(pattern.hat).toEqual([true, true, true, true]);
  });

  it('seeds subdivided loop with hats on every step', () => {
    const pattern = seedDrumLoopPattern({ beats: 4, subDivs: 2, swing: 0 });

    expect(pattern.kick[0]).toBe(true);
    expect(pattern.snare[4]).toBe(true);
    expect(pattern.hat).toEqual([true, true, true, true, true, true, true, true]);
  });

  it('places the snare on the midpoint downbeat for odd meters', () => {
    const pattern = seedDrumLoopPattern({ beats: 5, subDivs: 1, swing: 0 });

    expect(pattern.snare).toEqual([false, false, false, true, false]);
  });

  it('remaps dirty patterns by nearest bar position and merges collisions', () => {
    const fromTiming = { beats: 4, subDivs: 4, swing: 0 };
    const toTiming = { beats: 4, subDivs: 1, swing: 0 };
    const pattern = createPattern(fromTiming, {
      hat: [1, 2],
      snare: [8],
    });

    const remapped = remapDrumLoopPattern(pattern, fromTiming, toTiming);

    expect(remapped.hat).toEqual([true, false, false, false]);
    expect(remapped.snare).toEqual([false, false, true, false]);
  });

  it('uses louder hats on beats and softer hats between beats', () => {
    const timing = { beats: 4, subDivs: 2, swing: 0 };
    const pattern = createPattern(timing, {
      kick: [0],
      hat: [2, 3],
      snare: [4],
    });

    const beatHatSounds = resolveDrumLoopSounds(
      { beat: 2, subDiv: 1, subDivs: 2 },
      pattern,
      SOUND_PACKS.drumkit,
    );
    const subDivHatSounds = resolveDrumLoopSounds(
      { beat: 2, subDiv: 2, subDivs: 2 },
      pattern,
      SOUND_PACKS.drumkit,
    );
    const kickSounds = resolveDrumLoopSounds(
      { beat: 1, subDiv: 1, subDivs: 2 },
      pattern,
      SOUND_PACKS.drumkit,
    );
    const snareSounds = resolveDrumLoopSounds(
      { beat: 3, subDiv: 1, subDivs: 2 },
      pattern,
      SOUND_PACKS.drumkit,
    );

    expect(beatHatSounds).toEqual([SOUND_PACKS.drumkit.beat]);
    expect(subDivHatSounds).toEqual([SOUND_PACKS.drumkit.subDiv]);
    expect(kickSounds).toEqual([SOUND_PACKS.drumkit.bar]);
    expect(snareSounds).toEqual([SOUND_PACKS.drumkit.half]);
  });
});

describe('Clicker multi-hit scheduling', () => {
  const audioContext = new AudioContext();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('plays every resolved hit on a single step', async () => {
    const clicker = new Clicker({
      audioContext: audioContext as any,
      sounds: DEFAULT_SOUNDS,
      resolveScheduledSounds: () => [
        [220, 1, 0.05],
        [440, 0.5, 0.05],
      ],
    });

    await clicker.setSounds(DEFAULT_SOUNDS);
    const playSoundAt = vi.spyOn(clicker, 'playSoundAt');

    const scheduled = clicker.scheduleClickSound({
      bar: 1,
      beat: 1,
      beats: 4,
      subDiv: 1,
      subDivs: 4,
      time: 0,
    });

    expect(playSoundAt).toHaveBeenCalledTimes(2);
    expect(Array.isArray(scheduled)).toBe(true);
    expect(scheduled).toHaveLength(2);
  });
});
