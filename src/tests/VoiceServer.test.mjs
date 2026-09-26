// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { prepare, assemble, voice } from '../../server/voice.mjs';
import { retrieve, corpusCount } from '../../server/retrieval.mjs';
import { API_DEFAULT_CONFIG } from '../core/api';
const current = structuredClone(API_DEFAULT_CONFIG);
function decisions(prepared, overrides = {}) {
  return Object.fromEntries(
    Object.entries(prepared.request.questions).map(([field, q]) => {
      const selected =
        overrides[field] ??
        (Object.hasOwn(q.criteria, 'keep') ? 'keep' : Object.keys(q.criteria)[0]);
      return [
        field,
        { type: 'choice', choice: selected, confidence: 0.83, probabilities: { [selected]: 1 } },
      ];
    }),
  );
}
afterEach(() => vi.unstubAllGlobals());
describe('voice interpretation and vector retrieval', () => {
  it('searches all research entries and returns both sources', () => {
    expect(corpusCount).toBe(673);
    const refs = retrieve('house beat at 124 BPM');
    expect(refs).toHaveLength(4);
    expect(new Set(refs.map(r => r.source))).toEqual(new Set(['Thump', 'GMD']));
    expect(refs[0].title.toLowerCase()).toContain('house');
    expect(refs.every(r => Number.isFinite(r.similarity) && r.url.startsWith('https://'))).toBe(
      true,
    );
  });
  it('assembles one API call and expands its grid without losing hits', () => {
    const p = prepare('100 BPM with eighth hats', current);
    const result = assemble(
      p,
      decisions(p, {
        tempo: 'n:100',
        loopMode: 'on',
        hat: 'eighths',
        kick: 'one_three',
        snare: 'backbeat',
      }),
      current,
    );
    const c = result.call.args[0];
    expect(c.bpm).toBe(100);
    expect(c.subDivs).toBe(2);
    expect(c.loopPattern.hat).toEqual(Array(8).fill(true));
    expect(c.loopPattern.kick.filter(Boolean)).toHaveLength(2);
  });
  it('preserves untouched lanes and tempo in a removal edit', () => {
    const base = { ...current, loopMode: true };
    const p = prepare('remove hats', base);
    const c = assemble(p, decisions(p, { hat: 'silent' }), base).call.args[0];
    expect(c.bpm).toBe(base.bpm);
    expect(c.loopPattern.kick).toEqual(base.loopPattern.kick);
    expect(c.loopPattern.snare).toEqual(base.loopPattern.snare);
    expect(c.loopPattern.hat.some(Boolean)).toBe(false);
  });
  it.each([0.79, 0.8, 0.80001])(
    'requires strictly over 80 percent, including the weakest decision (%s)',
    confidence => {
      const p = prepare('100 BPM', current);
      const a = decisions(p, { tempo: 'n:100' });
      a.tempo.confidence = confidence;
      const original = structuredClone(current);
      const result = assemble(p, a, current);
      expect(result.resultConfidence).toBe(confidence);
      if (confidence <= 0.8) {
        expect(result.call).toBeNull();
        expect(result.playback).toBeUndefined();
        expect(result.message).toBe('Not confident enough—try rephrasing.');
      } else expect(result.playback).toBe('start');
      expect(current).toEqual(original);
    },
  );
  it('uses the current beat for faster and slower and includes recent outcomes', () => {
    const recentTurns = [
      { prompt: 'funk at 100 BPM', applied: true },
      { prompt: 'a confusing request', applied: false },
    ];
    const base = { ...current, bpm: 100 };
    const p = prepare('faster', base, recentTurns);
    expect(p.request.state.recent_turns).toEqual(recentTurns);
    const faster = assemble(p, decisions(p, { tempo: 'faster' }), base).call.args[0];
    expect(faster.bpm).toBe(110);
    const slower = prepare('slower', faster, recentTurns);
    expect(assemble(slower, decisions(slower, { tempo: 'slower' }), faster).call.args[0].bpm).toBe(
      100,
    );
  });
  it('prepares all required playback settings without asking the user to enable them', () => {
    const base = { ...current, playSubDivs: false };
    const p = prepare('a beat', base);
    const result = assemble(
      p,
      decisions(p, { loopMode: 'on', playSubDivs: 'off', hat: 'eighths' }),
      base,
    );
    expect(result.call.args[0].playSubDivs).toBe(true);
    expect(result.call.args[0].subDivs).toBe(2);
    expect(result.playback).toBe('start');
    expect(result.message).not.toContain('enable');
  });
  it('does not veto a confident tempo edit over fields being preserved unchanged', () => {
    const p = prepare('faster', current);
    const a = decisions(p, { tempo: 'faster' });
    a.tempo.confidence = 0.95;
    a.action.confidence = 1;
    for (const field of Object.keys(a)) if (a[field].choice === 'keep') a[field].confidence = 0.3;
    const result = assemble(p, a, current);
    expect(result.resultConfidence).toBe(0.95);
    expect(result.call.args[0].bpm).toBe(current.bpm + 10);
  });
  it('rejects out of range numeric values and invalid or incomplete decisions', () => {
    const p = prepare('400 BPM', current);
    expect(() => assemble(p, decisions(p, { tempo: 'n:400' }), current)).toThrow(/range/);
    const a = decisions(p);
    delete a.kick.confidence;
    expect(() => assemble(p, a, current)).toThrow(/incomplete/);
  });
  it('does not launch a beat for unrelated speech or a stop request', () => {
    const p = prepare('stop', current);
    expect(assemble(p, decisions(p, { action: 'unrelated' }), current).call).toBeNull();
    expect(assemble(p, decisions(p, { action: 'stop' }), current).call).toEqual({
      method: 'stop',
      args: [],
    });
  });
  it('keeps exact prompt, probabilities, confidence, request, and references without leaking the key', async () => {
    const prompt = 'A house beat at 124 BPM';
    const p = prepare(prompt, current);
    const answers = decisions(p, { tempo: 'n:124' });
    const provider = vi.fn(async () =>
      Response.json({ id: 'decision-1', answers, usage: { cost: 0.001 } }),
    );
    vi.stubGlobal('fetch', provider);
    const result = await voice(
      new Request('https://test/api/voice', {
        method: 'POST',
        body: JSON.stringify({ prompt, currentConfig: current }),
      }),
      { OPENROUTER_API_KEY: 'private-test-key' },
    );
    const body = await result.json();
    expect(body.prompt).toBe(prompt);
    expect(body.jevRequest.state.request).toBe(prompt);
    expect(body.decisions).toEqual(answers);
    expect(body.confidence.tempo).toBe(0.83);
    expect(body.references).toHaveLength(4);
    expect(JSON.stringify(body)).not.toContain('private-test-key');
    expect(provider.mock.calls[0][0]).toBe('https://openrouter.ai/api/alpha/decisions');
  });
  it('rejects malformed inputs before calling the provider', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    for (const body of [
      { prompt: '', currentConfig: current },
      { prompt: 'beat', currentConfig: {} },
    ]) {
      const result = await voice(
        new Request('https://test/api/voice', { method: 'POST', body: JSON.stringify(body) }),
        { OPENROUTER_API_KEY: 'test' },
      );
      expect(result.status).toBe(400);
    }
    expect(provider).not.toHaveBeenCalled();
  });
});
