/** Timing arithmetic only. Jev selects anchors and their musical spacing. No text is read. */
export function estimateCountOff(words, { first, last, intervals, subdivisions }) {
  const unavailable = reason => ({ status: 'insufficient_timing', bpm: null, reason });
  if (
    !Array.isArray(words) ||
    !Number.isInteger(first) ||
    !Number.isInteger(last) ||
    first < 0 ||
    last <= first ||
    last >= words.length ||
    !Number.isInteger(intervals) ||
    intervals < 1 ||
    intervals > 79 ||
    !Number.isInteger(subdivisions) ||
    subdivisions < 1 ||
    subdivisions > 8
  )
    return unavailable('The count-off needs reliable timing anchors and musical spacing.');
  const start = words[first]?.start;
  const end = words[last]?.start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start)
    return unavailable('The selected count-off timestamps are missing or out of order.');
  const beatIntervalSeconds = ((end - start) * subdivisions) / intervals;
  const bpm = Math.round((60 / beatIntervalSeconds) * 10) / 10;
  if (bpm < 30 || bpm > 300)
    return unavailable('The selected timing falls outside the 30–300 BPM count-off range.');
  return {
    status: 'estimated',
    bpm,
    subdivisions,
    beatIntervalSeconds,
    source: 'server_arithmetic_from_jev_selected_anchors',
    firstWordIndex: first,
    lastWordIndex: last,
    intervals,
    timeReference: 'seconds_from_microphone_session_start',
    note: 'Average tempo from model-selected speech timing; not phase-synchronized playback.',
  };
}
