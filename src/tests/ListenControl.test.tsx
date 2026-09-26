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
  onresult: any;
  onend: any;
  onerror: any;
  start = vi.fn();
  abort = vi.fn();
  constructor() {
    FakeSpeech.latest = this;
  }
  phrase(text: string, final = true) {
    this.onresult({ resultIndex: 0, results: [{ isFinal: final, 0: { transcript: text } }] });
  }
}
let root: Root, host: HTMLDivElement, api: any;
const response = () => ({
  prompt: 'funk',
  message: '100 BPM',
  call: { method: 'setConfig', args: [{ ...API_DEFAULT_CONFIG, bpm: 100 }] },
  playback: 'start',
  confidence: { tempo: 0.9 },
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
  };
  (window as any).bpm = api;
  (window as any).SpeechRecognition = FakeSpeech;
  await act(async () =>
    root.render(
      <>
        <ListenControl />
        <div id="voice-text-classic" />
      </>,
    ),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  delete (window as any).SpeechRecognition;
});
describe('listening controls', () => {
  it('shows examples, sends only final phrases, and applies the returned API config', async () => {
    const fetcher = vi.fn(async () => Response.json(response()));
    vi.stubGlobal('fetch', fetcher);
    await click('Listen');
    expect(document.body.textContent).toContain('a funky beat at 100 BPM');
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
  it('shows the low-confidence message without applying or starting a beat', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ...response(),
          call: null,
          playback: undefined,
          resultConfidence: 0.8,
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
  it('stops microphone and aborts requests when the page unmounts', async () => {
    await click('Listen');
    await act(async () => root.unmount());
    expect(FakeSpeech.latest.abort).toHaveBeenCalled();
  });
});
