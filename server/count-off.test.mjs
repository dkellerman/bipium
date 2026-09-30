// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { estimateCountOff } from './count-off.mjs';
import { prepare, assemble, voice } from './voice.mjs';
import { API_DEFAULT_CONFIG } from '../src/core/api.ts';
const words = text =>
  text.split(' ').map((text, i) => ({ text, start: 8 + i * 0.5, end: 8.1 + i * 0.5 }));
const decisions = (questions, overrides) =>
  Object.fromEntries(
    Object.entries(questions).map(([key, q]) => {
      const choice = overrides[key] ?? (Object.hasOwn(q.criteria, 'keep') ? 'keep' : 'play');
      return [key, { choice, confidence: 0.95, probabilities: { [choice]: 1 } }];
    }),
  );
const countDecision = {
  action: 'countOff',
  countFirst: '0',
  countLast: '3',
  countIntervals: '3',
  countDivisions: '1',
};
afterEach(() => vi.unstubAllGlobals());
describe('model interpreted count-offs', () => {
  it('calculates timing without reading or classifying any words', () => {
    const anchors = words('arbitrary text with punctuation');
    for (const word of anchors)
      Object.defineProperty(word, 'text', {
        get() {
          throw Error('Arithmetic must not read text');
        },
      });
    expect(
      estimateCountOff(anchors, { first: 0, last: 3, intervals: 3, subdivisions: 1 }),
    ).toMatchObject({ bpm: 120 });
  });
  it.each([119.4, 119.6])('returns whole BPM for a timing estimate near %s', tempo => {
    const anchors = Array.from({ length: 4 }, (_, i) => ({ start: (i * 60) / tempo }));
    const result = estimateCountOff(anchors, { first: 0, last: 3, intervals: 3, subdivisions: 1 });
    expect(result.bpm).toBe(Math.round(tempo));
    expect(result.beatIntervalSeconds).toBeCloseTo(60 / tempo, 10);
  });
  it('uses the musical spacing selected by Jev for subdivided pulses', () => {
    expect(
      estimateCountOff(words('1 ee and uh'), { first: 0, last: 3, intervals: 3, subdivisions: 4 }),
    ).toMatchObject({ bpm: 30 });
  });
  it.each([
    { first: null, last: 3, intervals: 3, subdivisions: 1 },
    { first: 0, last: 30, intervals: 3, subdivisions: 1 },
    { first: 3, last: 0, intervals: 3, subdivisions: 1 },
    { first: 0, last: 3, intervals: 0, subdivisions: 1 },
  ])('rejects invalid timing selections without inventing tempo: %j', selection => {
    expect(estimateCountOff(words('1 2 3 4'), selection).bpm).toBeNull();
  });
  it.each(['1,2,3,4', 'one two three four', '1 ee and uh', 'ready and a here we go'])(
    'always asks Jev to interpret %s',
    async prompt => {
      const fetcher = vi.fn(async (_url, init) => {
        const request = JSON.parse(init.body);
        expect(request.state.request).toBe(prompt);
        return Response.json({ answers: decisions(request.questions, { action: 'unrelated' }) });
      });
      vi.stubGlobal('fetch', fetcher);
      const response = await voice(
        new Request('https://www.bipium.com/api/voice', {
          method: 'POST',
          body: JSON.stringify({
            prompt,
            transcriptionWords: words('1 2 3 4'),
            currentConfig: API_DEFAULT_CONFIG,
          }),
        }),
        { TYPESAFE_API_KEY: 'test' },
      );
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(fetcher).toHaveBeenCalledOnce();
      expect(result.call).toBeNull();
      expect(result.countOff).toBeNull();
    },
  );
  it.each([false, true])(
    'executes only the model-selected count-off via the fixed API (stream=%s)',
    async stream => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url, init) =>
          Response.json({ answers: decisions(JSON.parse(init.body).questions, countDecision) }),
        ),
      );
      const current = { ...API_DEFAULT_CONFIG, swing: 27, volume: 63 };
      const response = await voice(
        new Request('https://www.bipium.com/api/voice', {
          method: 'POST',
          headers: stream ? { Accept: 'application/x-ndjson' } : {},
          body: JSON.stringify({
            prompt: 'arbitrary wording selected by model',
            transcriptionWords: words('a b c d'),
            currentConfig: current,
          }),
        }),
        { TYPESAFE_API_KEY: 'test' },
      );
      const raw = await response.text();
      const result = stream ? JSON.parse(raw.trim()).result : JSON.parse(raw);
      expect(fetch).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        playback: 'start',
        countOff: { bpm: 120 },
        call: { method: 'setConfig', args: [{ ...current, bpm: 120 }] },
      });
    },
  );
  it('defines a shared musical span without depending on same-call answers', () => {
    const prepared = prepare(
      'ready one two three four',
      API_DEFAULT_CONFIG,
      [],
      [],
      words('ready one two three four'),
    );
    expect(prepared.request.state.count_off_scope).toContain(
      'first and last reliably timestamped musical pulses',
    );
    for (const field of ['countFirst', 'countLast', 'countIntervals', 'countDivisions']) {
      const instruction = prepared.request.questions[field].instructions;
      expect(instruction).toContain('state.count_off_scope');
      expect(instruction).not.toMatch(
        /For action countOff|after countFirst|selected first|selected musical pulses/,
      );
    }
  });
  it('preserves playback when Jev selects count-off without usable timing', () => {
    const prepared = prepare('one two three four', API_DEFAULT_CONFIG);
    const result = assemble(
      prepared,
      decisions(prepared.request.questions, { action: 'countOff' }),
      API_DEFAULT_CONFIG,
    );
    expect(result.call).toBeNull();
    expect(result.playback).toBeUndefined();
  });
  it('does not use low-confidence timing decisions', () => {
    const prepared = prepare(
      'one two three four',
      API_DEFAULT_CONFIG,
      [],
      [],
      words('one two three four'),
    );
    const answers = decisions(prepared.request.questions, countDecision);
    answers.countIntervals.confidence = 0.4;
    expect(assemble(prepared, answers, API_DEFAULT_CONFIG).call).toBeNull();
  });
});
