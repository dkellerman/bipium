import { describe, it, expect, vi, afterEach } from 'vitest';
import { GrokRecognition } from '../lib/grok-recognition';
const settle = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup(grant?: Promise<any>) {
  const track = { stop: vi.fn(), onended: null };
  const stream = { getTracks: () => [track] };
  const context = {
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    audioWorklet: { addModule: vi.fn(async () => {}) },
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    destination: {},
  };
  const capture = { port: { onmessage: null as any }, connect: vi.fn(), disconnect: vi.fn() };
  class Socket {
    static OPEN = 1;
    static latest: Socket;
    readyState = 1;
    bufferedAmount = 0;
    onmessage: any;
    onerror: any;
    onclose: any;
    send = vi.fn();
    close = vi.fn();
    constructor() {
      Socket.latest = this;
    }
  }
  vi.stubGlobal(
    'AudioContext',
    class {
      constructor() {
        return context;
      }
    },
  );
  vi.stubGlobal(
    'AudioWorkletNode',
    class {
      constructor() {
        return capture;
      }
    },
  );
  vi.stubGlobal('WebSocket', Socket);
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn(() => grant || Promise.resolve(stream)) },
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ url: 'wss://test' })),
  );
  return { track, stream, context, capture, Socket };
}
describe('Grok microphone lifecycle', () => {
  it('waits for server readiness, submits only utterance finals, and cleans up', async () => {
    const { track, context, capture, Socket } = setup();
    const recognition = new GrokRecognition();
    recognition.onresult = vi.fn();
    recognition.onanalysis = vi.fn();
    recognition.start();
    await settle();
    expect(context.createMediaStreamSource).not.toHaveBeenCalled();
    const emit = (data: object) => Socket.latest.onmessage({ data: JSON.stringify(data) });
    emit({ type: 'transcript.created' });
    capture.port.onmessage({ data: new ArrayBuffer(9600) });
    expect(Socket.latest.send).toHaveBeenCalledOnce();
    emit({
      type: 'transcript.partial',
      text: 'move the snare',
      is_final: true,
      speech_final: false,
    });
    expect(recognition.onresult).toHaveBeenLastCalledWith(
      expect.objectContaining({ results: [expect.objectContaining({ isFinal: false })] }),
    );
    emit({
      type: 'transcript.partial',
      text: 'move the snare back',
      is_final: true,
      speech_final: true,
      words: [{ text: 'move', start: 1, end: 1.3 }],
    });
    expect(recognition.onresult).toHaveBeenLastCalledWith(
      expect.objectContaining({
        words: [{ text: 'move', start: 1, end: 1.3 }],
        results: [expect.objectContaining({ isFinal: true })],
      }),
    );
    emit({
      type: 'analysis.result',
      result: { call: null, message: '[percussion] No changes made · ~120 BPM' },
    });
    expect(recognition.onanalysis).toHaveBeenCalledWith({
      call: null,
      message: '[percussion] No changes made · ~120 BPM',
    });
    expect(recognition.onresult).toHaveBeenCalledTimes(2);
    recognition.abort();
    expect(track.stop).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalled();
    expect(Socket.latest.close).toHaveBeenCalled();
  });
  it('releases a microphone permission grant arriving after Stop', async () => {
    let resolve!: (s: any) => void;
    const { track, stream } = setup(
      new Promise(r => {
        resolve = r;
      }),
    );
    const recognition = new GrokRecognition();
    recognition.start();
    recognition.abort();
    resolve(stream);
    await settle();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
});
