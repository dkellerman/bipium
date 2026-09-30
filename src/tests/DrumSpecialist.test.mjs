// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepare, prepareDrumEdit, voice } from '../../server/voice.mjs';
import { API_DEFAULT_CONFIG } from '../core/api';
const current = structuredClone(API_DEFAULT_CONFIG);
const answers = (request, overrides = {}) =>
  Object.fromEntries(
    Object.entries(request.questions).map(([k, q]) => {
      const choice = overrides[k] ?? (Object.hasOwn(q.criteria, 'keep') ? 'keep' : 'play');
      return [k, { choice, confidence: 0.95, probabilities: { [choice]: 1 } }];
    }),
  );
const call = (prompt, config = current, stream = false) =>
  voice(
    new Request('https://test/api/voice', {
      method: 'POST',
      headers: stream ? { Accept: 'application/x-ndjson' } : {},
      body: JSON.stringify({
        prompt,
        currentConfig: config,
        recentTurns: [{ prompt: 'add a snare on beat two', applied: true }],
      }),
    }),
    { TYPESAFE_API_KEY: 'secret' },
  );
afterEach(() => vi.unstubAllGlobals());
describe('model-routed drum specialist', () => {
  it('keeps detailed edit choices out of the main request and carries exact state to the specialist', () => {
    const main = prepare(
      'also put it there',
      current,
      [{ prompt: 'snare on two', applied: true }],
      ['also put that there'],
    );
    const specialist = prepareDrumEdit(main, current);
    expect(Object.keys(specialist.request.questions)).toEqual(['kick', 'hat', 'snare', 'loopMode']);
    for (const lane of ['kick', 'hat', 'snare']) {
      expect(
        Object.keys(main.request.questions[lane].criteria).some(k =>
          /^(add|remove|only|move|shift)[-:]/.test(k),
        ),
      ).toBe(false);
      expect(
        Object.keys(specialist.request.questions[lane].criteria).some(k =>
          /^(add|remove):/.test(k),
        ),
      ).toBe(true);
    }
    expect(specialist.request.state.current_config).toEqual(current);
    expect(specialist.request.state.request).toBe(main.request.state.request);
    expect(specialist.request.state.recent_turns).toEqual(main.request.state.recent_turns);
    expect(specialist.request.state.recognition_alternatives).toEqual(
      main.request.state.recognition_alternatives,
    );
  });
  it.each(['move the snare back a beat', 'ordinary unrelated words'])(
    'routes %s solely from Jev, not wording',
    async prompt => {
      const fetcher = vi.fn(async (_url, init) =>
        Response.json({ answers: answers(JSON.parse(init.body), { action: 'play' }) }),
      );
      vi.stubGlobal('fetch', fetcher);
      expect((await call(prompt)).status).toBe(200);
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
  it.each([false, true])(
    'executes model-selected edits atomically with fixed client API (stream=%s)',
    async stream => {
      const fetcher = vi.fn(async (_url, init) => {
        const req = JSON.parse(init.body);
        return Response.json({
          answers: answers(
            req,
            fetcher.mock.calls.length === 1
              ? { action: 'drumEdit', tempo: 'n:95' }
              : { snare: 'add:3', loopMode: 'on' },
          ),
          usage: { input_tokens: 10, output_tokens: 5 },
        });
      });
      vi.stubGlobal('fetch', fetcher);
      const response = await call('arbitrary language', current, stream);
      const raw = await response.text();
      const body = stream ? JSON.parse(raw.trim()).result : JSON.parse(raw);
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(body.call).toMatchObject({ method: 'setConfig', args: [{ bpm: 95, loopMode: true }] });
      expect(body.call.args[0].loopPattern.snare[3]).toBe(true);
      expect(body.call.args[0].loopPattern.kick).toEqual(current.loopPattern.kick);
      expect(body.usage).toEqual({ input_tokens: 20, output_tokens: 10 });
      expect(body.drumEditRequest).toBeTruthy();
      expect(JSON.stringify(body)).not.toContain('secret');
    },
  );
  it('does not route an uncertain classification', async () => {
    const fetcher = vi.fn(async (_url, init) => {
      const a = answers(JSON.parse(init.body), { action: 'drumEdit' });
      a.action.confidence = 0.5;
      return Response.json({ answers: a });
    });
    vi.stubGlobal('fetch', fetcher);
    expect((await (await call('add snare')).json()).call).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(['http', 'malformed'])(
    'returns no partial configuration on specialist failure: %s',
    async failure => {
      const fetcher = vi.fn(async (_url, init) =>
        fetcher.mock.calls.length === 1
          ? Response.json({
              answers: answers(JSON.parse(init.body), { action: 'drumEdit', tempo: 'n:95' }),
            })
          : failure === 'http'
            ? new Response('', { status: 503 })
            : Response.json({ answers: {} }),
      );
      vi.stubGlobal('fetch', fetcher);
      const response = await call('edit');
      const body = await response.json();
      expect(response.ok).toBe(false);
      expect(body.call).toBeUndefined();
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );
  it.each([false, true])(
    'preserves existing mode for an ordinary tempo change (drum=%s)',
    async loopMode => {
      const fetcher = vi.fn(async (_url, init) =>
        Response.json({
          answers: answers(JSON.parse(init.body), { action: 'play', tempo: 'n:95' }),
        }),
      );
      vi.stubGlobal('fetch', fetcher);
      const body = await (await call('95 BPM', { ...current, loopMode })).json();
      expect(body.call.args[0].loopMode).toBe(loopMode);
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );
});
