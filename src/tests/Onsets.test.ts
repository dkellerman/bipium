import { describe, expect, it } from 'vitest';
import { OnsetDetector } from '../lib/onsets';

// Decaying noise bursts at `times` over steady background noise.
function recording(times: number[], noise = 0.01) {
  const rate = 48000;
  const samples = new Int16Array(Math.ceil((times[times.length - 1] + 1) * rate));
  let seed = 7;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (let i = 0; i < samples.length; i++) samples[i] = random() * noise * 32767;
  for (const t of times)
    for (let i = 0; i < 4800; i++) {
      const at = Math.round(t * rate) + i;
      samples[at] = Math.max(-32768, Math.min(32767, samples[at] + random() * 0.5 * Math.exp(-i / 600) * 32767));
    }
  return samples;
}

function detect(samples: Int16Array) {
  const detector = new OnsetDetector(48000);
  for (let i = 0; i < samples.length; i += 4800) detector.push(samples.subarray(i, i + 4800));
  return detector.between(0, Infinity).map(o => o.time);
}

describe('onset detector', () => {
  it('finds each hit once, close to its time', () => {
    const times = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75];
    const found = detect(recording(times));
    expect(found).toHaveLength(times.length);
    found.forEach((t, i) => expect(Math.abs(t - times[i])).toBeLessThan(0.03));
  });

  it('adapts to louder background noise instead of firing on it', () => {
    expect(detect(recording([1, 1.5, 2], 0.05))).toHaveLength(3);
  });

  const tone = (frequency: (t: number) => number, seconds: number) => {
    const rate = 48000;
    const samples = new Int16Array(seconds * rate);
    let phase = 0;
    for (let i = 0; i < samples.length; i++) {
      phase += (2 * Math.PI * frequency(i / rate)) / rate;
      samples[i] = i > rate * 0.5 ? Math.sin(phase) * 8000 : 0;
    }
    return samples;
  };
  const music = (samples: Int16Array) => {
    const detector = new OnsetDetector(48000);
    for (let i = 0; i < samples.length; i += 4800) detector.push(samples.subarray(i, i + 4800));
    return detector.music(0, Infinity);
  };

  it('counts a held note as music but not a gliding, speech-like pitch', () => {
    expect(music(tone(() => 220, 3)).heldNotes).toBeGreaterThan(0.5);
    // Gliding two octaves a second, like exaggerated intonation.
    expect(music(tone(t => 110 * 2 ** (2 * (t % 1)), 3)).heldNotes).toBeLessThan(0.1);
  });

  it('rates noise-like hits as sharp', () => {
    const hits = recording([1, 1.5, 2, 2.5]);
    expect(music(hits).sharpOnsets).toBe(1);
  });
});

