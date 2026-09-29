import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ListenControl } from '../components/ListenControl';
import { API_DEFAULT_CONFIG } from '../core/api';
class FakeSpeech {
  static latest: FakeSpeech;
  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;
  phrases: { phrase: string; boost: number }[] = [];
  onresult: any;
  onend: any;
  onerror: any;
  start = vi.fn();
  abort = vi.fn();
  constructor() {
    FakeSpeech.latest = this;
  }
  phrase(text: string, final = true, alternatives: string[] = []) {
    this.onresult({
      resultIndex: 0,
      results: [
        {
          isFinal: final,
          length: 1 + alternatives.length,
          ...[text, ...alternatives].map(transcript => ({ transcript })),
        },
      ],
    });
  }
}
let root: Root, host: HTMLDivElement, api: any;
const response = () => ({
  prompt: 'funk',
  message: '100 BPM',
  call: { method: 'setConfig', args: [{ ...API_DEFAULT_CONFIG, bpm: 100 }] },
  playback: 'start',
  confidence: 0.9,
  references: [],
});
const click = async (label: string) => {
  await act(async () => {
    const button = [...document.querySelectorAll('button')].find(
      b => b.getAttribute('aria-label') === label || b.textContent?.trim() === label,
    );
    expect(button).toBeTruthy();
    button!.click();
  });
};
beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  api = {
    getConfig: vi.fn(() => API_DEFAULT_CONFIG),
    setConfig: vi.fn(),
    validateConfig: vi.fn(c => ({ ok: true, value: c })),
    start: vi.fn(),
    stop: vi.fn(),
    clearLoopPattern: vi.fn(),
    resetToDefaults: vi.fn(),
  };
  (window as any).bpm = api;
  (window as any).SpeechRecognition = FakeSpeech;
  await act(async () =>
    root.render(
      <>
        <ListenControl />
        <div id="voice-text-classic" />
        <div id="reset-control-classic" />
      </>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  delete (window as any).SpeechRecognition;
  delete (window as any).SpeechRecognitionPhrase;
});
describe('listening controls', () => {
  it('adds musical vocabulary hints and restarts without them if unsupported', async () => {
    (window as any).SpeechRecognitionPhrase = class {
      constructor(
        public phrase: string,
        public boost: number,
      ) {}
    };
    await click('Listen');
    expect(FakeSpeech.latest.phrases.some(p => p.phrase === 'on the four')).toBe(true);
    const original = FakeSpeech.latest;
    await act(async () => {
      original.onerror({ error: 'phrases-not-supported' });
    });
    await act(async () => new Promise(resolve => setTimeout(resolve, 180)));
    expect(FakeSpeech.latest).not.toBe(original);
    expect(FakeSpeech.latest.phrases).toEqual([]);
    expect(FakeSpeech.latest.start).toHaveBeenCalledOnce();
    expect(original.abort).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain('phrases-not-supported');
    await click('Stop listening');
    await click('Listen');
    expect(FakeSpeech.latest.phrases).toEqual([]);
  });
  it('shows examples, sends only final phrases, and applies the returned API config', async () => {
    const fetcher = vi.fn(async () => Response.json(response()));
    vi.stubGlobal('fetch', fetcher);
    await click('Listen');
    expect(document.body.textContent).toContain('snare on beat four');
    await act(async () => FakeSpeech.latest.phrase('funk', false));
    expect(fetcher).not.toHaveBeenCalled();
    await act(async () => FakeSpeech.latest.phrase('funk'));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(api.setConfig).toHaveBeenCalledWith(expect.objectContaining({ bpm: 100 }));
    expect(api.start).toHaveBeenCalled();
    expect(sessionStorage.getItem('bipium-voice-history')).toContain('funk');
  });
  it('spoken stop listening cancels an in-flight beat without stopping existing playback', async () => {
    let finish: any;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      ),
    );
    await click('Listen');
    await act(async () => FakeSpeech.latest.phrase('funk'));
    await act(async () => FakeSpeech.latest.phrase('stop listening'));
    await act(async () => finish(Response.json(response())));
    expect(api.setConfig).not.toHaveBeenCalled();
    expect(api.stop).not.toHaveBeenCalled();
    expect(FakeSpeech.latest.abort).toHaveBeenCalled();
  });
  it('mic denial ends listening without offering a typed input', async () => {
    await click('Listen');
    await act(async () => FakeSpeech.latest.onerror({ error: 'not-allowed' }));
    expect(document.body.textContent).toContain('permission was denied');
    expect(document.querySelector('input[aria-label="Beat prompt"]')).toBeNull();
  });
  it('shows a no-call response without applying or starting a beat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ...response(),
          call: null,
          playback: undefined,
          resultConfidence: 0.7,
          message: 'Not confident enough—try rephrasing.',
        }),
      ),
    );
    await click('Listen');
    await act(async () => FakeSpeech.latest.phrase('something vague'));
    expect(api.setConfig).not.toHaveBeenCalled();
    expect(api.start).not.toHaveBeenCalled();
    expect(api.stop).not.toHaveBeenCalled();
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'Not confident enough',
    );
    expect(document.querySelector('input')).toBeNull();
    expect(document.querySelector('details')).toBeNull();
  });
  it('keeps recent spoken context across phrases in the same listening session', async () => {
    const fetcher = vi.fn(async () => Response.json(response()));
    vi.stubGlobal('fetch', fetcher);
    await click('Listen');
    await act(async () => FakeSpeech.latest.phrase('funk'));
    await act(async () => FakeSpeech.latest.phrase('faster'));
    const request = JSON.parse(
      (fetcher.mock.calls as unknown as [string, RequestInit][])[1][1].body as string,
    );
    expect(request.prompt).toBe('faster');
    expect(request.recentTurns).toEqual([{ prompt: 'funk', applied: true }]);
  });
  it('sends alternate transcripts and shows what the browser heard in two compact lines', async () => {
    const fetcher = vi.fn(async () => Response.json(response()));
    vi.stubGlobal('fetch', fetcher);
    await click('Listen');
    expect(FakeSpeech.latest.maxAlternatives).toBe(3);
    await act(async () =>
      FakeSpeech.latest.phrase('move the snare end one beat', true, [
        'move the snare and one beat',
      ]),
    );
    const request = JSON.parse(
      (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1].body as string,
    );
    expect(request.alternatives).toEqual(['move the snare and one beat']);
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      'Heard: move the snare end one beat',
    );
  });
  it('resets the player and clears voice context from the visible control', async () => {
    const fetcher = vi.fn(async () => Response.json(response()));
    vi.stubGlobal('fetch', fetcher);
    await click('Listen');
    await act(async () => FakeSpeech.latest.phrase('funk'));
    await click('Reset');
    expect(document.querySelector('[role="status"]')).toBeNull();
    expect(api.resetToDefaults).toHaveBeenCalledOnce();
    expect(FakeSpeech.latest.abort).toHaveBeenCalled();
    expect(sessionStorage.getItem('bipium-voice-history')).toBe('[]');
    await click('Listen');
    await act(async () => FakeSpeech.latest.phrase('slower'));
    const request = JSON.parse(
      (fetcher.mock.calls as unknown as [string, RequestInit][])[1][1].body as string,
    );
    expect(request.recentTurns).toEqual([]);
  });
  it.each(['clearLoopPattern', 'resetToDefaults'])(
    'executes %s without starting playback',
    async method => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          Response.json({ ...response(), call: { method, args: [] }, playback: undefined }),
        ),
      );
      await click('Listen');
      await act(async () => FakeSpeech.latest.phrase('reset'));
      expect(api[method]).toHaveBeenCalledOnce();
      expect(api.start).not.toHaveBeenCalled();
    },
  );
  it('executes a valid server call regardless of its confidence score', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ...response(), confidence: 0.1 })),
    );
    await click('Listen');
    await act(async () => FakeSpeech.latest.phrase('a beat'));
    expect(api.setConfig).toHaveBeenCalled();
    expect(api.start).toHaveBeenCalled();
  });
  it('stops microphone and aborts requests when the page unmounts', async () => {
    await click('Listen');
    await act(async () => root.unmount());
    expect(FakeSpeech.latest.abort).toHaveBeenCalled();
  });
});

it('shows streamed lookup status before applying the final beat', async () => {
  let streamController: ReadableStreamDefaultController;
  const encoder = new TextEncoder();
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(c) {
              streamController = c;
            },
          }),
          { headers: { 'Content-Type': 'application/x-ndjson' } },
        ),
    ),
  );
  await click('Listen');
  await act(async () => FakeSpeech.latest.phrase('Billie Jean'));
  await act(async () => {
    streamController.enqueue(
      encoder.encode(JSON.stringify({ type: 'status', message: 'Looking up Billie Jean…' }) + '\n'),
    );
  });
  expect(document.body.textContent).toContain('Looking up Billie Jean');
  expect(api.setConfig).not.toHaveBeenCalled();
  await act(async () => {
    const line = JSON.stringify({ type: 'result', result: response() }) + '\n';
    streamController.enqueue(encoder.encode(line.slice(0, 17)));
    streamController.enqueue(encoder.encode(line.slice(17)));
    streamController.close();
  });
  expect(api.setConfig).toHaveBeenCalledWith(expect.objectContaining({ bpm: 100 }));
  expect(api.start).toHaveBeenCalledTimes(1);
});
