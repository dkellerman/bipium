const numbers = Object.fromEntries(
  [
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
  ].map((word, i) => [word, i + 1]),
);
const tokens = text =>
  text
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
const number = text => numbers[text] ?? (/^(?:[1-9]|1[0-2])$/.test(text) ? Number(text) : null);
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};
const round = value => Math.round(value * 1000) / 1000;

/** Conservative count-only grammar; timestamps describe speech, not a transport clock. */
export function estimateCountOff(prompt, words) {
  const content = tokens(
    prompt.replace(/^\s*(?:count\s*(?:off|in)|count\s*me\s*in)\s*[:,-]?\s*/i, ''),
  );
  if (content.length < 2 || content.some(t => number(t) === null && t !== 'and')) return null;
  if (content[0] === 'and' || content.some((t, i) => t === 'and' && content[i - 1] === 'and'))
    return null;
  const counts = content.filter(t => number(t) !== null).map(number);
  if (counts.length < 2 || counts[0] !== 1) return null;
  const wraps = [];
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] === 1 && counts[i - 1] >= 2) wraps.push(counts[i - 1]);
    else if (counts[i] !== counts[i - 1] + 1) return null;
  }
  if (new Set(wraps).size > 1 || (wraps.length && counts.some(n => n > wraps[0]))) return null;
  const base = {
    detected: true,
    status: 'insufficient_timing',
    bpm: null,
    subdivisions: null,
    beatsPerBar: null,
    countCycleLength: wraps[0] ?? null,
    confidence: 0,
    confidenceMethod: 'timing_consistency_heuristic_not_probability',
    source: 'server_word_timestamp_analysis',
    timeReference: 'seconds_from_microphone_session_start',
    count: counts.length,
    beatIntervalSeconds: null,
    beatTimesSeconds: [],
    note: 'Estimate from spoken word onsets; not a playback synchronization clock. Numbered counts are assumed to be beats; unspoken subdivisions and meter are not inferred.',
  };
  if (!Array.isArray(words) || counts.length < 3)
    return { ...base, reason: 'At least three numbered counts with word timestamps are required.' };
  // Do not invent timing when recognition combines several counts into one word entry.
  const entries = words.map(w => ({ ...w, token: tokens(w.text) }));
  const numeric = entries.filter(w => w.token.some(t => number(t) !== null));
  if (
    numeric.length !== counts.length ||
    numeric.some(
      (w, i) =>
        w.token.length !== 1 ||
        number(w.token[0]) !== counts[i] ||
        !Number.isFinite(w.start) ||
        !Number.isFinite(w.end) ||
        w.start < 0 ||
        w.end < w.start,
    )
  )
    return { ...base, reason: 'Numbered counts do not have separate matching word timestamps.' };
  const times = numeric.map(w => w.start);
  const intervals = times.slice(1).map((t, i) => t - times[i]);
  if (intervals.some(dt => dt <= 0)) return { ...base, reason: 'Count timestamps must increase.' };
  const interval = median(intervals);
  const deviation = Math.max(...intervals.map(dt => Math.abs(dt - interval) / interval));
  const bpm = 60 / interval;
  if (bpm < 30 || bpm > 300 || deviation > 0.2)
    return {
      ...base,
      status: 'uncertain',
      beatTimesSeconds: times,
      reason: 'Count timing is too uneven or outside the supported 30–300 BPM estimate range.',
    };
  let subdivisions = null;
  const ands = entries.filter(w => w.token.length === 1 && w.token[0] === 'and');
  if (!content.includes('and')) subdivisions = 1;
  else if (ands.length === content.filter(t => t === 'and').length) {
    const gaps = times
      .slice(0, -1)
      .map((t, i) => ands.filter(w => w.start > t && w.start < times[i + 1]));
    if (
      gaps.every(
        (gap, i) =>
          gap.length === 1 && Math.abs((gap[0].start - times[i]) / intervals[i] - 0.5) <= 0.15,
      )
    )
      subdivisions = 2;
  }
  return {
    ...base,
    status: 'estimated',
    bpm: Math.round(bpm * 10) / 10,
    subdivisions,
    confidence: round(Math.min(0.95, (counts.length >= 4 ? 0.95 : 0.75) * (1 - deviation))),
    beatIntervalSeconds: round(interval),
    beatTimesSeconds: times,
    timingDeviation: round(deviation),
    reason:
      subdivisions === null
        ? 'Tempo estimated; subdivision timing is inconclusive.'
        : 'Consistent numbered count timing.',
  };
}
