export type TranscriptWord = { text: string; start: number; end: number };
export type RecognitionEvent = {
  resultIndex: number;
  words?: TranscriptWord[];
  results: {
    length: number;
    [index: number]: { isFinal: boolean; length: number; [index: number]: { transcript: string } };
  };
};
/** One microphone session. Abort also cancels startup and releases late microphone grants. */
export class GrokRecognition {
  onresult: ((event: RecognitionEvent) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onready: (() => void) | null = null;
  onanalysis: ((result: { message: string }) => void) | null = null;
  private cancelled = false;
  private stream?: MediaStream;
  private context?: AudioContext;
  private socket?: WebSocket;
  private capture?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private aborter = new AbortController();
  private timeout?: ReturnType<typeof setTimeout>;
  private ready = false;
  start() {
    void this.connect();
  }
  private async connect() {
    try {
      // Create/resume during the user's tap for Safari's audio activation policy.
      this.context = new AudioContext({ sampleRate: 48000 });
      const resumed = this.context.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (this.cancelled) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      const [response] = await Promise.all([
        fetch('/api/transcription/session', { method: 'POST', signal: this.aborter.signal }),
        this.context.audioWorklet.addModule('/voice-capture.js'),
        resumed,
      ]);
      if (!response.ok) throw Error('connection');
      const session = await response.json();
      if (this.cancelled) return;
      const socket = (this.socket = new WebSocket(session.url));
      socket.binaryType = 'arraybuffer';
      this.timeout = setTimeout(() => this.fail('connection'), 15000);
      socket.onmessage = event => {
        if (this.cancelled) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'transcript.created') {
            clearTimeout(this.timeout);
            this.ready = true;
            this.source = this.context!.createMediaStreamSource(stream);
            this.capture = new AudioWorkletNode(this.context!, 'voice-capture');
            this.capture.port.onmessage = ({ data }) => {
              if (socket.readyState !== WebSocket.OPEN || this.cancelled) return;
              if (socket.bufferedAmount > 480000) {
                this.fail('connection');
                return;
              }
              socket.send(data);
            };
            this.source.connect(this.capture);
            // Worklet emits silence; connecting it keeps capture running on Safari.
            this.capture.connect(this.context!.destination);
            this.onready?.();
          } else if (data.type === 'transcript.partial') {
            // Chunk finals are included again in the complete utterance. Submit only speech_final.
            this.onresult?.({
              resultIndex: 0,
              words:
                Array.isArray(data.words) && data.words.length <= 80
                  ? data.words.map(({ text, start, end }: TranscriptWord) => ({ text, start, end }))
                  : undefined,
              results: [
                {
                  isFinal: data.speech_final === true,
                  length: 1,
                  0: { transcript: data.text || '' },
                },
              ],
            });
          } else if (data.type === 'analysis.result' && typeof data.result?.message === 'string') {
            this.onanalysis?.(data.result);
          } else if (data.type === 'error') this.fail('connection');
        } catch {
          this.fail('connection');
        }
      };
      socket.onerror = () => this.fail('connection');
      socket.onclose = () => {
        if (!this.cancelled) this.fail(this.ready ? 'ended' : 'connection');
      };
      stream.getTracks().forEach(track => {
        track.onended = () => this.fail('ended');
      });
    } catch (error) {
      if (!this.cancelled)
        this.fail(
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? 'not-allowed'
            : 'connection',
        );
    }
  }
  private fail(error: string) {
    if (this.cancelled) return;
    this.abort();
    this.onerror?.({ error });
  }
  abort() {
    this.cancelled = true;
    this.aborter.abort();
    clearTimeout(this.timeout);
    this.socket?.close();
    this.capture?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    void this.context?.close().catch(() => {});
  }
}
