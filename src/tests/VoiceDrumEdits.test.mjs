// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { prepare as prepareMain, assemble } from '../../server/voice.mjs';
import { API_DEFAULT_CONFIG } from '../core/api';
const current = structuredClone(API_DEFAULT_CONFIG);
// Existing execution tests exercise the full specialist candidate set.
const prepare = (prompt, config, history = [], alternatives = [], words) =>
  prepareMain(prompt, config, history, alternatives, words, true);
function answers(p, overrides = {}) {
  return Object.fromEntries(
    Object.entries(p.request.questions).map(([field, q]) => {
      const choice = overrides[field] ?? (Object.hasOwn(q.criteria, 'keep') ? 'keep' : 'play');
      return [field, { choice, confidence: 0.95, probabilities: { [choice]: 1 } }];
    }),
  );
}
// These regressions guard the architecture, rather than testing a language parser.
describe('Jev owns command interpretation', () => {
  it.each([
    'move the snare to the end of two',
    'do not move the snare to the and of 2',
    'switch to drum mode',
    'switch to beat mode',
    'eighty five beats per minute',
    '85 BPM',
  ])('does not narrow command choices or rewrite the transcript: %s', prompt => {
    const p = prepare(prompt, current);
    const baseline = prepare('unrelated speech', current);
    for (const field of [
      'tempo',
      'tempoHigh',
      'swing',
      'volume',
      'loopRepeats',
      'loopMode',
      'subDivs',
    ])
      expect(p.request.questions[field]).toEqual(baseline.request.questions[field]);
    for (const lane of ['kick', 'hat', 'snare']) {
      // Retrieved reference examples are optional catalog results, not parsed commands.
      const choices = q =>
        Object.fromEntries(Object.entries(q.criteria).filter(([key]) => !key.startsWith('ref')));
      expect(choices(p.request.questions[lane])).toEqual(choices(baseline.request.questions[lane]));
    }
    expect(p.request.state.request).toBe(prompt);
    expect(p.request.state).not.toHaveProperty('musical_reading');
    expect(p).not.toHaveProperty('editContext');
    expect(p).not.toHaveProperty('explicitMode');
  });
  it('accepts exact values from Jev regardless of transcript spelling', () => {
    for (const prompt of ['85 BPM', 'eighty five beats per minute']) {
      const p = prepare(prompt, current);
      expect(assemble(p, answers(p, { tempo: 'n:85' }), current).call.args[0].bpm).toBe(85);
    }
    const p = prepare('three hundred beats per minute', current);
    expect(assemble(p, answers(p, { tempoHigh: 'n:300' }), current).call.args[0].bpm).toBe(300);
  });
  it('does not execute a mode switch merely because its words appear', () => {
    const p = prepare('switch to drum mode', current);
    expect(assemble(p, answers(p), current).call.args[0].loopMode).toBe(current.loopMode);
    expect(assemble(p, answers(p, { loopMode: 'on' }), current).call.args[0].loopMode).toBe(true);
  });
  it('executes the chosen lane edit without requiring matching instrument words', () => {
    const p = prepare('put that there', current);
    const c = assemble(p, answers(p, { snare: 'add:3' }), current).call.args[0];
    expect(c.loopPattern.snare[3]).toBe(true);
    expect(c.loopMode).toBe(true);
    expect(c.loopPattern.kick).toEqual(current.loopPattern.kick);
  });
  it('does not discard a subdivision decision based on the wording', () => {
    const p = prepare('move the snare back a beat', current);
    const c = assemble(p, answers(p, { snare: 'shift-back', subDivs: '8' }), current).call.args[0];
    expect(c.subDivs).toBe(8);
  });
  it('provides bounded numeric questions accepted by the provider', () => {
    const p = prepare('a beat', current);
    for (const q of Object.values(p.request.questions))
      expect(Object.keys(q.criteria).length).toBeLessThanOrEqual(255);
  });
});
