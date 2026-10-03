// Live rhythm tracking from mic onsets with no words: claps, taps, an instrument.
// Display-only: a heard tempo is applied only if the user asks (Jev decides).
//
// Conservative by design, so it doesn't fire on noise or chatter:
// - speech pauses it, unless the audio shows music (held notes: singing or an
//   instrument; or sharp percussion: claps, snaps), in which case it keeps listening
//   and, over percussion, soft syllable-like onsets count less;
// - at least MIN_ONSETS over MIN_SPAN, still going;
// - the estimator must be confident, and the same tempo must hold for several
//   analyses in a row before it's reported; it's reported again only when it changes.
import { estimateRhythm } from '../../server/voice/rhythm.mjs';
import type { MusicEvidence, Onset } from './onsets';

export type HeardRhythm = {
  bpm: number;
  subdivisions: number;
  swing: number;
  confidence: number;
  /** Fewer beats were hit (rests, missed hits): it must hold longer before it's reported. */
  weak?: boolean;
};

const WINDOW = 8; // seconds of onsets analyzed
const MIN_ONSETS = 8;
const MIN_SPAN = 4;
const STILL_GOING = 1.5; // the last onset must be this recent
const MIN_CONFIDENCE = 0.7;
const MIN_CONFIDENCE_OVER_SPEECH = 0.8;
const MIN_COVERAGE = 0.5; // share of the pulse's slots with a hit right on them (rests and missed hits are normal)
const STRONG_COVERAGE = 0.7; // below this a rhythm must hold for longer (WEAK_AGREE)
const MIN_COVERAGE_OVER_CHANCE = 0.4; // …beyond what randomly timed onsets would cover
const AGREE = 2; // consecutive analyses that must agree (about 2 s apart)
const WEAK_AGREE = 3; // …when any of them was weak; random onsets rarely hold a tempo that long
const STOPPED = 2; // empty analyses in a row after which the rhythm counts as stopped
const SAME_TEMPO = 0.03;
// Without words there's no telling 70 from 140; lean mildly towards common tempos.
const TEMPO_PREFERENCE = { center: 110, spread: 0.7 };

/**
 * Accents as soft beat priors: clearly louder than the window's median leans towards a
 * beat. Small strength differences aren't accents; with no real contrast every onset
 * leans towards being a beat (the simplest reading: clapping on the beat).
 */
function audioEvents(onsets: Onset[], softAreLikelySpeech: boolean) {
  const strengths = onsets.map(o => o.strength).sort((a, b) => a - b);
  const at = (q: number) => strengths[Math.floor(q * (strengths.length - 1))];
  const median = at(0.5);
  const contrast = (at(0.9) - at(0.1)) / median;
  const scale = Math.max(at(0.9) - at(0.1), 0.3 * median);
  const base = 0.5 + 0.15 * (1 - Math.min(1, contrast / 0.3));
  return onsets.map(o => ({
    time: o.time,
    outlier: softAreLikelySpeech && o.sharpness < 0.5 ? 0.6 : 0.2,
    beat: Math.min(0.8, Math.max(0.2, base + (0.6 * (o.strength - median)) / scale)),
  }));
}

/** 0…1: how strongly the audio looks like music rather than speech or noise. */
export function musicLikelihood({ heldNotes, sharpOnsets }: MusicEvidence) {
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return Math.max(clamp((heldNotes - 0.05) / 0.25), clamp((sharpOnsets - 0.3) / 0.4));
}

/** What one analysis found, and if nothing, why (shown in voice debug mode). */
export type RhythmDiagnosis = {
  result: HeardRhythm | null;
  reason: string;
  onsets: number;
  pulse?: number;
  coverage?: number;
  chance?: number;
};

/**
 * One analysis of the onsets up to `now` (seconds), or null if there's no clear rhythm.
 * `speech` is music evidence when there was speech in the window (null if none).
 */
export function analyzeOnsets(
  onsets: Onset[],
  now: number,
  speech: MusicEvidence | null = null,
): HeardRhythm | null {
  return diagnoseOnsets(onsets, now, speech).result;
}

export function diagnoseOnsets(
  onsets: Onset[],
  now: number,
  speech: MusicEvidence | null = null,
): RhythmDiagnosis {
  const recent = onsets.filter(o => o.time > now - WINDOW && o.time <= now);
  const none = (reason: string, extra = {}) => ({
    result: null,
    reason,
    onsets: recent.length,
    ...extra,
  });
  if (recent.length < MIN_ONSETS) return none('too few onsets');
  if (recent[recent.length - 1].time - recent[0].time < MIN_SPAN) return none('too short');
  if (now - recent[recent.length - 1].time > STILL_GOING) return none('stopped');
  const percussive = !!speech && speech.sharpOnsets > speech.heldNotes;
  const result = estimateRhythm(audioEvents(recent, percussive), {
    tempoPreference: TEMPO_PREFERENCE,
  });
  if (!result) return none('no tempo fits');
  const scores = {
    pulse: result.pulseConfidence,
    coverage: result.coverage,
    chance: result.chance,
  };
  // Without words, which tempo a pulse is counted at is a guess (settled below); what
  // has to be clear is that there's a steady pulse at all.
  const needed = speech ? MIN_CONFIDENCE_OVER_SPEECH : MIN_CONFIDENCE;
  // Confidences only rank hypotheses; random onsets need ruling out on their own.
  if (result.pulseConfidence < needed) return none('pulse unclear', scores);
  if (result.coverage < MIN_COVERAGE || result.coverage - result.chance < MIN_COVERAGE_OVER_CHANCE)
    return none('not steady', scores);
  // The beat: whichever multiple of the pulse is the most common tempo (how a listener
  // would tap along). Accents may say how the beat divides, if they agree on that beat.
  const pulse = result.bpm * result.subdivisions;
  const counts = [1, 2, 3, 4].filter(k => pulse / k >= 20 && pulse / k <= 320);
  const distance = (k: number) => Math.abs(Math.log(pulse / k / TEMPO_PREFERENCE.center));
  const perBeat = counts.reduce((a, b) => (distance(b) < distance(a) ? b : a));
  const heard =
    result.confidence >= needed && result.subdivisions === perBeat
      ? {
          bpm: result.bpm,
          subdivisions: result.subdivisions,
          swing: result.swing,
          confidence: result.confidence,
        }
      : {
          bpm: Math.round(pulse / perBeat),
          subdivisions: perBeat,
          swing: 0,
          confidence: result.pulseConfidence,
        };
  const weak = result.coverage < STRONG_COVERAGE;
  return {
    result: { ...heard, ...(weak ? { weak } : {}) },
    reason: 'ok',
    onsets: recent.length,
    ...scores,
  };
}

/**
 * Reports a rhythm once it has held steady, and again only when it changes or after
 * the playing has stopped for a while (so playing the same tempo again is reported).
 */
export class RhythmStabilizer {
  private streak: HeardRhythm[] = [];
  private reported: HeardRhythm | null = null;
  private quiet = 0;

  /** Feed each analysis (null = nothing clear); returns a rhythm when one should be reported. */
  next(analysis: HeardRhythm | null): HeardRhythm | null {
    // The same pulse counted differently (55 in eighths, 110 in quarters) still agrees.
    const pulse = (r: HeardRhythm) => r.bpm * r.subdivisions;
    const same = (a: HeardRhythm, b: HeardRhythm) =>
      Math.abs(Math.log(pulse(a) / pulse(b))) < SAME_TEMPO;
    if (!analysis) {
      this.streak = [];
      if (++this.quiet >= STOPPED) this.reported = null;
      return null;
    }
    this.quiet = 0;
    this.streak =
      this.streak.length && same(this.streak[0], analysis)
        ? [...this.streak, analysis]
        : [analysis];
    if (this.streak.length < (this.streak.some(a => a.weak) ? WEAK_AGREE : AGREE)) return null;
    const settled = this.streak[this.streak.length - 1];
    if (this.reported && same(this.reported, settled)) return null;
    this.reported = settled;
    return settled;
  }
}
