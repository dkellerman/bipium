// General onset detector for mic audio: syllables, claps and (later) music.
//
// Two detection signals per ~10 ms hop, each scored against its own rolling average and
// rolling deviation, so steady background noise raises the baseline rather than
// triggering onsets:
// - spectral flux: how much the (log) spectrum rose since the last frame; catches
//   consonants, clicks, plucks and hats;
// - RMS level: loudness against its recent average; catches soft or low onsets (voiced
//   vowels, kicks) that flux underweights.
// Onsets are local peaks of the combined score above a threshold. Right after an onset,
// the next must be comparably strong (a mask that fades over MASK_SECONDS), so one
// syllable or hit with several bursts inside it counts once.
// Times are seconds of audio pushed, i.e. the transcriber's clock when fed the same audio.
//
// It also measures evidence of music (see `music()`):
// - held notes: frames with a clear pitch (autocorrelation, as in YIN), above the noise
//   floor, staying within ~60 cents of where the note started for at least HELD_NOTE.
//   Speech intonation drifts past that quickly; sung and played notes hold;
// - sharp onsets: an onset's sharpness is how noise-like (spectrally flat) the sound is
//   at the hit. Claps, snaps and drum hits are; sung or spoken vowels are pitched.

export type Onset = {
  time: number;
  /** How far the onset stood out from its baseline. */
  strength: number;
  /** How noise-like the hit is (1 = sharp like a clap, 0 = pitched like a vowel). */
  sharpness: number;
  /** Loudness at the hit, in dB above the noise floor. */
  level: number;
};

const FRAME = 1024;
const HOP = 512;
const BASELINE_SECONDS = 1.5;
const THRESHOLD = 2.5;
const MIN_GAP = 0.07;
const MASK_SHARE = 0.7;
const MASK_SECONDS = 0.12;
const WARM_UP_HOPS = 20;
const KEEP_SECONDS = 30;
const ABOVE_FLOOR_DB = 12; // pitched frames must be this far above the noise floor
const HELD_NOTE = 0.3; // seconds a pitch must hold to count as a note
const NOTE_CENTS = 60; // how far a held note may wander from its start
const PITCH_RANGE = [80, 1000]; // Hz
const PITCH_CLARITY = 0.15; // YIN threshold: lower is a clearer pitch

/** Evidence that music is present in a stretch of audio. */
export type MusicEvidence = {
  /** Share of the time spent in held, pitched notes (singing, an instrument). */
  heldNotes: number;
  /** Share of onsets that were sharp (claps, snaps, strums, drums). */
  sharpOnsets: number;
};

export function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size;
    for (let start = 0; start < n; start += size)
      for (let k = 0; k < size / 2; k++) {
        const wr = Math.cos(angle * k);
        const wi = Math.sin(angle * k);
        const a = start + k;
        const b = a + size / 2;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
  }
}

/**
 * Rolling mean and mean absolute deviation (exponential). The first frames use a plain
 * running average, so the baseline settles quickly instead of starting from zero.
 */
class Baseline {
  mean = 0;
  deviation = 0;
  private count = 0;
  private readonly rate: number;
  private readonly floor: number;
  constructor(rate: number, floor: number) {
    this.rate = rate;
    this.floor = floor;
  }
  score(value: number) {
    const z = this.count ? (value - this.mean) / Math.max(this.deviation, this.floor) : 0;
    const rate = Math.max(this.rate, 1 / ++this.count);
    this.mean += rate * (value - this.mean);
    this.deviation += rate * (Math.abs(value - this.mean) - this.deviation);
    return z;
  }
}

export class OnsetDetector {
  private readonly sampleRate: number;
  private readonly window = Float64Array.from(
    { length: FRAME },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME),
  );
  private readonly ring = new Float32Array(FRAME);
  private ringAt = 0;
  private sinceHop = 0;
  private samples = 0;
  private hops = 0;
  private previous: Float64Array | null = null;
  private readonly flux: Baseline;
  private readonly level: Baseline;
  private candidate: (Onset & { score: number }) | null = null;
  private lastScore = 0;
  private lastOnset = -Infinity;
  private lastStrength = 0;
  private readonly onsets: Onset[] = [];
  private noiseFloor = Infinity;
  private noteCents = NaN; // pitch of the current note, in cents
  private run = 0; // consecutive frames holding that pitch
  private flatness = 0;
  private aboveFloor = 0;
  private readonly frames: { time: number; held: boolean }[] = [];

  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
    const rate = HOP / (sampleRate * BASELINE_SECONDS);
    this.flux = new Baseline(rate, 0.5);
    this.level = new Baseline(rate, 1.5);
  }

  /** Feed mono PCM16 audio, in order. */
  push(pcm: Int16Array) {
    for (let i = 0; i < pcm.length; i++) {
      this.ring[this.ringAt] = pcm[i] / 32768;
      this.ringAt = (this.ringAt + 1) % FRAME;
      this.samples++;
      if (++this.sinceHop === HOP) {
        this.sinceHop = 0;
        this.analyze();
      }
    }
  }

  /** Onsets between two times (seconds of audio pushed). */
  between(from: number, to: number): Onset[] {
    return this.onsets.filter(o => o.time >= from && o.time <= to);
  }

  /** How much of a stretch looks like music rather than speech or silence. */
  music(from: number, to: number): MusicEvidence {
    const frames = this.frames.filter(f => f.time >= from && f.time <= to);
    const onsets = this.between(from, to);
    return {
      heldNotes: frames.length ? frames.filter(f => f.held).length / frames.length : 0,
      sharpOnsets: onsets.length ? onsets.filter(o => o.sharpness >= 0.6).length / onsets.length : 0,
    };
  }

  private analyze() {
    const re = new Float64Array(FRAME);
    const im = new Float64Array(FRAME);
    let energy = 0;
    for (let i = 0; i < FRAME; i++) {
      const x = this.ring[(this.ringAt + i) % FRAME];
      energy += x * x;
      re[i] = x * this.window[i];
    }
    fft(re, im);
    const magnitudes = new Float64Array(FRAME / 2);
    let flux = 0;
    for (let k = 0; k < FRAME / 2; k++) {
      magnitudes[k] = Math.log1p(100 * Math.hypot(re[k], im[k]));
      if (this.previous) flux += Math.max(0, magnitudes[k] - this.previous[k]);
    }
    this.previous = magnitudes;
    const levelDb = 10 * Math.log10(energy / FRAME + 1e-10);
    this.trackNotes(re, im, levelDb);
    const fluxScore = this.flux.score(flux);
    const levelScore = this.level.score(levelDb);
    if (++this.hops < WARM_UP_HOPS) return;

    const score = 0.6 * Math.max(0, fluxScore) + 0.4 * Math.max(0, levelScore);
    const time = (this.samples - FRAME / 2) / this.sampleRate;

    // A peak is confirmed once the score falls; keep the best candidate until then.
    // Sharpness is the hit's least noise-like moment: claps stay noise-like through the
    // hit, while a vowel turns pitched within a frame or two.
    if (this.candidate) {
      this.candidate.sharpness = Math.min(this.candidate.sharpness, this.flatness);
      this.candidate.level = Math.max(this.candidate.level, this.aboveFloor);
    }
    if (score >= THRESHOLD && score > this.lastScore) {
      if (!this.candidate || score > this.candidate.score)
        this.candidate = {
          time,
          strength: score,
          sharpness: this.candidate?.sharpness ?? 1,
          level: this.candidate?.level ?? this.aboveFloor,
          score,
        };
      this.candidate.sharpness = Math.min(this.candidate.sharpness, this.flatness);
      this.candidate.level = Math.max(this.candidate.level, this.aboveFloor);
    } else if (this.candidate && score < this.candidate.score) {
      const { score: _, ...onset } = this.candidate;
      const since = onset.time - this.lastOnset;
      const mask = this.lastStrength * MASK_SHARE * Math.exp(-since / MASK_SECONDS);
      if (since >= MIN_GAP && onset.strength >= mask) {
        this.onsets.push(onset);
        this.lastOnset = onset.time;
        this.lastStrength = onset.strength;
      }
      this.candidate = null;
    }
    this.lastScore = score;
    while (this.onsets.length && this.onsets[0].time < time - KEEP_SECONDS) this.onsets.shift();
  }

  /** Mark this frame as part of a held, pitched note or not; note the hit's flatness. */
  private trackNotes(re: Float64Array, im: Float64Array, levelDb: number) {
    // Noise floor: follows quiet stretches quickly, loud ones slowly.
    this.noiseFloor =
      levelDb < this.noiseFloor ? levelDb : this.noiseFloor + 0.002 * (levelDb - this.noiseFloor);
    // Spectral flatness (~94 Hz–8.7 kHz), mapped to 0 (pitched) … 1 (noise-like).
    let logSum = 0;
    let sum = 0;
    for (let k = 2; k < 186; k++) {
      const power = re[k] * re[k] + im[k] * im[k] + 1e-12;
      logSum += Math.log(power);
      sum += power;
    }
    const flatness = Math.exp(logSum / 184) / (sum / 184);
    this.flatness = Math.min(1, Math.max(0, (flatness - 0.05) / 0.35));

    this.aboveFloor = Math.max(0, levelDb - this.noiseFloor);
    const audible = levelDb > this.noiseFloor + ABOVE_FLOOR_DB;
    const pitch = audible ? this.pitch() : null;
    const cents = pitch ? 1200 * Math.log2(pitch / 440) : NaN;
    if (pitch && Math.abs(cents - this.noteCents) <= NOTE_CENTS) {
      this.run++;
      this.noteCents += (cents - this.noteCents) / this.run; // the note's average pitch
    } else {
      this.run = pitch ? 1 : 0;
      this.noteCents = cents;
    }
    const seconds = HOP / this.sampleRate;
    const time = (this.samples - FRAME / 2) / this.sampleRate;
    const held = this.run * seconds >= HELD_NOTE;
    // Once a note has held long enough, its earlier frames count too.
    if (held && (this.run - 1) * seconds < HELD_NOTE)
      for (let i = this.frames.length - 1, n = this.run - 1; i >= 0 && n > 0; i--, n--)
        this.frames[i].held = true;
    this.frames.push({ time, held });
    while (this.frames.length && this.frames[0].time < time - KEEP_SECONDS) this.frames.shift();
  }

  /** Fundamental frequency of the current frame (YIN, on 4x-decimated audio), or null. */
  private pitch(): number | null {
    const rate = this.sampleRate / 4;
    const n = FRAME / 4;
    const x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let v = 0;
      for (let j = 0; j < 4; j++) v += this.ring[(this.ringAt + i * 4 + j) % FRAME];
      x[i] = v / 4;
    }
    const minLag = Math.floor(rate / PITCH_RANGE[1]);
    const maxLag = Math.min(Math.ceil(rate / PITCH_RANGE[0]), n / 2);
    const d = new Float64Array(maxLag + 1);
    for (let lag = 1; lag <= maxLag; lag++) {
      let total = 0;
      for (let i = 0; i < n - maxLag; i++) total += (x[i] - x[i + lag]) ** 2;
      d[lag] = total;
    }
    // Cumulative mean normalized difference; the first dip under the threshold is the period.
    let running = 0;
    for (let lag = 1; lag <= maxLag; lag++) {
      running += d[lag];
      d[lag] = running ? (d[lag] * lag) / running : 1;
    }
    for (let lag = minLag; lag < maxLag; lag++)
      if (d[lag] < PITCH_CLARITY && d[lag] <= d[lag + 1]) {
        const a = d[lag - 1], b = d[lag], c = d[lag + 1];
        const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
        return rate / (lag + shift);
      }
    return null;
  }
}
