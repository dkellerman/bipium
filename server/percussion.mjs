const median = values => {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = n => Math.round(n * 1000) / 1000;

// These are rhythm hypotheses, not an instrument classifier or calibrated probabilities.
export function estimatePercussion(hits) {
  if (hits.length < 4) return null;
  const gaps = hits.slice(1).map((h, i) => h.time - hits[i].time);
  const interval = median(gaps);
  if (interval < 0.15 || interval > 2 || gaps.some(g => Math.abs(g / interval - 1) > 0.2))
    return null;
  const deviation = Math.max(...gaps.map(g => Math.abs(g / interval - 1)));
  let accentGroup = null;
  for (const group of [2, 3, 4]) {
    if (hits.length < group * 3) continue;
    for (let phase = 0; phase < group; phase++) {
      const strong = hits.filter((_, i) => i % group === phase).map(h => h.strength);
      const weak = hits.filter((_, i) => i % group !== phase).map(h => h.strength);
      if (Math.min(...strong) > Math.max(...weak) * 1.6) {
        accentGroup = group;
        break;
      }
    }
    if (accentGroup) break;
  }
  const candidates = [1, 2, 3, 4]
    .map(subdivisions => ({ bpm: Math.round(60 / interval / subdivisions), subdivisions }))
    .filter(c => c.bpm >= 30 && c.bpm <= 300);
  const preferred =
    candidates.find(c => c.subdivisions === accentGroup) ??
    candidates.find(c => c.subdivisions === 1) ??
    candidates[0];
  if (!preferred) return null;
  return {
    classification: 'percussion',
    status: 'estimated',
    ...preferred,
    candidates,
    subdivisionEvidence: accentGroup
      ? 'repeating_accents_tentative'
      : 'ambiguous_assuming_one_hit_per_beat',
    confidence: round(Math.min(0.9, hits.length / 10) * (1 - deviation)),
    confidenceMethod: 'timing_consistency_heuristic_not_probability',
    hitIntervalSeconds: round(interval),
    hitTimesSeconds: hits.map(h => round(h.time)),
    hitStrengths: hits.map(h => round(h.strength)),
    timeReference: 'seconds_from_microphone_session_start',
    note: 'Percussive onsets, not verified instrument identity. Tempo grouping is ambiguous; accents only suggest subdivisions. Playback and other nearby sounds may also be detected.',
  };
}

/** Incremental 48 kHz mono PCM16 detector. Retains only frame statistics and up to 12 onsets. */
export class PercussionDetector {
  constructor() {
    this.samples = 0;
    this.frameSamples = 0;
    this.energy = 0;
    this.peak = 0;
    this.previous = 0;
    this.flux = 0;
    this.floor = 0.001;
    this.lastRms = 0;
    this.pending = null;
    this.hits = [];
    this.lastHit = -10;
    this.speechUntil = -1;
  }
  markSpeech() {
    this.speechUntil = this.samples / 48000 + 1;
    this.hits = [];
    this.pending = null;
  }
  push(buffer) {
    const view = new DataView(buffer);
    const results = [];
    for (let i = 0; i + 1 < view.byteLength; i += 2) {
      const x = view.getInt16(i, true) / 32768;
      this.energy += x * x;
      this.peak = Math.max(this.peak, Math.abs(x));
      this.flux += (x - this.previous) ** 2;
      this.previous = x;
      this.samples++;
      this.frameSamples++;
      if (this.frameSamples !== 480) continue;
      const rms = Math.sqrt(this.energy / 480),
        high = this.flux / (this.energy + 1e-9),
        time = this.samples / 48000;
      if (time > this.speechUntil) {
        if (
          !this.pending &&
          time - this.lastHit > 0.12 &&
          rms > Math.max(0.008, this.floor * 5) &&
          rms > this.lastRms * 2.5 &&
          this.peak > 0.035
        ) {
          this.pending = { time: time - 0.01, strength: rms, high, frames: 1 };
        } else if (this.pending) {
          const p = this.pending;
          p.frames++;
          p.strength = Math.max(p.strength, rms);
          p.high = Math.max(p.high, high);
          // Reject sustained sounds. Short, abrupt broadband attacks are the initial target.
          if (p.frames > 15) this.pending = null;
          else if (rms < p.strength * 0.2) {
            this.pending = null;
            if (p.frames >= 2 && p.high > 0.15) {
              if (p.time - this.lastHit > 2.2) this.hits = [];
              this.lastHit = p.time;
              this.hits.push({ time: p.time, strength: p.strength });
              this.hits = this.hits.slice(-12);
              const estimate = estimatePercussion(this.hits);
              if (estimate) results.push(estimate);
            }
          }
        }
      }
      if (!this.pending) this.floor = 0.98 * this.floor + 0.02 * Math.min(rms, this.floor * 2);
      this.lastRms = rms;
      this.frameSamples = 0;
      this.energy = 0;
      this.peak = 0;
      this.flux = 0;
    }
    return results;
  }
}
