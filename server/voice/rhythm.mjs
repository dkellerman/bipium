// General rhythm estimation from timed events: spoken count-ins today, claps and music
// later. A converging hypothesis process: each hypothesis is a beat period, a phase, a
// number of subdivisions and optionally swing. Every event either sits near a slot of
// that grid or is an outlier; missing subdivisions just leave slots empty. Each
// hypothesis is refined until it settles (weighted least squares on the slots its events
// fall into), then scored, and the scores become probabilities.
//
// Evidence beyond timing comes only from soft per-event priors supplied by the caller:
// - `beat`: chance the event lands on a beat rather than between beats;
// - `outlier`: chance it isn't part of the rhythm at all;
// - `token`: an optional label; the same token recurring in time is evidence for the
//   beat period, and recurring across beats is evidence for beats per bar
//   (`barStart` tokens count extra);
// - a subdivision slot that's empty in every beat is evidence against that subdivision.
// Swing is a parameter some hypotheses carry (every second slot lands late); a swung
// hypothesis pays for it, so slightly uneven timing stays straight.

const SLOT_SPREAD = 0.15; // timing error, as a fraction of a slot
const EMPTY_SLOT = Math.log(0.75); // cost of a grid slot with nothing in it
const NEVER_USED_SLOT = Math.log(0.2); // extra cost when that slot is empty in every beat
const RECURRENCE_SPREAD = 0.08; // in log beat period
const SUBDIVISIONS = [1, 2, 3, 4];
const SWING_COST = Math.log(3); // evidence a swung reading needs beyond a straight one
const MIN_SWING = 0.28; // spoken straight counts drift to ~0.25 (a late "and"); triplet swing is 0.33
const SWING_SURE = 0.6;
const SWING_STARTS = [0.2, 0.33, 0.45]; // swung fits start light, triplet and hard
const TEMPO_WINDOW = 0.03; // tempos within 3% are the same answer
const ON_GRID = 0.1; // an event this close to a slot (in slots) is on the grid
const BAR_SURE = 0.8;
const BPM_RANGE = [20, 320];

const BAR_START_WEIGHT = 3; // a recurring bar-start token is the strongest sign of a bar

/** Typical time between recurrences of the same token (likely one beat), or null. */
function recurrence(events) {
  const labeled = events.filter(e => e.token);
  const last = new Map();
  const gaps = [];
  for (const { token, time } of labeled) {
    if (last.has(token)) gaps.push(time - last.get(token));
    last.set(token, time);
  }
  if (gaps.length < 2 || new Set(labeled.map(e => e.token)).size < 2) return null;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

const normal = (x, spread) =>
  Math.exp(-0.5 * (x / spread) ** 2) / (spread * Math.sqrt(2 * Math.PI));

// Solve the weighted least-squares normal equations (small, so plain elimination).
function solve(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let c = 0; c < n; c++) {
    const pivot = a
      .slice(c)
      .reduce((best, row, i) => (Math.abs(row[c]) > Math.abs(a[best][c]) ? c + i : best), c);
    [a[c], a[pivot]] = [a[pivot], a[c]];
    if (Math.abs(a[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}

/** Refine one hypothesis until it settles, then score it. */
function fit(times, events, beat, subdivisions, phase, swing, recurs) {
  let slot = beat / subdivisions;
  let start = phase;
  // How late every second slot lands, in seconds; a swung fit starts from a guess
  // (as a share of a slot) since events far from straight would read as outliers.
  const swung = swing > 0;
  let delay = swing * slot;
  let result;
  for (let iteration = 0; iteration < 20; iteration++) {
    let score = swung ? -SWING_COST : 0;
    const assigned = [];
    for (let i = 0; i < times.length; i++) {
      const raw = (times[i] - start) / slot;
      let index = Math.round(raw);
      if (swung && ((index % 2) + 2) % 2 === 1 && raw - index < 0 && delay > 0) {
        // A late event may belong to the slot before, pushed back by swing.
        if (Math.abs(raw - (index - 1) - delay / slot) < Math.abs(raw - index)) index -= 1;
      }
      const odd = ((index % 2) + 2) % 2 === 1;
      const error = raw - index - (odd ? delay / slot : 0); // in slots
      const onBeat = ((index % subdivisions) + subdivisions) % subdivisions === 0;
      const { beat: onBeatChance, outlier: outlierChance } = events[i];
      const position = onBeat ? onBeatChance : 1 - onBeatChance;
      const inlier = (1 - outlierChance) * normal(error, SLOT_SPREAD) * position;
      const outlier = outlierChance; // uniform over a slot
      score += Math.log(inlier + outlier);
      assigned.push({
        event: i,
        time: times[i],
        index,
        odd,
        error,
        weight: inlier / (inlier + outlier),
      });
    }
    const counted = assigned.filter(a => a.weight > 0.5);
    if (counted.length < 3) return null;
    const indexes = counted.map(a => a.index);
    const span = Math.max(...indexes) - Math.min(...indexes) + 1;
    score += (span - new Set(indexes).size) * EMPTY_SLOT;
    if (span >= 2 * subdivisions) {
      const used = new Set(indexes.map(i => ((i % subdivisions) + subdivisions) % subdivisions));
      score += (subdivisions - used.size) * NEVER_USED_SLOT;
    }
    if (recurs) {
      const off = Math.log((slot * subdivisions) / recurs) / RECURRENCE_SPREAD;
      score += Math.log(0.2 + 0.8 * Math.exp(-0.5 * off * off));
    }
    // Coverage: the share of grid slots (from first to last event) with an event right on
    // them, among the events likely to belong to the rhythm (by their prior). Extra
    // events between slots don't lower it; `chance` is what events this dense but
    // randomly timed would cover.
    const likely = assigned.filter(a => events[a.event].outlier < 0.5);
    const judged = likely.length ? likely : assigned;
    const judgedIndexes = judged.map(a => a.index);
    const slots = Math.max(...judgedIndexes) - Math.min(...judgedIndexes) + 1;
    const hit = new Set(judged.filter(a => Math.abs(a.error) < ON_GRID).map(a => a.index)).size;
    const coverage = hit / slots;
    const chance = 1 - Math.exp((-judged.length / slots) * 2 * ON_GRID);
    result = {
      score,
      slot,
      start,
      delay,
      counted: counted.length,
      assigned: counted,
      coverage,
      chance,
    };

    // Weighted least squares: time = start + index * slot (+ delay on odd slots).
    const features = ({ index, odd }) => (swung ? [1, index, odd ? 1 : 0] : [1, index]);
    const size = swung ? 3 : 2;
    const matrix = Array.from({ length: size }, () => Array(size).fill(0));
    const vector = Array(size).fill(0);
    for (const a of assigned) {
      const x = features(a);
      for (let r = 0; r < size; r++) {
        vector[r] += a.weight * x[r] * a.time;
        for (let c = 0; c < size; c++) matrix[r][c] += a.weight * x[r] * x[c];
      }
    }
    const solution = solve(matrix, vector);
    if (!solution || !(solution[1] > 0)) break;
    const [nextStart, nextSlot, nextDelay = 0] = solution;
    const clampedDelay = Math.min(Math.max(nextDelay, 0), 0.9 * nextSlot);
    const settled =
      Math.abs(nextSlot - slot) < 1e-5 &&
      Math.abs(nextStart - start) < 1e-5 &&
      Math.abs(clampedDelay - delay) < 1e-5;
    slot = nextSlot;
    start = nextStart;
    delay = clampedDelay;
    if (settled) break;
  }
  return (
    result && {
      ...result,
      bpm: 60 / (result.slot * subdivisions),
      subdivisions,
      swing: swung ? result.delay / result.slot : 0,
    }
  );
}

/**
 * Best estimate of tempo, subdivisions, swing and (when evidence allows) beats per bar,
 * with probability-like confidences, or null when the timing supports no hypothesis.
 *
 * `events` are timed onsets: { time, beat, outlier, token?, oneLike? }, where `beat` is
 * the prior chance the event lands on a beat (vs between beats), `outlier` the chance it
 * isn't part of the rhythm at all, and `token` an optional label for recurrence.
 */
export function estimateRhythm(
  input = [],
  { tempoPreference = null, subdivisions: only = null } = {},
) {
  // A known division of the beat (e.g. from what a count-in said) narrows the hypotheses.
  const divisions = only ? [only] : SUBDIVISIONS;
  const events = input.filter(e => Number.isFinite(e.time)).sort((a, b) => a.time - b.time);
  if (events.length < 3) return null;
  const times = events.map(e => e.time);
  const recurs = recurrence(events);
  const many = events.length > 16;

  // Starting beat periods: gaps between nearby onsets, as one or more slots. With many
  // events, only the most common gaps are tried (a smoothed histogram's peaks).
  const seeds = [];
  const gapSeeds = many ? commonGaps(times) : null;
  for (let i = 0; i < times.length; i++)
    for (let j = i + 1; j < Math.min(times.length, i + 9); j++)
      for (let slots = 1; slots <= j - i; slots++) {
        const slot = (times[j] - times[i]) / slots;
        if (gapSeeds && !gapSeeds.some(g => Math.abs(Math.log(slot / g)) < 0.04)) continue;
        for (const subdivisions of divisions) {
          // Gaps can span a swung pair unevenly; seeding with pairs of slots covers that.
          const beat = slot * subdivisions;
          const bpm = 60 / beat;
          if (bpm >= BPM_RANGE[0] && bpm <= BPM_RANGE[1]) seeds.push({ beat, subdivisions });
        }
      }
  const unique = new Map();
  for (const seed of seeds)
    unique.set(`${seed.subdivisions}:${Math.round(Math.log(seed.beat) * 40)}`, seed);
  // Phases: the first events, or with many events the ones most likely on a beat.
  const phases = many
    ? [...events]
        .sort((a, b) => b.beat - a.beat)
        .slice(0, 6)
        .map(e => e.time)
    : times.slice(0, 8);

  const fits = [];
  for (const { beat, subdivisions } of unique.values())
    for (const phase of phases)
      // Swing only exists between pairs of slots (as in the player).
      for (const swing of subdivisions % 2 === 0 ? [0, ...SWING_STARTS] : [0]) {
        const result = fit(times, events, beat, subdivisions, phase, swing, recurs);
        if (!result || result.bpm < BPM_RANGE[0] || result.bpm > BPM_RANGE[1]) continue;
        // Optional mild preference for common tempos, to settle double/half-time ties.
        if (tempoPreference)
          result.score -=
            0.5 * (Math.log(result.bpm / tempoPreference.center) / tempoPreference.spread) ** 2;
        fits.push(result);
      }
  if (!fits.length) return null;

  // Turn scores into probabilities. Nearby tempos are the same answer, so confidence
  // is the probability within a few percent of the best hypothesis.
  const best = fits.reduce((a, b) => (b.score > a.score ? b : a));
  const mass = f => Math.exp(f.score - best.score);
  const total = fits.reduce((sum, f) => sum + mass(f), 0);
  const near = fits.filter(f => Math.abs(Math.log(f.bpm / best.bpm)) < TEMPO_WINDOW);
  const nearMass = near.reduce((sum, f) => sum + mass(f), 0);
  const bpm = Math.round(near.reduce((sum, f) => sum + mass(f) * f.bpm, 0) / nearMass);
  // A steady pulse with nothing to tell the beat apart fits as quarters, or as eighths at
  // half the tempo, triplets at a third… about equally well: the same hits, counted
  // differently. How sure we are that there's a pulse at all counts those together.
  const pulse = f => f.bpm * f.subdivisions;
  const pulseMass = fits
    .filter(f => Math.abs(Math.log(pulse(f) / pulse(best))) < TEMPO_WINDOW)
    .reduce((sum, f) => sum + mass(f), 0);

  // Subdivisions: whichever reading holds the most probability near that tempo.
  const bySubdivision = new Map();
  for (const f of near)
    bySubdivision.set(f.subdivisions, (bySubdivision.get(f.subdivisions) ?? 0) + mass(f));
  const [subdivisions] = [...bySubdivision].sort((a, b) => b[1] - a[1])[0];
  const same = near.filter(f => f.subdivisions === subdivisions);
  const sameMass = same.reduce((sum, f) => sum + mass(f), 0);
  // Swing, cautiously: only when the swung readings clearly win and it's big enough.
  const swung = same.filter(f => f.swing > 0);
  const swungMass = swung.reduce((sum, f) => sum + mass(f), 0);
  const swingAmount = swungMass
    ? swung.reduce((sum, f) => sum + mass(f) * f.swing, 0) / swungMass
    : 0;
  const swingConfidence = swungMass / sameMass;
  const round = x => Number(x.toFixed(3));
  const bar = beatsPerBar(
    same.reduce((a, b) => (b.score > a.score ? b : a)),
    events,
  );
  return {
    bpm,
    confidence: round(nearMass / total),
    pulseConfidence: round(pulseMass / total),
    // Absolute, unlike the confidences: how fully events cover the best grid's slots,
    // and how much of that random timing would manage anyway.
    coverage: round(best.coverage),
    chance: round(best.chance),
    subdivisions,
    subdivisionConfidence: round(sameMass / nearMass),
    swing:
      swingConfidence >= SWING_SURE && swingAmount >= MIN_SWING
        ? Math.round(swingAmount * 20) * 5
        : 0,
    swingConfidence: round(swingConfidence),
    eventsCounted: same.reduce((a, b) => (b.score > a.score ? b : a)).counted,
    beats: bar && bar.confidence >= BAR_SURE ? bar.beats : null,
    beatsConfidence: bar ? round(bar.confidence) : 0,
  };
}

/** Peaks of a smoothed histogram of gaps between nearby events: likely slot periods. */
function commonGaps(times) {
  const bins = new Map(); // log-spaced bins, smoothed with neighbors
  for (let i = 0; i < times.length; i++)
    for (let j = i + 1; j < Math.min(times.length, i + 5); j++) {
      const gap = times[j] - times[i];
      if (gap < 0.06 || gap > 3) continue;
      const bin = Math.round(Math.log(gap) * 30);
      for (const [d, w] of [
        [-1, 0.5],
        [0, 1],
        [1, 0.5],
      ])
        bins.set(bin + d, (bins.get(bin + d) ?? 0) + w);
    }
  return [...bins]
    .filter(([bin, n]) => n >= (bins.get(bin - 1) ?? 0) && n >= (bins.get(bin + 1) ?? 0))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([bin]) => Math.exp(bin / 30));
}

/**
 * Beats per bar from how labeled events recur across the beats of the best grid: a
 * token that comes back after exactly N beats supports N (a bar-start-like one, more
 * so); a gap that N doesn't divide counts against it. No recurrence means no evidence,
 * and the meter is kept.
 */
function beatsPerBar(best, events) {
  const beatWords = best.assigned
    .filter(a => ((a.index % best.subdivisions) + best.subdivisions) % best.subdivisions === 0)
    .map(a => ({ ...events[a.event], beat: Math.round(a.index / best.subdivisions) }))
    .filter(e => e.token);
  const gaps = [];
  const last = new Map();
  for (const { beat, token, barStart } of beatWords) {
    if (last.has(token) && beat > last.get(token))
      gaps.push({ gap: beat - last.get(token), barStart });
    last.set(token, beat);
  }
  if (!gaps.length) return null;
  const scores = [{ beats: null, score: 0 }]; // no meter change
  for (let beats = 2; beats <= 12; beats++) {
    let score = 0;
    for (const { gap, barStart } of gaps) {
      const evidence = gap === beats ? Math.log(3) : gap % beats === 0 ? 0 : Math.log(0.3);
      score += barStart ? BAR_START_WEIGHT * evidence : evidence;
    }
    scores.push({ beats, score });
  }
  const top = Math.max(...scores.map(x => x.score));
  const total = scores.reduce((sum, x) => sum + Math.exp(x.score - top), 0);
  const winner = scores.find(x => x.score === top);
  return winner.beats ? { beats: winner.beats, confidence: 1 / total } : null;
}
