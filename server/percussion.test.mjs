// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { PercussionDetector, estimatePercussion } from './percussion.mjs';
function recording(times, amplitudes = [0.5]) {
  const samples = new Int16Array(Math.ceil(((times.at(-1) ?? 0) + 0.5) * 48000));
  let seed = 7;
  times.forEach((time, index) => {
    for (let i = 0; i < 2400; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed / 4294967296) * 2 - 1;
      samples[Math.round(time * 48000) + i] = Math.round(
        noise * amplitudes[index % amplitudes.length] * Math.exp(-i / 450) * 32767,
      );
    }
  });
  return samples.buffer;
}
function feed(detector, buffer, size = 9600) {
  const results = [];
  for (let i = 0; i < buffer.byteLength; i += size)
    results.push(...detector.push(buffer.slice(i, i + size)));
  return results;
}
describe('server percussion analysis', () => {
  it.each(['snare1', 'kick1'])('detects repeated recorded %s attacks', name => {
    const bytes = readFileSync(new URL(`./fixtures/${name}.pcm`, import.meta.url));
    const sample = new Int16Array(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const audio = new Int16Array(48000 * 6);
    for (let hit = 1; hit <= 8; hit++) {
      for (let i = 0; i < sample.length; i++) {
        const index = hit * 24000 + i;
        audio[index] = Math.max(-32768, Math.min(32767, audio[index] + sample[i]));
      }
    }
    const results = feed(new PercussionDetector(), audio.buffer);
    expect(results.length).toBeGreaterThan(0);
    expect(results.at(-1).bpm).toBe(120);
  });
  it('estimates 120 BPM from short broadband attacks independently of network chunk boundaries', () => {
    const audio = recording([0.5, 1, 1.5, 2, 2.5, 3]);
    const a = feed(new PercussionDetector(), audio),
      b = feed(new PercussionDetector(), audio, 1378);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(b);
    expect(a.at(-1)).toMatchObject({
      classification: 'percussion',
      bpm: 120,
      subdivisionEvidence: 'ambiguous_assuming_one_hit_per_beat',
    });
    expect(a.at(-1).candidates).toContainEqual({ bpm: 60, subdivisions: 2 });
  });
  it.each([119.4, 119.6])('returns whole BPM for every percussion candidate near %s', tempo => {
    const result = estimatePercussion(
      Array.from({ length: 6 }, (_, i) => ({
        time: (i * 60) / tempo,
        strength: 1,
      })),
    );
    expect(result.bpm).toBe(Math.round(tempo));
    for (const candidate of result.candidates) {
      expect(candidate.bpm).toBe(Math.round(tempo / candidate.subdivisions));
    }
  });
  it('suggests accent grouping only after three repeated groups', () => {
    const audio = recording([0.5, 0.75, 1, 1.25, 1.5, 1.75], [0.8, 0.3]);
    const r = feed(new PercussionDetector(), audio).at(-1);
    expect(r).toMatchObject({
      bpm: 120,
      subdivisions: 2,
      subdivisionEvidence: 'repeating_accents_tentative',
    });
  });
  it('does not estimate silence, a sustained tone, or too few hits', () => {
    expect(feed(new PercussionDetector(), new ArrayBuffer(96000))).toEqual([]);
    const sine = Int16Array.from(
      { length: 96000 },
      (_, i) => Math.sin((i * 2 * Math.PI * 440) / 48000) * 15000,
    );
    expect(feed(new PercussionDetector(), sine.buffer)).toEqual([]);
    expect(feed(new PercussionDetector(), recording([0.5, 1, 1.5]))).toEqual([]);
  });
  it('declines irregular timing and clears stale rhythm after a long pause', () => {
    expect(estimatePercussion([0, 0.5, 1.4, 1.6].map(time => ({ time, strength: 1 })))).toBeNull();
    const detector = new PercussionDetector();
    feed(detector, recording([0.5, 1, 1.5, 2, 5]));
    expect(detector.hits).toHaveLength(1);
  });
  it('suppresses a rhythm hypothesis during recognized speech', () => {
    const detector = new PercussionDetector();
    detector.markSpeech();
    expect(feed(detector, recording([0.1, 0.3, 0.5, 0.7]))).toEqual([]);
  });
  it('bounds session history', () => {
    const detector = new PercussionDetector();
    feed(detector, recording(Array.from({ length: 30 }, (_, i) => 0.5 + i * 0.5)));
    expect(detector.hits).toHaveLength(12);
  });
});
