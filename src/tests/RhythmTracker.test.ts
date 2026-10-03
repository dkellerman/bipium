import { describe, expect, it } from 'vitest';
import { analyzeOnsets, musicLikelihood, RhythmStabilizer } from '../lib/rhythm-tracker';
import type { Onset } from '../lib/onsets';
import recordedInstrument from './fixtures/heard-instrument-110.json';

let seed = 11;
const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** Run the tracker over `onsets` the way the mic session does: an analysis every 2 s. */
function track(onsets: Onset[], seconds: number) {
  const stabilizer = new RhythmStabilizer();
  const reports = [];
  for (let now = 2; now <= seconds; now += 2) {
    const report = stabilizer.next(analyzeOnsets(onsets, now));
    if (report) reports.push(report);
  }
  return reports;
}

const steady = (bpm: number, perBeat: number, seconds: number, jitter = 0.015): Onset[] => {
  const slot = 60 / bpm / perBeat;
  return Array.from({ length: Math.floor(seconds / slot) }, (_, i) => ({
    time: i * slot + (random() - 0.5) * 2 * jitter,
    strength: i % perBeat === 0 ? 6 + random() : 3 + random(),
    sharpness: 0.8,
    level: 40,
  }));
};

describe('rhythm tracker', () => {
  it('reports steady clapping once, after it has held', () => {
    const reports = track(steady(96, 1, 30), 30);
    expect(reports).toHaveLength(1);
    expect(reports[0].bpm).toBeGreaterThanOrEqual(94);
    expect(reports[0].bpm).toBeLessThanOrEqual(98);
  });

  it('reports an unaccented steady pulse as plain beats at a common tempo', () => {
    // Every hit the same strength: 120, 60 in eighths and 40 in triplets all fit equally.
    for (const bpm of [80, 120]) {
      const even = steady(bpm, 1, 30).map(o => ({ ...o, strength: 5 }));
      const [report] = track(even, 30);
      expect(report).toMatchObject({ subdivisions: 1 });
      expect(Math.abs(report.bpm - bpm)).toBeLessThanOrEqual(2);
    }
  });

  it('reports a real recorded instrument (~110 BPM, with hits between beats)', () => {
    // Onsets the detector found in an actual mic recording of someone playing.
    const [report] = track(recordedInstrument as Onset[], 18);
    expect(report).toMatchObject({ subdivisions: 1 });
    expect(Math.abs(report.bpm - 110)).toBeLessThanOrEqual(2);
  });

  it('reports a strummed eighth-note groove with its subdivisions', () => {
    const [report] = track(steady(92, 2, 30), 30);
    expect(report).toMatchObject({ subdivisions: 2 });
    expect(Math.abs(report.bpm - 92)).toBeLessThanOrEqual(2);
  });

  it('reports the same tempo again after the playing stopped and resumed', () => {
    const stabilizer = new RhythmStabilizer();
    const heard = { bpm: 100, subdivisions: 1, swing: 0, confidence: 0.9 };
    const feed = (analyses: (typeof heard | null)[]) =>
      analyses.map(a => stabilizer.next(a)).filter(Boolean);
    expect(feed([heard, heard, heard])).toHaveLength(1);
    expect(feed([null, heard, heard])).toHaveLength(0); // a brief gap is the same playing
    expect(feed([null, null, heard, heard])).toHaveLength(1);
  });

  it('stays quiet for randomly timed noise', () => {
    let time = 0;
    const noise: Onset[] = [];
    while (time < 60) {
      time += -Math.log(1 - random()) / 3; // ~3 random onsets a second
      noise.push({ time, strength: 3 + 3 * random(), sharpness: random(), level: 20 });
    }
    expect(track(noise, 60)).toHaveLength(0);
  });

  it('stays quiet for chatter-like syllables', () => {
    let time = 0;
    const chatter: Onset[] = [];
    while (time < 60) {
      time += 0.22 * (0.6 + 0.8 * random()); // ~4.5 syllables a second, loosely timed
      chatter.push({ time, strength: 3 + 3 * random(), sharpness: 0.3, level: 30 });
    }
    expect(track(chatter, 60)).toHaveLength(0);
  });

  it('needs the rhythm to still be going', () => {
    expect(analyzeOnsets(steady(96, 1, 6), 12)).toBeNull();
  });

  it('rates held notes and sharp percussion as music, speech as not', () => {
    expect(musicLikelihood({ heldNotes: 0, sharpOnsets: 0.2 })).toBe(0);
    expect(musicLikelihood({ heldNotes: 0.4, sharpOnsets: 0 })).toBe(1);
    expect(musicLikelihood({ heldNotes: 0, sharpOnsets: 0.9 })).toBe(1);
  });

  it('hears clapping through talking, discounting soft syllable onsets', () => {
    const claps = steady(100, 1, 30).map(o => ({ ...o, sharpness: 1 }));
    let time = 0;
    const talk: Onset[] = [];
    while (time < 30) {
      time += 0.22 * (0.6 + 0.8 * random());
      talk.push({ time, strength: 4 + random(), sharpness: 0.1, level: 30 });
    }
    const onsets = [...claps, ...talk].sort((a, b) => a.time - b.time);
    const speech = { heldNotes: 0, sharpOnsets: 0.9 };
    const stabilizer = new RhythmStabilizer();
    const reports = [];
    for (let now = 2; now <= 30; now += 2) {
      const report = stabilizer.next(analyzeOnsets(onsets, now, speech));
      if (report) reports.push(report);
    }
    expect(reports.length).toBeGreaterThan(0);
    expect(Math.abs(reports[0].bpm - 100)).toBeLessThanOrEqual(2);
  });
});
