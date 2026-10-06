import { describe, expect, it } from 'vitest';
import { GuitarTuner, TUNINGS, type TunerReading } from '../lib/tuner';
import { tunerStore } from '../lib/tuner-store';

const RATE = 48000;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

// A plucked string: decaying harmonics with a little inharmonicity, the fundamental
// weakened like a phone mic's low end. Mixed into `out` from `start` seconds.
function pluck(out: Float32Array, start: number, freq: number, seed: number) {
  let s = seed;
  const random = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const from = Math.round(start * RATE);
  for (let k = 1; k <= 12; k++) {
    const f = k * freq * Math.sqrt(1 + 0.00008 * k * k);
    if (f > 5000) break;
    const amplitude = (0.15 / k) * (freq < 100 && k === 1 ? 0.3 : 1);
    const phase = random() * 2 * Math.PI;
    const decay = 0.8 + 0.35 * k;
    for (let i = from; i < out.length; i++) {
      const t = (i - from) / RATE;
      out[i] += amplitude * Math.exp(-decay * t) * Math.sin(2 * Math.PI * f * t + phase);
    }
  }
}

function render(seconds: number, add: (out: Float32Array) => void, noise = 0.003) {
  const out = new Float32Array(seconds * RATE);
  let s = 11;
  const random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (let i = 0; i < out.length; i++) out[i] = random() * noise;
  add(out);
  return Int16Array.from(out, x => Math.max(-32768, Math.min(32767, x * 32767)));
}

// Strings 15 ms apart, low to high, each detuned by `cents`.
const strum =
  (notes: number[], cents: number[], at = 1) =>
  (out: Float32Array) =>
    notes.forEach((note, i) =>
      pluck(out, at + i * 0.015, hz(note) * 2 ** (cents[i] / 1200), i + 1),
    );

function listen(pcm: Int16Array, live = false) {
  const tuner = new GuitarTuner(RATE);
  tuner.live = live;
  const readings: TunerReading[] = [];
  tuner.onreading = reading => readings.push(reading);
  // The room first, as when voice mode starts before anything is played.
  const room = render(2, () => {});
  for (let i = 0; i < room.length; i += 4800) tuner.push(room.subarray(i, i + 4800));
  for (let i = 0; i < pcm.length; i += 4800) tuner.push(pcm.subarray(i, i + 4800));
  return readings;
}
const last = (readings: TunerReading[]) => readings[readings.length - 1];

const STANDARD = [40, 45, 50, 55, 59, 64];
const IN_TUNE = [0, 0, 0, 0, 0, 0];

describe('guitar tuner', () => {
  it('reads an in-tune open strum as standard tuning', () => {
    const reading = last(listen(render(4, strum(STANDARD, IN_TUNE))));
    expect(reading.tuning.name).toBe('Standard');
    expect(reading.sounding).toEqual([true, true, true, true, true, true]);
    expect(Math.abs(reading.offset!)).toBeLessThan(3);
    reading.cents.forEach(c => expect(Math.abs(c!)).toBeLessThan(3));
  });

  it('reads strings against each other, and the whole guitar against A440', () => {
    const reading = last(listen(render(4, strum(STANDARD, [-20, -20, -20, -5, -20, -20]))));
    expect(reading.offset!).toBeCloseTo(-20, -1);
    expect(reading.cents[3]!).toBeCloseTo(15, -1);
    [0, 1, 2, 4, 5].forEach(s => expect(Math.abs(reading.cents[s]!)).toBeLessThan(4));
  });

  it('finds a sharp B string under the low E harmonic it shares', () => {
    const reading = last(listen(render(4, strum(STANDARD, [0, 0, 0, 0, 25, 0]))));
    expect(reading.cents[4]!).toBeCloseTo(25, -1);
  });

  it('recognises drop D and half step down rather than calling strings out of tune', () => {
    expect(last(listen(render(4, strum([38, 45, 50, 55, 59, 64], IN_TUNE)))).tuning.name).toBe(
      'Drop D',
    );
    const half = last(listen(render(4, strum([39, 44, 49, 54, 58, 63], IN_TUNE))));
    expect(half.tuning.name).toBe('Half step down');
    expect(Math.abs(half.offset!)).toBeLessThan(3);
  });

  it('shows just the strings that are ringing', () => {
    // A, D and G only.
    const reading = last(listen(render(4, strum([45, 50, 55], [12, 0, -8]))));
    expect(reading.sounding).toEqual([false, true, true, true, false, false]);
    // Three strings: read against their median (0), which is in tune with A440.
    expect(reading.offset!).toBeCloseTo(0, -1);
    expect(reading.cents[1]!).toBeCloseTo(12, -1);
    expect(reading.cents[3]!).toBeCloseTo(-8, -1);
  });

  it('compares strings plucked one at a time once three are heard', () => {
    // A, D and G, 2 s apart; the whole guitar 20 cents flat, G another 15 flat.
    const readings = listen(
      render(8, out => {
        pluck(out, 1, hz(45) * 2 ** (-20 / 1200), 3);
        pluck(out, 3, hz(50) * 2 ** (-20 / 1200), 4);
        pluck(out, 5, hz(55) * 2 ** (-35 / 1200), 5);
      }),
      true,
    );
    expect(readings.find(r => r.sounding[2])!.offset).toBeNull();
    const reading = last(readings.filter(r => r.sounding[3]));
    expect(reading.offset!).toBeCloseTo(-20, -1);
    expect(reading.cents[1]!).toBeCloseTo(0, -1);
    expect(reading.cents[3]!).toBeCloseTo(-15, -1);
  });

  it('does not show the overtones of two strings as other strings', () => {
    // Low E and A: E's 3rd and 4th harmonics are the B and high E, A's 3rd the high E.
    const reading = last(listen(render(4, strum([40, 45], [0, 0]))));
    expect(reading.sounding).toEqual([true, true, false, false, false, false]);
  });

  it('does not show the B and high E inside a lone low E', () => {
    const reading = last(listen(render(4, out => pluck(out, 1, hz(40), 3))));
    expect(reading.sounding).toEqual([true, false, false, false, false, false]);
  });

  it('reads a single string', () => {
    const reading = last(listen(render(3, out => pluck(out, 1, hz(45) * 2 ** (12 / 1200), 3))));
    expect(reading.sounding).toEqual([false, true, false, false, false, false]);
    expect(reading.cents[1]!).toBeCloseTo(12, -1);
  });

  it('follows single strings into the tuning they belong to', () => {
    // Low D, then G2: not standard strings. A guess until a strum confirms it.
    const readings = listen(
      render(7, out => {
        pluck(out, 1, hz(38) * 2 ** (6 / 1200), 3);
        pluck(out, 4, hz(43), 4);
      }),
    );
    const d = readings.find(r => r.sounding[0])!;
    expect(d).toMatchObject({ guessed: true });
    expect(d.tuning.names[0]).toBe('D');
    expect(d.cents[0]!).toBeCloseTo(6, -1);
    const g = last(readings);
    expect(g.tuning.name).toBe('Whole step down');
    expect(g.sounding).toEqual([false, true, false, false, false, false]);
  });

  it('confirms a tuning from a strum', () => {
    const reading = last(listen(render(4, strum([38, 43, 48, 53, 57, 62], [-16, 0, 0, 3, 5, 3]))));
    expect(reading).toMatchObject({ guessed: false });
    expect(reading.tuning.name).toBe('Whole step down');
    expect(reading.cents[0]!).toBeLessThan(-12);
  });

  it('reads a string over steady hum and rumble', () => {
    const pcm = render(4, out => {
      for (let i = 0; i < out.length; i++)
        out[i] +=
          0.03 * Math.sin((2 * Math.PI * 60 * i) / RATE) +
          0.02 * Math.sin((2 * Math.PI * 120 * i) / RATE) +
          0.04 * Math.sin((2 * Math.PI * 43 * i) / RATE);
      pluck(out, 2, hz(38) * 2 ** (5 / 1200), 3);
    });
    const reading = last(listen(pcm));
    expect(reading.sounding).toEqual([true, false, false, false, false, false]);
    expect(reading.tuning.names[0]).toBe('D');
    expect(reading.cents[0]!).toBeCloseTo(5, -1);
  });

  it('ignores mains hum', () => {
    const pcm = render(4, out => {
      for (let i = 0; i < out.length; i++) out[i] += 0.05 * Math.sin((2 * Math.PI * 60 * i) / RATE);
    });
    expect(listen(pcm, true)).toEqual([]);
  });

  it('ignores a strummed chord', () => {
    // G major (320003) and E minor (022000).
    expect(listen(render(4, strum([43, 47, 50, 55, 59, 67], IN_TUNE)))).toEqual([]);
    expect(listen(render(4, strum([40, 47, 52, 55, 59, 64], IN_TUNE)))).toEqual([]);
  });

  it('does not open for a held note that does not fade (a voice, not a string)', () => {
    const pcm = render(3, out => {
      for (let i = RATE; i < out.length; i++)
        out[i] += 0.1 * Math.sin((2 * Math.PI * hz(55) * (i - RATE)) / RATE);
    });
    expect(listen(pcm)).toEqual([]);
  });

  it('once showing, reports strings falling silent', () => {
    // An A string muted after 2.5 s.
    const readings = listen(
      render(6, out => {
        const ring = new Float32Array(out.length);
        pluck(ring, 1, hz(45), 3);
        for (let i = 0; i < 3.5 * RATE; i++) out[i] += ring[i];
      }),
      true,
    );
    expect(readings.some(r => r.sounding[1])).toBe(true);
    expect(last(readings).sounding.some(Boolean)).toBe(false);
  });
});

describe('tuner store', () => {
  it("opens through voice mode's mic and reports what it shows", async () => {
    tunerStore.setVoiceListening(true);
    await tunerStore.open(() => false);
    expect(tunerStore.state()).toMatchObject({
      showing: true,
      listening: true,
      tuning: 'Standard',
    });
    tunerStore.report({
      tuning: TUNINGS[3],
      offset: -20.04,
      cents: [3.06, null, null, null, null, null],
      sounding: [true, false, false, false, false, false],
      guessed: false,
    });
    expect(tunerStore.state()).toMatchObject({
      tuning: 'Whole step down',
      tuningConfirmed: true,
      wholeGuitarCents: -20,
    });
    expect(tunerStore.state().strings[0]).toEqual({
      note: 'D',
      octave: 2,
      cents: 3.1,
      ringing: true,
    });
    expect(tunerStore.state().strings[1]).toMatchObject({ note: 'G', cents: null });
    // Voice mode stopping closes it; the last reading stays readable.
    tunerStore.setVoiceListening(false);
    expect(tunerStore.showing()).toBeNull();
    expect(tunerStore.state()).toMatchObject({ showing: false, listening: false });
    expect(tunerStore.state().strings[0]).toMatchObject({ cents: 3.1, ringing: false });
  });
});
