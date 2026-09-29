// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { prepare, assemble } from '../../server/voice.mjs';
import { API_DEFAULT_CONFIG } from '../core/api';
function config(divisions = 2, loopMode = false, snare = [1, 3]) {
  return {
    ...structuredClone(API_DEFAULT_CONFIG),
    subDivs: divisions,
    loopMode,
    loopPattern: Object.fromEntries(
      Object.entries({ kick: [0, 2], snare, hat: [0, 1, 2, 3] }).map(([lane, positions]) => [
        lane,
        Array.from({ length: 4 * divisions }, (_, i) => positions.includes(i / divisions)),
      ]),
    ),
  };
}
function answers(p, overrides = {}) {
  return Object.fromEntries(
    Object.entries(p.request.questions).map(([field, q]) => {
      const choice = overrides[field] ?? (Object.hasOwn(q.criteria, 'keep') ? 'keep' : 'play');
      return [
        field,
        { choice, confidence: choice === 'keep' ? 0.3 : 0.95, probabilities: { [choice]: 1 } },
      ];
    }),
  );
}
const positions = (c, lane) =>
  c.loopPattern[lane].flatMap((hit, i) => (hit ? [i / (c.playSubDivs ? c.subDivs : 1)] : []));
describe('coherent drum edits across modes and grids', () => {
  it.each([1, 2, 4])(
    'moves only a named hit to an offbeat on grid %s and enables its prerequisites',
    divisions => {
      const base = config(divisions);
      const p = prepare('move the snare from beat 4 to the and of 2', base);
      const key = Object.keys(p.request.questions.snare.criteria).find(k =>
        /move.*from beat 4 to the and of beat 2/i.test(p.request.questions.snare.criteria[k]),
      );
      expect(key).toBeTruthy();
      const c = assemble(p, answers(p, { snare: key }), base).call.args[0];
      expect(c.loopMode).toBe(true);
      expect(c.playSubDivs).toBe(true);
      expect(positions(c, 'snare')).toEqual([1, 1.5]);
      expect(positions(c, 'kick')).toEqual([0, 2]);
      expect(positions(c, 'hat')).toEqual([0, 1, 2, 3]);
      expect(c.bpm).toBe(base.bpm);
    },
  );
  it('offers the same move for and/end in a musical position without altering the original transcript', () => {
    const base = config(2, false, [2]);
    const a = prepare('move the snare to the and of 2', base);
    const b = prepare('move the snare to the end of 2', base);
    expect(b.request.questions.snare.criteria).toEqual(a.request.questions.snare.criteria);
    expect(b.request.state.request).toBe('move the snare to the end of 2');
  });
  it('enables subdivisions for an edit while preserving the other lanes', () => {
    const base = { ...config(1), playSubDivs: false };
    const p = prepare('add a kick on the e of 3', base);
    const key = Object.keys(p.patterns.kick).find(
      k => JSON.stringify(p.patterns.kick[k]) === '[0,2,2.25]',
    );
    expect(key).toBeTruthy();
    const c = assemble(p, answers(p, { kick: key }), base).call.args[0];
    expect(c.loopMode).toBe(true);
    expect(c.playSubDivs).toBe(true);
    expect(c.subDivs).toBe(4);
    expect(positions(c, 'kick')).toEqual([0, 2, 2.25]);
    expect(positions(c, 'snare')).toEqual([1, 3]);
  });
  it('reports an unresolved edit without starting playback or claiming a change', () => {
    const base = config();
    const p = prepare('move the snare to the and of 2', base);
    const result = assemble(p, answers(p), base);
    expect(result.call).toBeNull();
    expect(result.playback).toBeUndefined();
    expect(result.message).toMatch(/which|unchanged|couldn.t/i);
  });
});

describe('drum edit operations', () => {
  it.each([
    ['move the snare to the and of two', [2], [1.5]],
    ['move the snare to the end of two', [2], [1.5]],
    ['move the snare from the and of 2 to the a of 4', [1.5, 3], [3, 3.75]],
    ['shift the snare back half a beat', [1, 3], [0.5, 2.5]],
    ['move the snare on beat four later by two beats', [1, 3], [1]],
    ['move all the snare hits to the and of 2', [1, 3], [1.5]],
    ['nudge the snare forward one sixteenth note', [1, 3], [1.25, 3.25]],
  ])('%s', (prompt, source, expected) => {
    const base = config(4, false, source);
    const p = prepare(prompt, base);
    const c = assemble(p, answers(p, { snare: 'edit:move' }), base).call.args[0];
    expect(positions(c, 'snare')).toEqual(expected);
    expect(positions(c, 'kick')).toEqual([0, 2]);
    expect(c.loopMode).toBe(true);
  });
  it.each([
    'move the snare from beat 1 to the and of 2',
    'move the snare to beat 8',
    'move the snare from 2 and 4 to the and of 2',
  ])('keeps the whole beat when a move is invalid or ambiguous: %s', prompt => {
    const base = config();
    const p = prepare(prompt, base);
    expect(assemble(p, answers(p), base).call).toBeNull();
  });
  it('does not normalize a song title or generate edit instructions from negation', () => {
    for (const prompt of ['play the song End of 2', 'do not move the snare to the end of 2']) {
      const p = prepare(prompt, config());
      expect(p.request.state.musical_reading).toBe(prompt);
      expect(p.editContext.targeted).toEqual([]);
    }
  });
  it('can add two requested positions without erasing the existing lane', () => {
    const base = config(1);
    const p = prepare('add kick on the and of 2 and the e of 4', base);
    const c = assemble(p, answers(p, { kick: 'edit:add:1.5,3.25' }), base).call.args[0];
    expect(positions(c, 'kick')).toEqual([0, 1.5, 2, 3.25]);
    expect(positions(c, 'snare')).toEqual([1, 3]);
  });
  it('rejects a grid that cannot preserve both the old and new hits', () => {
    const base = config(7, true, [1 / 7]);
    const p = prepare('add snare on the and of 2', base);
    const result = assemble(p, answers(p, { snare: 'edit:add:1.5' }), base);
    expect(result.call).toBeNull();
    expect(result.message).toContain('unchanged');
  });
});

it.each([
  ['add a kick on the and of 2', 'kick'],
  ['remove the hat on beat 2', 'hat'],
  ['put snare only on beat 4', 'snare'],
  ['move the snare from beat 4 to the and of 2', 'snare'],
])('offers one complete edit without duplicate confidence choices: %s', (prompt, lane) => {
  const p = prepare(prompt, config());
  const keys = Object.keys(p.request.questions[lane].criteria);
  expect(keys).toHaveLength(2);
  expect(keys).toContain('keep');
});
