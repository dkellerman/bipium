// Count-in timing, used only after Jev has decided the utterance is a count-in (see the
// approved exception in AGENTS.md). Turns the transcript's timed words, and when needed
// the browser's audio onsets, into events for the general rhythm estimator.
//
// Words only shape soft evidence; number values are never used to place beats:
// numerals lean towards beats, words repeated among distinct ones ("and", "e") lean
// towards subdivisions, words that are neither lean towards being talk, and "one"/"1"
// counts extra as a likely bar start when it recurs.
//
// Tiers, words first:
// 1. The transcript's own word timing. If that's confident, it's the answer.
// 2. Otherwise audio onsets from the browser may help, but only if they line up with the
//    words (real speech can split a word into several onsets or miss one). Matched words
//    take their onset's time; onsets the transcript missed (as loud as the words) join
//    as extra events; word labels soften when onsets are denser than the transcriber's
//    timing error.
// 3. An audio-based reading replaces the words-only one only if it's clearly better.
import { estimateRhythm } from './rhythm.mjs';

const NUMBER_WORDS = new Set(
  'one two three four five six seven eight nine ten eleven twelve'.split(' '),
);
const normalize = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');
const isNumeral = t => /^\d+$/.test(t) || NUMBER_WORDS.has(t);
const WORDS_SURE = 0.8; // the transcript's timing alone is trusted at this confidence
const ALIGNED_SHARE = 0.75; // audio is used only if this share of words match an onset
const AUDIO_MARGIN_OF_BETTER = 0.15; // …and its reading must beat the words' by this much
const MATCH_WINDOW = 0.2; // a word and an audio onset this close are the same event
const AUDIO_MARGIN = 0.6; // audio onsets considered around the words, in seconds
const QUIETER_DB = 15; // unclaimed onsets this much quieter than the words are ignored
const LABELS_RELIABLE = 0.35; // onset spacing (s) at which word labels keep full weight
const LABELS_UNRELIABLE = 0.1; // …and at which they carry none

function wordEvents(words) {
  const tokens = words.map(w => normalize(w.text));
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  const numbered = tokens.some(isNumeral);
  const informative = counts.size > 1; // repetition says nothing if every word is the same
  return words.map(({ start }, i) => {
    const token = tokens[i];
    const barStart = token === 'one' || token === '1';
    if (isNumeral(token)) return { time: start, token, barStart, beat: 0.85, outlier: 0.05 };
    if (informative && counts.get(token) > 1)
      return { time: start, token, beat: numbered ? 0.15 : 0.25, outlier: 0.1 };
    // Neither a numeral nor a repeating syllable: with numerals around, likely talk.
    return { time: start, token, beat: 0.5, outlier: numbered ? 0.4 : 0.15 };
  });
}

/**
 * Match words to audio onsets in order; matched words take the onset's time. Returns
 * the retimed word events and the onsets no word claimed.
 */
function align(events, onsets) {
  const from = events[0].time - AUDIO_MARGIN;
  const to = events[events.length - 1].time + AUDIO_MARGIN;
  const nearby = onsets.filter(o => o.time >= from && o.time <= to);
  const claimed = new Set();
  let after = -Infinity;
  const retimed = events.map(event => {
    let best = -1;
    nearby.forEach((o, i) => {
      if (claimed.has(i) || o.time <= after || Math.abs(o.time - event.time) > MATCH_WINDOW) return;
      if (best < 0 || Math.abs(o.time - event.time) < Math.abs(nearby[best].time - event.time)) best = i;
    });
    if (best < 0) return event;
    claimed.add(best);
    after = nearby[best].time;
    return { ...event, time: nearby[best].time };
  });
  return {
    retimed,
    matched: nearby.filter((_, i) => claimed.has(i)),
    unclaimed: nearby.filter((_, i) => !claimed.has(i)),
    nearby,
  };
}

/** Blend each event's beat prior towards neutral by how reliably labels attach to onsets. */
function soften(events, onsets) {
  const gaps = onsets.slice(1).map((o, i) => o.time - onsets[i].time).sort((a, b) => a - b);
  if (!gaps.length) return events;
  const spacing = gaps[Math.floor(gaps.length / 2)];
  const reliability = Math.min(
    1,
    Math.max(0, (spacing - LABELS_UNRELIABLE) / (LABELS_RELIABLE - LABELS_UNRELIABLE)),
  );
  return events.map(e => ({ ...e, beat: 0.5 + (e.beat - 0.5) * reliability }));
}

/**
 * Tempo, subdivisions, swing and beats per bar of a spoken count-in, or null.
 * `subdivisions`, when Jev read it from the words, fixes how the beat is divided.
 */
export function estimateCountIn({ words = [], onsets = [], subdivisions = null } = {}) {
  const rhythm = events => estimateRhythm(events, { subdivisions });
  // Bare punctuation the transcriber stamped as a word isn't a spoken event.
  const timed = words.filter(w => Number.isFinite(w.start) && normalize(w.text));
  if (timed.length < 3) return null;
  const events = wordEvents(timed);

  // 1. The transcript's own timing. When that's confident, it's the answer.
  const fromWords = withSource(rhythm(events), 'words');
  if (!onsets.length || (fromWords && fromWords.confidence >= WORDS_SURE)) return fromWords;

  // 2. Audio only helps if its onsets actually line up with the words; real speech can
  //    split one word into several onsets or miss a word, and then it's noise.
  const aligned = align(events, onsets);
  if (aligned.matched.length < ALIGNED_SHARE * events.length) return fromWords;

  // Onsets much quieter than the spoken words (metronome bleed, echo, noise) aren't
  // syllables the transcript missed.
  const voiced = aligned.matched.map(o => o.level).filter(Number.isFinite).sort((a, b) => a - b);
  const typical = voiced.length ? voiced[Math.floor(voiced.length / 2)] : -Infinity;
  const strongEnough = o => !Number.isFinite(o.level) || o.level >= typical - QUIETER_DB;
  const unclaimed = aligned.unclaimed.filter(strongEnough);
  const nearby = aligned.nearby.filter(o => aligned.matched.includes(o) || strongEnough(o));
  const retimed = soften(aligned.retimed, nearby);
  const numbered = events.some(e => isNumeral(e.token));
  const extra = unclaimed.map(o => ({ time: o.time, beat: numbered ? 0.2 : 0.5, outlier: 0.25 }));
  const candidates = [
    withSource(rhythm(retimed), 'words+audio timing'),
    withSource(rhythm([...retimed, ...extra]), 'words+audio'),
  ].filter(c => c && c.confidence > 0.5);

  // 3. An audio-based reading replaces the words-only one only if it's clearly better.
  const best = candidates.sort((a, b) => b.confidence - a.confidence)[0];
  if (best && (!fromWords || best.confidence >= fromWords.confidence + AUDIO_MARGIN_OF_BETTER))
    return best;
  return fromWords ?? best ?? null;
}

const withSource = (result, source) => result && { ...result, source };
