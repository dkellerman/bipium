// The drum request: a second Jev call, made only when the main request routes to a
// drum edit. Each lane gets one whole-lane question (shift it, fill it, empty it) and
// one question per beat, so any edit (add, remove, move, "only on", several hits at
// once) is a choice per affected beat, and whole-lane changes don't need the beats
// to coordinate.
import { choice, picked } from './jev.mjs';
import { LANES, audibleDivisions, describeGrid, nameOf, samePosition, slotName } from './grid.mjs';

// Edits are offered at sixteenth-note resolution, or the grid's own if it's not a
// power of two (triplets etc.). A beat of 8 thirty-seconds is asked as two halves to
// stay under Jev's 255 options per question.
function resolution(config) {
  const divisions = audibleDivisions(config);
  return [1, 2, 4].includes(divisions) ? 4 : divisions;
}
const chunksOf = per => (per === 8 ? [[0, 4], [4, 8]] : [[0, per]]);

function slotsFor(beat, [from, to], per) {
  return Array.from({ length: to - from }, (_, i) => ({
    position: beat + (from + i) / per,
    name: slotName(beat + 1, from + i, per),
  }));
}

const names = slots => slots.map(s => s.name).join(', ');
const subsets = items =>
  Array.from({ length: 2 ** items.length - 1 }, (_, i) => items.filter((_, j) => ((i + 1) >> j) & 1));

const wrap = (p, beats) => (((p % beats) + beats) % beats);
const every = (step, offset, beats) =>
  Array.from({ length: Math.round(beats / step) }, (_, i) => i * step + offset);
const LANE_CHANGES = {
  'earlier-16th': ['Move every {lane} hit a sixteenth earlier', (ps, b) => ps.map(p => wrap(p - 0.25, b))],
  'earlier-8th': ['Move every {lane} hit half a beat earlier', (ps, b) => ps.map(p => wrap(p - 0.5, b))],
  'earlier-beat': ['Move every {lane} hit one beat earlier', (ps, b) => ps.map(p => wrap(p - 1, b))],
  'later-16th': ['Move every {lane} hit a sixteenth later', (ps, b) => ps.map(p => wrap(p + 0.25, b))],
  'later-8th': ['Move every {lane} hit half a beat later', (ps, b) => ps.map(p => wrap(p + 0.5, b))],
  'later-beat': ['Move every {lane} hit one beat later', (ps, b) => ps.map(p => wrap(p + 1, b))],
  quarters: ['{lane} on every beat', (_, b) => every(1, 0, b)],
  eighths: ['{lane} on every eighth note', (_, b) => every(0.5, 0, b)],
  sixteenths: ['{lane} on every sixteenth note', (_, b) => every(0.25, 0, b)],
  offbeats: ['{lane} only on the & of every beat', (_, b) => every(1, 0.5, b)],
  none: ['No {lane} at all', () => []],
};

function laneQuestion(lane, base, beats) {
  const options = { keep: `No whole-${lane} change; specific beats are asked separately` };
  for (const [key, [label, apply]] of Object.entries(LANE_CHANGES)) {
    const result = apply(base[lane], beats);
    const names = result.map(p => nameOf(p, 4)).join(', ') || 'nothing';
    options[key] = `${label.replace('{lane}', lane)} → ${lane} on ${names}`;
  }
  return choice(`WHOLE LANE: does the request change the whole ${lane} part at once?`, options);
}

/** `base` is the starting positions: the current grid, or a chosen style's pattern. */
export function buildDrumRequest({ prompt, recentTurns, alternatives, config, base, style, context }) {
  const per = resolution(config);
  const questions = {};
  const slots = {};
  for (const lane of LANES) {
    questions[`${lane}_all`] = laneQuestion(lane, base, config.beats);
    for (let beat = 0; beat < config.beats; beat++) {
      for (const chunk of chunksOf(per)) {
        const where =
          chunk[1] - chunk[0] === per
            ? `beat ${beat + 1}`
            : `the ${chunk[0] ? 'second' : 'first'} half of beat ${beat + 1}`;
        const id = `${lane}_${beat + 1}${chunk[0] ? 'b' : chunksOf(per).length > 1 ? 'a' : ''}`;
        const beatSlots = slotsFor(beat, chunk, per);
        const hit = beatSlots.filter(s => base[lane].some(p => samePosition(p, s.position)));
        const empty = beatSlots.filter(s => !hit.includes(s));
        // Removing and adding are asked separately, so a hit moved into this beat
        // doesn't read as replacing the hits already here.
        if (hit.length) {
          const options = { keep: `Remove nothing; ${lane} stays on ${names(hit)}` };
          subsets(hit).forEach((set, i) => (options[`r${i}`] = `Remove ${lane} on ${names(set)}`));
          questions[`${id}_remove`] = choice(
            `REMOVE: existing ${lane} hits taken out of ${where}? Only if the request is about the ${lane}, or continues one that was.`,
            options,
          );
          slots[`${id}_remove`] = { lane, remove: true, options: { keep: [], ...Object.fromEntries(subsets(hit).map((set, i) => [`r${i}`, set])) } };
        }
        if (empty.length) {
          const options = { keep: `Add nothing to ${where}` };
          subsets(empty).forEach((set, i) => (options[`a${i}`] = `Add ${lane} on ${names(set)}`));
          questions[`${id}_add`] = choice(
            `ADD: new ${lane} hits put into ${where}? Only if the request is about the ${lane}, or continues one that was.`,
            options,
          );
          slots[`${id}_add`] = { lane, remove: false, options: { keep: [], ...Object.fromEntries(subsets(empty).map((set, i) => [`a${i}`, set])) } };
        }
      }
    }
  }
  return {
    slots,
    request: {
      state: {
        utterance: prompt,
        alternate_transcripts: alternatives,
        recent_utterances: recentTurns,
        bar: `${config.beats} beats; slots are named like 1, e of 1, & of 1, a of 1 (sixteenths) or trip/let (triplets)`,
        starting_grid: style
          ? `The ${style.name} pattern: ${describeGrid({ ...config, ...gridConfig(config, base) })}`
          : describeGrid(config),
        guidance:
          'The user is editing drum hits. Change only what the request asks for and keep every other hit, including hits already in the beat a hit is moved or added to. Moving a hit takes it out of the beat it comes from only. "Just" or "only" means remove that lane\'s other hits. A follow-up that doesn\'t name an instrument means the one most recently discussed. ' +
          'WHOLE LANE questions: shifting, filling or emptying a lane all at once; keep for changes to particular beats. ' +
          'REMOVE questions: existing hits that come out of that beat because they are removed, moved elsewhere, or excluded by "only"; hits moved into a beat never remove the ones already there. ' +
          'ADD questions: new hits in that beat, including hits moved there from elsewhere.',
        ...context,
      },
      questions,
    },
  };
}

// For describing a style's starting grid at sixteenth resolution.
function gridConfig(config, positions) {
  const per = 4;
  const loopPattern = Object.fromEntries(
    LANES.map(lane => [
      lane,
      Array.from({ length: config.beats * per }, (_, i) =>
        positions[lane].some(p => samePosition(p, i / per)),
      ),
    ]),
  );
  return { subDivs: per, playSubDivs: true, loopPattern };
}

/**
 * Resulting positions. A confident whole-lane change replaces that lane; otherwise each
 * confident remove/add answer is applied and everything else kept.
 */
export function readDrumAnswers(answers, slots, base, beats) {
  const positions = Object.fromEntries(LANES.map(lane => [lane, [...base[lane]]]));
  const wholeLane = new Set();
  for (const lane of LANES) {
    const change = picked(answers[`${lane}_all`]);
    if (!change || change === 'keep') continue;
    positions[lane] = LANE_CHANGES[change][1](base[lane], beats);
    wholeLane.add(lane);
  }
  for (const [key, { lane, remove, options }] of Object.entries(slots)) {
    if (wholeLane.has(lane)) continue;
    const set = options[picked(answers[key])] ?? [];
    for (const slot of set) {
      if (remove) positions[lane] = positions[lane].filter(p => !samePosition(p, slot.position));
      else positions[lane].push(slot.position);
    }
  }
  for (const lane of LANES) positions[lane].sort((a, b) => a - b);
  return positions;
}
