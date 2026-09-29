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
  it('removes one snare hit without replacing its other hits or other lanes', () => {
    const base = { ...structuredClone(current), loopMode: true };
    base.loopPattern.snare = [false, true, true, true];
    const p = prepare('remove snare from the 3', base);
    const a = decisions(p, { snare: 'edit:remove:2' });
    const c = assemble(p, a, base).call.args[0];
    expect(c.loopPattern.snare).toEqual([false, true, false, true]);
    expect(c.loopPattern.kick).toEqual(base.loopPattern.kick);
    expect(c.loopPattern.hat).toEqual(base.loopPattern.hat);
    a.snare.confidence = 0.5;
    expect(assemble(p, a, base).call).toBeNull();
  });
  it('supports exclusive placement and relative edits on subdivision positions', () => {
    const base = { ...structuredClone(current), loopMode: true, subDivs: 2 };
    base.loopPattern = {
      kick: Array(8).fill(false),
      hat: Array(8).fill(true),
      snare: [false, false, true, false, true, false, true, false],
    };
    const p = prepare('snare just on the floor', base);
    expect(
      assemble(p, decisions(p, { snare: 'only:6' }), base).call.args[0].loopPattern.snare,
    ).toEqual([false, false, false, false, false, false, true, false]);
    expect(
      assemble(p, decisions(p, { snare: 'add:5' }), base).call.args[0].loopPattern.snare,
    ).toEqual([false, false, true, false, true, true, true, false]);
    expect(
      assemble(p, decisions(p, { snare: 'remove:4' }), base).call.args[0].loopPattern.snare,
    ).toEqual([false, false, true, false, false, false, true, false]);
  });
  it('can move an existing snare hit back one beat and preserve other hits', () => {
    const base = { ...structuredClone(current), loopMode: true };
    base.loopPattern.snare = [false, true, false, true];
    const p = prepare('move the snare on beat four back a beat', base);
    expect(p.request.questions.snare.criteria['edit:move']).toBeTruthy();
    const c = assemble(p, decisions(p, { snare: 'edit:move' }), base).call.args[0];
    expect(c.loopPattern.snare).toEqual([false, true, true, false]);
    expect(() => assemble(p, decisions(p, { snare: 'remove:3' }), base)).toThrow(/incomplete/);
  });
  it('moves all snare hits back one beat when no source hit is named', () => {
    const base = { ...structuredClone(current), loopMode: true };
    base.loopPattern.snare = [false, true, false, true];
    const p = prepare('move the snare back a beat', base);
    const c = assemble(p, decisions(p, { snare: 'edit:move' }), base).call.args[0];
    expect(c.loopPattern.snare).toEqual([true, false, true, false]);
  });
  it('enters drum mode for a chosen instrument edit even when mode was kept', () => {
    const p = prepare('add a snare on beat four', current);
    const c = assemble(p, decisions(p, { snare: 'edit:add:3', loopMode: 'keep' }), current).call
      .args[0];
    expect(c.loopMode).toBe(true);
    expect(c.loopPattern.snare[3]).toBe(true);
  });
  it('honors explicit mode switches even when the mode classifier disagrees', () => {
    const drums = { ...structuredClone(current), loopMode: true };
    const regular = prepare('switch to beat mode', drums);
    expect(
      assemble(regular, decisions(regular, { loopMode: 'keep' }), drums).call.args[0].loopMode,
    ).toBe(false);
    const drum = prepare('switch to drum mode', current);
    expect(
      assemble(drum, decisions(drum, { loopMode: 'off' }), current).call.args[0].loopMode,
    ).toBe(true);
  });
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
    const c = assemble(p, decisions(p, { hat: 'edit:remove:0,1,2,3' }), base).call.args[0];
    expect(c.bpm).toBe(base.bpm);
    expect(c.loopPattern.kick).toEqual(base.loopPattern.kick);
    expect(c.loopPattern.snare).toEqual(base.loopPattern.snare);
    expect(c.loopPattern.hat.some(Boolean)).toBe(false);
  });
  it.each([0.49, 0.5, 0.50001])(
    'only applies a setting when its confidence exceeds 50 percent (%s)',
    confidence => {
      const p = prepare('100 BPM and a little swing', current);
      const a = decisions(p, { tempo: 'n:100', swing: 'light' });
      a.tempo.confidence = confidence;
      const result = assemble(p, a, current);
      expect(result.call.args[0].bpm).toBe(confidence > 0.5 ? 100 : current.bpm);
      expect(result.call.args[0].swing).toBe(15);
    },
  );
  it('does not execute an uncertain operation', () => {
    const p = prepare('reset', current);
    const a = decisions(p, { action: 'reset' });
    a.action.confidence = 0.5;
    expect(assemble(p, a, current).call).toBeNull();
  });
  it('preserves an uncertain lane while applying a confident tempo change', () => {
    const p = prepare('a custom beat at 100 BPM', current);
    const a = decisions(p, { tempo: 'n:100', loopMode: 'on', hat: 'eighths' });
    a.hat.confidence = 0.5;
    const c = assemble(p, a, current).call.args[0];
    expect(c.bpm).toBe(100);
    expect(c.subDivs).toBe(current.subDivs);
    expect(c.loopPattern.hat).toEqual(current.loopPattern.hat);
  });
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
  it('provides recognition alternatives to Jev without changing the original prompt', () => {
    const p = prepare('make a beep at 100', current, [], ['make a beat at 100']);
    expect(p.request.state.request).toBe('make a beep at 100');
    expect(p.request.state.recognition_alternatives).toEqual(['make a beat at 100']);
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
    expect(result.call.args[0].bpm).toBe(current.bpm + 10);
  });
  it('ignores custom lane choices when ordinary playback was selected', () => {
    const p = prepare('a beat at 100 BPM', current);
    const a = decisions(p, { tempo: 'n:100', loopMode: 'off', kick: 'funk', hat: 'sixteenths' });
    a.kick.confidence = 0.2;
    const c = assemble(p, a, current).call.args[0];
    expect(c.loopMode).toBe(false);
    expect(c.loopPattern).toEqual(current.loopPattern);
    expect(c.subDivs).toBe(current.subDivs);
  });
  it.each([
    ['clear', 'clearLoopPattern'],
    ['reset', 'resetToDefaults'],
  ])('maps %s to a direct API call, using action confidence', (action, method) => {
    const p = prepare(action, current);
    const a = decisions(p, { action });
    const result = assemble(p, a, current);
    expect(result.call).toEqual({ method, args: [] });
    expect(result.playback).toBeUndefined();
    a.action.confidence = 0.7;
    expect(assemble(p, a, current).call).toEqual({ method, args: [] });
  });
  it('keeps drum sounds when returning to ordinary metronome playback', () => {
    const base = { ...current, loopMode: true, soundPack: 'drumkit' };
    const p = prepare('a regular beat at 100 BPM', base);
    expect(
      assemble(p, decisions(p, { tempo: 'n:100', loopMode: 'off' }), base).call.args[0].soundPack,
    ).toBe('drumkit');
  });
  it.each([0.5, 0.50001])(
    'only applies an explicit sound selection above 50 percent (%s)',
    confidence => {
      const p = prepare('switch to beep sounds', current);
      const a = decisions(p, { soundPack: 'defaults' });
      a.soundPack.confidence = confidence;
      expect(assemble(p, a, current).call.args[0].soundPack).toBe(
        confidence > 0.5 ? 'defaults' : current.soundPack,
      );
    },
  );
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
    const provider = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: 'decision-1', answers, usage: { cost: 0.001 } }));
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
    expect(body.confidence).toBe(0.83);
    expect(provider).toHaveBeenCalledTimes(1);
    expect(typeof body.confidence).toBe('number');
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

it('a song lookup streams progress and changes only BPM', async () => {
  const base = { ...current, swing: 17, soundPack: 'drumkit', loopMode: true };
  const fetcher = vi.fn(async (url, options) => {
    if (String(url).includes('openrouter')) {
      const request = JSON.parse(options.body);
      const songChoice = Object.entries(request.questions.songQuery.criteria).find(
        ([, v]) => v === 'Test Song by Test Artist',
      )[0];
      return Response.json({
        answers: decisions(
          { request },
          { songQuery: songChoice, tempo: 'keep', soundPack: 'defaults', loopMode: 'off' },
        ),
      });
    }
    if (String(url).includes('/search?'))
      return Response.json({
        content: [
          {
            id: '12345678-1111-1111-1111-111111111111',
            trackTitle: 'Test Song',
            artists: [{ name: 'Test Artist' }],
            popularity: 80,
            href: 'https://open.spotify.com/track/test',
          },
        ],
      });
    return Response.json({ tempo: 119.6 });
  });
  vi.stubGlobal('fetch', fetcher);
  const response = await voice(
    new Request('https://example.test/api/voice', {
      method: 'POST',
      headers: { Accept: 'application/x-ndjson' },
      body: JSON.stringify({ prompt: 'play Test Song by Test Artist', currentConfig: base }),
    }),
    { OPENROUTER_API_KEY: 'test' },
  );
  const events = (await response.text())
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
  expect(events[0]).toMatchObject({ type: 'status' });
  expect(events[1].result.call.args[0]).toEqual({ ...base, bpm: 120 });
  expect(events[1].result.playback).toBe('start');
  expect(fetcher).toHaveBeenCalledTimes(3);
});
