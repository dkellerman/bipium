// Guitar tuner for voice mode: hears which open strings are ringing in the mic audio and
// measures each one. Audio only; words play no part.
//
// - A few times a second, one spectrum of the last WINDOW seconds. Each string is looked
//   for near its target from its harmonics; whichever strings are there are measured.
// - Relative pitch: each string's latest reading is kept, whether strings ring together or
//   one at a time. Once KNOWN_STRINGS are known, the guitar's own reference is the median
//   of their deviations (one bad string can't drag it), and every string is read against
//   that. The reference itself is shown against A440. Until then, strings read against
//   A440.
// - Tuning: when (nearly) all strings ring, every candidate tuning is tried and the best
//   fit wins (drop D reads as drop D, not as a very flat low E). Fewer strings keep the
//   current tuning.
// - Steady sound isn't playing: each frequency's floor follows the room (hum, fans, rumble),
//   and only peaks well above it count as new sound. A level that holds steady for a
//   while joins the floor at once (a fan switching on); plucked strings always fade.
//   Below the lowest string is ignored.
// - Only open strings: a new peak that isn't a harmonic of a string that's ringing (a
//   chord, a fretted note) means nothing is reported.
// - One string at a time: when one harmonic series explains every new peak, it's one
//   string, however its harmonics line up with other strings (a lone low E contains the B
//   and high E pitches). Of the fundamentals that fit, one at a string of the current
//   tuning wins, then the highest (a series of even harmonics is the octave above).
//   It belongs to the nearest string of the current tuning; if none is close, to the first
//   tuning in the table that has a string there (a guess until a strum confirms it); failing
//   that, to the nearest string however far off (tuning up from slack).
// - Shared harmonics in a strum: a string whose fundamental sits on another ringing
//   string's harmonic counts only if it stands clearly above that string's neighbouring
//   harmonics.
// - A string shows once it's heard in two analyses in a row (and is remembered only then),
//   and stays through one miss, so a stray frame doesn't flicker in or move the reference.
// - To open the tuner, a string must hold its pitch while it fades, like a plucked string;
//   voices and held notes don't. Fading is judged from all its harmonics together: a phone
//   mic barely hears a low string's fundamental. Once it's showing, every analysis updates it.
import { fft } from './onsets';

export type Tuning = { name: string; notes: number[]; names: string[] };

/** MIDI notes, low string to high. Data, not interpretation. */
export const TUNINGS: Tuning[] = [
  { name: 'Standard', notes: [40, 45, 50, 55, 59, 64], names: ['E', 'A', 'D', 'G', 'B', 'E'] },
  {
    name: 'Half step down',
    notes: [39, 44, 49, 54, 58, 63],
    names: ['E♭', 'A♭', 'D♭', 'G♭', 'B♭', 'E♭'],
  },
  { name: 'Drop D', notes: [38, 45, 50, 55, 59, 64], names: ['D', 'A', 'D', 'G', 'B', 'E'] },
  {
    name: 'Whole step down',
    notes: [38, 43, 48, 53, 57, 62],
    names: ['D', 'G', 'C', 'F', 'A', 'D'],
  },
  { name: 'DADGAD', notes: [38, 45, 50, 55, 57, 62], names: ['D', 'A', 'D', 'G', 'A', 'D'] },
  { name: 'Open G', notes: [38, 43, 50, 55, 59, 62], names: ['D', 'G', 'D', 'G', 'B', 'D'] },
  { name: 'Open D', notes: [38, 45, 50, 54, 57, 62], names: ['D', 'A', 'D', 'F♯', 'A', 'D'] },
];
const STANDARD = TUNINGS[0];

export type TunerReading = {
  tuning: Tuning;
  /** The guitar's reference against A440, in cents; null until enough strings ring together. */
  offset: number | null;
  /** Each string against the reference, in cents; null if not heard yet. */
  cents: (number | null)[];
  /** Which strings are ringing now. */
  sounding: boolean[];
  /** The tuning was guessed from single strings; a strum confirms it. */
  guessed: boolean;
};

const DECIMATE = 4; // analysis runs on 12 kHz audio
const WINDOW = 1.2; // seconds per analysis
const EVERY = 0.3; // seconds between analyses
const FFT_SIZE = 16384;
const HARMONICS = 8;
const SEARCH_CENTS = 90; // each string is looked for this far either side of its target
const SHARED_CENTS = 40; // harmonics of two strings this close are shared
const PEAK_DB = 10; // a string's fundamental or 2nd harmonic must stand this far out
const STANDS_OUT_DB = 4; // …and this far above another string's harmonics it sits among
const STRONG_PEAK_DB = 15; // peaks within this of the loudest must belong to a string
const MAX_OFFSET = 50; // beyond this the guitar is in another tuning (half step down…)
const NEW_TUNING_STRINGS = 5; // strings ringing together to change tuning
const REFERENCE_STRINGS = 4; // …to fit a reference from one strum
const KNOWN_STRINGS = 3; // strings heard (together or not) for the guitar's own reference
const MAX_SPREAD = 45; // RMS cents of the strings around the reference
const MIN_LEVEL = -60; // dBFS over the window: quieter isn't analyzed
const LOWEST_HZ = 70; // just under the lowest string of any tuning (D2, 73 Hz)
const NEW_PEAK_DB = 10; // above the steady floor, to count as new sound
const FLOOR_RISE_DB = 1; // per analysis: the floor falls at once and rises this slowly…
const STEADY_ANALYSES = 5; // …except a level this many analyses steady (~1.5 s) is background
const STEADY_DB = 3; // …steady meaning within this range (plucked strings fade faster)
const SERIES_CENTS = 25; // a peak this close to a harmonic belongs to the series
const OTHER_TUNING_CENTS = 50; // a single string this close to another tuning's string
const SLACK_CENTS = 300; // how far off a single string can still be read
const CHORD_OUTLIER_CENTS = 50; // with several strings ringing, readings further off are mismatches
const STEADY_CENTS = 15; // a string's pitch between analyses (pegs turn while tuning)
const SHOW_AFTER = 2; // analyses in a row before a string shows
const KEEP_FOR = 1; // misses a showing string survives // a string's pitch between analyses, to open the tuner
const FADE_DB = 1; // …while it fades at least this much per analysis, FADES in a row
const FADE_SAMPLES = 4096; // the most recent stretch its level is measured over (~0.35 s)
const FADES = 2;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const centsBetween = (a: number, b: number) => 1200 * Math.log2(a / b);
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const levelDb = (x: Float32Array) => {
  let sum = 0;
  for (let i = 0; i < x.length; i++) sum += x[i] * x[i];
  return 10 * Math.log10(sum / x.length + 1e-12);
};

type Spectrum = { db: Float64Array; binHz: number };

function spectrum(x: Float32Array, rate: number): Spectrum {
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const n = Math.min(x.length, FFT_SIZE);
  for (let i = 0; i < n; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  fft(re, im);
  const db = new Float64Array(FFT_SIZE / 2);
  for (let k = 0; k < db.length; k++)
    db[k] = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-20);
  return { db, binHz: rate / FFT_SIZE };
}

/** The strongest peak within `cents` of `freq`, refined between bins. */
function peakNear({ db, binHz }: Spectrum, freq: number, cents: number) {
  const lo = Math.max(1, Math.floor((freq * 2 ** (-cents / 1200)) / binHz));
  const hi = Math.min(db.length - 2, Math.ceil((freq * 2 ** (cents / 1200)) / binHz));
  let best = lo;
  for (let k = lo; k <= hi; k++) if (db[k] > db[best]) best = k;
  const a = db[best - 1],
    b = db[best],
    c = db[best + 1];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return {
    freq: (best + Math.max(-0.5, Math.min(0.5, shift))) * binHz,
    db: b,
    edge: best === lo || best === hi,
  };
}

/** The spectrum's typical level within two semitones of `freq`. */
function background({ db, binHz }: Spectrum, freq: number) {
  const lo = Math.max(1, Math.floor(freq / 1.1225 / binHz));
  const hi = Math.min(db.length - 1, Math.ceil((freq * 1.1225) / binHz));
  return median(Array.from(db.subarray(lo, hi + 1)));
}

/**
 * The loudest distinct new peaks between the lowest string and 1 kHz, in Hz (refined
 * between bins): above the steady floor, if there is one.
 */
function strongPeaks(spec: Spectrum, floor?: Float64Array) {
  const { db, binHz } = spec;
  const lo = Math.ceil(LOWEST_HZ / binHz);
  const hi = Math.floor(1000 / binHz);
  const peaks: { freq: number; db: number }[] = [];
  for (let k = lo; k <= hi; k++)
    if (db[k] > db[k - 1] && db[k] >= db[k + 1] && (!floor || db[k] - floor[k] >= NEW_PEAK_DB))
      peaks.push({ freq: peakNear(spec, k * binHz, 1).freq, db: db[k] });
  const loudest = Math.max(...peaks.map(p => p.db));
  return peaks.filter(p => p.db >= loudest - STRONG_PEAK_DB).map(p => p.freq);
}

/** Is `freq` within SHARED_CENTS of a harmonic of `f`? Which one (0 if not). */
function harmonicOf(freq: number, f: number) {
  const k = Math.round(freq / f);
  return k >= 1 && k <= HARMONICS * 2 && Math.abs(centsBetween(freq, k * f)) < SHARED_CENTS ? k : 0;
}

/**
 * For each string, the harmonics it has to itself when searching: a harmonic shared with
 * another string counts for the one with the lower harmonic number there.
 */
function ownHarmonics(targets: number[]) {
  return targets.map((f, s) => {
    const own: number[] = [];
    for (let k = 1; k <= HARMONICS; k++) {
      const shared = targets.some((g, o) => {
        if (o === s) return false;
        const j = harmonicOf(k * f, g);
        return j > 0 && j <= HARMONICS && (j < k || (j === k && o < s));
      });
      if (!shared) own.push(k);
    }
    return own;
  });
}

type Measured = { cents: number; anchors: { k: number; db: number }[] };

/** One string's deviation from its target in cents, or null if it isn't there. */
function measureString(spec: Spectrum, target: number, own: number[]): Measured | null {
  const floors = own.map(k => background(spec, k * target));
  const above = (k: number, i: number, f: number) => {
    const bin = Math.round((k * f) / spec.binHz);
    if (bin < 1 || bin >= spec.db.length - 1) return 0;
    const level = Math.max(spec.db[bin - 1], spec.db[bin], spec.db[bin + 1]);
    return Math.max(0, level - floors[i]);
  };
  let bestCents = 0;
  let bestScore = -1;
  for (let c = -SEARCH_CENTS; c <= SEARCH_CENTS; c += 2) {
    const f = target * 2 ** (c / 1200);
    const score = own.reduce((sum, k, i) => sum + above(k, i, f) / Math.sqrt(k), 0);
    if (score > bestScore) [bestScore, bestCents] = [score, c];
  }
  if (Math.abs(bestCents) > SEARCH_CENTS - 6) return null;
  const f = target * 2 ** (bestCents / 1200);
  // Refine from each harmonic that stands out; weighted median of their estimates.
  const estimates: { cents: number; weight: number }[] = [];
  const anchors: { k: number; db: number }[] = [];
  own.forEach((k, i) => {
    const peak = peakNear(spec, k * f, 15);
    const height = peak.db - floors[i];
    if (peak.edge || height < PEAK_DB / 2) return;
    if (k <= 2 && height >= PEAK_DB) anchors.push({ k, db: peak.db });
    estimates.push({ cents: centsBetween(peak.freq / k, target), weight: height / Math.sqrt(k) });
  });
  if (!anchors.length) return null;
  estimates.sort((a, b) => a.cents - b.cents);
  const half = estimates.reduce((sum, e) => sum + e.weight, 0) / 2;
  let running = 0;
  for (const e of estimates) if ((running += e.weight) >= half) return { cents: e.cents, anchors };
  return { cents: estimates[estimates.length - 1].cents, anchors };
}

/**
 * Does a peak at `freq` stand out above the harmonics of the strings already heard that it
 * sits on? Their expected level there is that of their neighbouring harmonics, skipping
 * neighbours that another heard string shares.
 */
function standsOut(spec: Spectrum, freq: number, db: number, heard: number[]) {
  return heard.every((f, o) => {
    const j = harmonicOf(freq, f);
    if (j < 2) return true;
    const clean = (n: number) => n >= 1 && heard.every((g, q) => q === o || !harmonicOf(n * f, g));
    const neighbours = [j - 1, j + 1].filter(clean);
    if (!neighbours.length) neighbours.push(j - 1);
    const expected =
      neighbours.reduce((sum, n) => sum + peakNear(spec, n * f, 15).db, 0) / neighbours.length;
    return db >= expected + STANDS_OUT_DB;
  });
}

/**
 * The fundamental of a single harmonic series that explains every new peak, or null (two
 * or more notes, or nothing new).
 */
function singleSeries(peaks: number[], current: Tuning) {
  if (!peaks.length) return null;
  const fits = (f: number) =>
    peaks.every(p => {
      const k = Math.round(p / f);
      return k >= 1 && Math.abs(centsBetween(p, k * f)) < SERIES_CENTS;
    });
  const candidates = peaks
    .flatMap(p => Array.from({ length: HARMONICS }, (_, k) => p / (k + 1)))
    .filter(f => f >= LOWEST_HZ && fits(f));
  if (!candidates.length) return null;
  const atString = candidates.filter(f =>
    current.notes.some(note => Math.abs(centsBetween(f, hz(note))) <= SEARCH_CENTS),
  );
  const rough = Math.max(...(atString.length ? atString : candidates));
  // Refine: every peak's frequency over its harmonic number.
  return median(peaks.map(p => p / Math.round(p / rough)));
}

type Heard = { cents: number } | null;
/** A string heard, with how loud its harmonics are together (dB). */
type Ringing = { cents: number; level: number } | null;

/**
 * The open strings of `tuning` ringing in a spectrum (cents against their targets), or null
 * if something else is sounding too (a chord, a fretted note).
 */
function hearStrings(spec: Spectrum, peaks: number[], tuning: Tuning): Heard[] | null {
  const targets = tuning.notes.map(hz);
  const own = ownHarmonics(targets);
  const heard: Heard[] = targets.map(() => null);
  const heardFreqs: number[] = [];
  // Low to high, so a string's harmonics are known before the strings they could mimic.
  const order = targets.map((_, s) => s).sort((a, b) => targets[a] - targets[b]);
  for (const s of order) {
    const m = measureString(spec, targets[s], own[s]);
    if (!m) continue;
    const f = targets[s] * 2 ** (m.cents / 1200);
    const real = m.anchors.filter(a => standsOut(spec, a.k * f, a.db, heardFreqs));
    if (!real.length) continue;
    heard[s] = { cents: m.cents };
    heardFreqs.push(f);
  }
  if (!heardFreqs.length) return null;
  if (!peaks.every(p => heardFreqs.some(f => harmonicOf(p, f)))) return null;
  return heard;
}

/**
 * Which open strings ring in a stretch of audio: against the current tuning, or another
 * tuning if (nearly) all strings fit it better. Null if it isn't open strings.
 */
export function analyzeStrings(samples: Float32Array, rate: number, current: Tuning = STANDARD) {
  return analyzeSpectrum(spectrum(samples, rate), current);
}

/** How loud a string at `f` is, all its harmonics together (dB). */
function harmonicsLevel(spec: Spectrum, f: number) {
  let power = 0;
  for (let k = 1; k <= HARMONICS && k * f < 1500; k++)
    power += 10 ** (peakNear(spec, k * f, 15).db / 10);
  return 10 * Math.log10(power);
}

function analyzeSpectrum(
  spec: Spectrum,
  current: Tuning,
  floor?: Float64Array,
): {
  tuning: Tuning;
  heard: Heard[];
  reference: number | null;
  guessed?: boolean;
  single?: boolean;
} | null {
  const peaks = strongPeaks(spec, floor);
  const single = singleSeries(peaks, current);
  if (single) return singleString(single, current);
  let best: { tuning: Tuning; heard: Heard[]; reference: number | null; cost: number } | null =
    null;
  for (const tuning of TUNINGS) {
    const heard = hearStrings(spec, peaks, tuning);
    if (!heard) continue;
    const found = heard.flatMap(h => (h ? [h.cents] : []));
    if (tuning !== current && found.length < NEW_TUNING_STRINGS) continue;
    let reference: number | null = null;
    let fit = 0;
    if (found.length >= REFERENCE_STRINGS) {
      reference = median(found);
      if (Math.abs(reference) > MAX_OFFSET) continue;
      const residuals = found.map(c => c - reference!);
      const spread = Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length);
      if (spread > MAX_SPREAD) continue;
      fit =
        residuals.reduce((sum, r) => sum + Math.min(Math.abs(r), 60), 0) / residuals.length +
        0.3 * Math.abs(reference);
    }
    // The tuning already in use wins ties.
    const cost = fit + 25 * (6 - found.length) + (tuning === current ? 0 : 3);
    if (!best || cost < best.cost) best = { tuning, heard, reference, cost };
  }
  if (!best) return null;
  const chosen = best as { tuning: Tuning; heard: Heard[]; reference: number | null };
  // Fewer strings than a strum: one whose pitch is an overtone of a lower ringing string is
  // that string's overtone (a low D's 3rd harmonic is the A above), not another string.
  const targets = chosen.tuning.notes.map(hz);
  const freqs = chosen.heard.map((h, s) => (h ? targets[s] * 2 ** (h.cents / 1200) : 0));
  if (chosen.heard.filter(Boolean).length < REFERENCE_STRINGS)
    chosen.heard = chosen.heard.map((h, s) =>
      h && freqs.some(f => f && f < freqs[s] && harmonicOf(freqs[s], f) >= 2) ? null : h,
    );
  return chosen;
}

/** A single string's pitch: which string it is (see the note at the top) and its reading. */
function singleString(pitch: number, current: Tuning) {
  const nearest = (tuning: Tuning, within: number) => {
    let best: { string: number; cents: number } | null = null;
    tuning.notes.forEach((note, string) => {
      const cents = centsBetween(pitch, hz(note));
      if (Math.abs(cents) <= within && (!best || Math.abs(cents) < Math.abs(best.cents)))
        best = { string, cents };
    });
    return best as { string: number; cents: number } | null;
  };
  let tuning = current;
  let guessed = false;
  let match = nearest(current, SEARCH_CENTS);
  if (!match)
    for (const other of TUNINGS) {
      const m = other !== current && nearest(other, OTHER_TUNING_CENTS);
      if (m) {
        [tuning, match, guessed] = [other, m, true];
        break;
      }
    }
  match ??= nearest(current, SLACK_CENTS);
  if (!match) return null;
  const heard: Heard[] = tuning.notes.map(() => null);
  heard[match.string] = { cents: match.cents };
  return { tuning, heard, reference: null, guessed, single: true };
}

/** Fed the mic audio; reports which open strings ring, and how they're tuned. */
export class GuitarTuner {
  onreading: ((reading: TunerReading) => void) | null = null;
  /** While the tuner is showing: every analysis is reported, ringing or not. */
  live = false;
  /** Off while the metronome plays: audio is still kept, but nothing is analyzed. */
  enabled = true;
  private readonly rate: number;
  private readonly ring: Float32Array;
  private written = 0; // decimated samples written
  private carry = 0;
  private carryCount = 0;
  private nextAnalysis = WINDOW;
  private tuning = STANDARD;
  private guessed = false;
  private reference: number | null = null;
  private deviations: (number | null)[] = STANDARD.notes.map(() => null); // latest, vs A440
  private previous: Ringing[] = STANDARD.notes.map(() => null);
  private fades: number[] = STANDARD.notes.map(() => 0); // analyses in a row each string faded
  private streaks: number[] = STANDARD.notes.map(() => 0); // analyses in a row each was heard
  private misses: number[] = STANDARD.notes.map(() => 0); // …and since it was last heard
  private shown: boolean[] = STANDARD.notes.map(() => false);
  private floor: Float64Array | null = null; // steady level per frequency bin, dB
  private recentSpectra: Float64Array[] = [];
  private wasSounding = false;

  constructor(sampleRate = 48000) {
    this.rate = sampleRate / DECIMATE;
    this.ring = new Float32Array(Math.ceil(this.rate * WINDOW));
  }

  get now() {
    return this.written / this.rate;
  }

  /** Feed mono PCM16, in order. */
  push(pcm: Int16Array) {
    for (let i = 0; i < pcm.length; i++) {
      this.carry += pcm[i] / 32768;
      if (++this.carryCount === DECIMATE) {
        this.ring[this.written++ % this.ring.length] = this.carry / DECIMATE;
        this.carry = 0;
        this.carryCount = 0;
      }
    }
    if (this.now < this.nextAnalysis) return;
    this.nextAnalysis = this.now + EVERY;
    if (!this.enabled) {
      this.previous = this.previous.map(() => null);
      this.fades = this.fades.map(() => 0);
      this.streaks = this.streaks.map(() => 0);
      return;
    }
    this.analyze();
  }

  /** The last `count` decimated samples. */
  private recent(count: number) {
    const n = Math.min(count, this.written, this.ring.length);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = this.ring[(this.written - n + i) % this.ring.length];
    return out;
  }

  private analyze() {
    const window = this.recent(this.ring.length);
    const level = levelDb(window);
    const spec = spectrum(window, this.rate);
    const floor = this.floor;
    this.followFloor(spec.db);
    const result = floor && level >= MIN_LEVEL ? analyzeSpectrum(spec, this.tuning, floor) : null;
    // Each string's level over just the latest audio, so fading shows right after a pluck.
    const latest = spectrum(window.subarray(window.length - FADE_SAMPLES), this.rate);
    const targets = (result?.tuning ?? this.tuning).notes.map(hz);
    let heard: Ringing[] = (result?.heard ?? this.tuning.notes.map(() => null)).map((h, s) =>
      h ? { ...h, level: harmonicsLevel(latest, targets[s] * 2 ** (h.cents / 1200)) } : null,
    );
    // With several strings ringing, a reading far from the rest is a mismatch at the edge of
    // its search, not a string that far off; plucked alone, such a string reads properly.
    if (result && !result.single) {
      const reference = result.reference ?? this.reference ?? 0;
      heard = heard.map(h =>
        h && Math.abs(h.cents - reference) <= CHORD_OUTLIER_CENTS ? h : null,
      );
    }
    if (result && result.tuning !== this.tuning) {
      // Strings the two tunings share keep their readings (drop D to whole step down: low D).
      const before = this.tuning;
      const kept = result.tuning.notes.map((note, s) =>
        before.notes[s] === note ? this.deviations[s] : null,
      );
      this.tuning = result.tuning;
      this.guessed = !!result.guessed;
      this.reference = null;
      this.deviations = kept;
      this.previous = this.tuning.notes.map(() => null);
      this.fades = this.tuning.notes.map(() => 0);
      this.streaks = this.tuning.notes.map(() => 0);
      this.misses = this.tuning.notes.map(() => 0);
      this.shown = this.tuning.notes.map(() => false);
    }
    // A string shows (and is remembered) once heard twice in a row; it survives a miss.
    this.streaks = heard.map((h, s) => (h ? this.streaks[s] + 1 : 0));
    this.misses = heard.map((h, s) => (h ? 0 : this.misses[s] + 1));
    this.shown = this.shown.map(
      (was, s) => this.streaks[s] >= SHOW_AFTER || (was && this.misses[s] <= KEEP_FOR),
    );
    heard.forEach((h, s) => {
      if (h && this.streaks[s] >= SHOW_AFTER) this.deviations[s] = h.cents;
    });
    // Enough strings, heard together or one at a time, set the reference and confirm the tuning.
    const known = this.deviations.filter((d): d is number => d !== null);
    const reference = known.length >= KNOWN_STRINGS ? median(known) : null;
    this.reference = reference !== null && Math.abs(reference) <= MAX_OFFSET ? reference : null;
    if (this.reference !== null || result?.reference != null) this.guessed = false;
    // Opening the tuner takes a string that holds its pitch while fading, like a pluck.
    this.fades = heard.map((h, s) => {
      const before = this.previous[s];
      const faded =
        h &&
        before &&
        Math.abs(h.cents - before.cents) < STEADY_CENTS &&
        h.level <= before.level - FADE_DB;
      return faded ? this.fades[s] + 1 : 0;
    });
    const plucked = this.fades.some(n => n >= FADES);
    this.previous = heard;
    const sounding = [...this.shown];
    const any = sounding.some(Boolean);
    // Live: report every change, including strings falling silent.
    if (this.live ? any || this.wasSounding : plucked)
      this.onreading?.({
        tuning: this.tuning,
        offset: this.reference,
        cents: this.deviations.map(d => (d === null ? null : d - (this.reference ?? 0))),
        sounding,
        guessed: this.guessed,
      });
    this.wasSounding = any;
  }

  /**
   * Each bin's floor falls to the level at once and rises slowly, or straight to a level
   * that has held steady: steady sound only.
   */
  private followFloor(db: Float64Array) {
    this.recentSpectra.push(db);
    if (this.recentSpectra.length > STEADY_ANALYSES) this.recentSpectra.shift();
    if (!this.floor) {
      this.floor = Float64Array.from(db);
      return;
    }
    const full = this.recentSpectra.length === STEADY_ANALYSES;
    for (let k = 0; k < db.length; k++) {
      let floor = Math.min(db[k], this.floor[k] + FLOOR_RISE_DB);
      if (full) {
        let lo = Infinity;
        let hi = -Infinity;
        for (const past of this.recentSpectra) {
          lo = Math.min(lo, past[k]);
          hi = Math.max(hi, past[k]);
        }
        if (hi - lo <= STEADY_DB) floor = Math.max(floor, lo);
      }
      this.floor[k] = floor;
    }
  }
}
