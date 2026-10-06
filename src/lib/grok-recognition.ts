import { micEchoCancellation, setCapturing } from '@/lib/audio-session';
import { OnsetDetector, type Onset } from './onsets';
import { GuitarTuner, type TunerReading } from './tuner';
import {
  musicLikelihood,
  RhythmStabilizer,
  type HeardRhythm,
  type RhythmDiagnosis,
} from './rhythm-tracker';

export type RhythmStatus = {
  state: 'analyzing' | 'paused for speech' | 'metronome playing' | 'tuning';
  /** Loudest mic level since the last check, dBFS. */
  level: number;
  /** Onsets heard in the last 8 s. */
  onsets: number;
  diagnosis?: RhythmDiagnosis;
};
import { DevAudioRecorder, devLog } from './dev-log';

const RATE = 48000;
const ANALYZE_EVERY = 2; // seconds of audio between rhythm analyses
const QUIET_FOR = 8; // seconds without speech before rhythm is analyzed
const STEADY_STREAK = 2; // consecutive analyses agreeing on a pulse before it counts as music
const STEADY_RECENT = 4; // seconds a held rhythm keeps counting as music

export type TranscriptWord = { text: string; start: number; end: number };
export type RecognitionEvent = {
  resultIndex: number;
  words?: TranscriptWord[];
  /** Audio onsets around the phrase, on the same clock as the word timings. */
  onsets?: Onset[];
  /** 0…1: how much the audio around the phrase looked like music (singing, playing). */
  music?: number;
  /** 0…1: how much the phrase's own words were sung (held, pitched notes) rather than spoken. */
  sung?: number;
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
  /** A steady rhythm heard with no speech (claps, an instrument). */
  onrhythm: ((rhythm: HeardRhythm) => void) | null = null;
  /** A steady rhythm was just heard but isn't confirmed yet (keep playing). */
  onrhythmcandidate: (() => void) | null = null;
  /** Every rhythm check: what the mic picked up and why no rhythm was found yet. */
  onrhythmstatus: ((status: RhythmStatus) => void) | null = null;
  /** Open guitar strings heard ringing (see tuner.ts). */
  ontuning: ((reading: TunerReading) => void) | null = null;
  /** While the tuner shows, every analysis updates it and rhythm isn't tracked. */
  showingTuner = false;
  private peak = -Infinity; // loudest chunk (dBFS) since the last check
  /** True while rhythm shouldn't be detected (the metronome is playing). */
  ignoreRhythm: (() => boolean) | null = null;
  private cancelled = false;
  private stream?: MediaStream;
  private context?: AudioContext;
  private socket?: WebSocket;
  private capture?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private aborter = new AbortController();
  private timeout?: ReturnType<typeof setTimeout>;
  private ready = false;
  // Fed exactly the audio sent to the transcriber, so onset times share its clock.
  private readonly onsets = new OnsetDetector(RATE);
  private readonly tuner = new GuitarTuner(RATE);
  private readonly recording = new DevAudioRecorder(2 * RATE);
  private audioTime = 0;
  private lastSpeech = -Infinity;
  // A steady rhythm heard in consecutive analyses: an instrument (or clapping) is playing.
  private steady = { at: -Infinity, streak: 0, confidence: 0, pulse: 0 };
  private nextAnalysis = ANALYZE_EVERY;
  private rhythmWorker?: Worker;
  private readonly rhythm = new RhythmStabilizer();
  start() {
    this.tuner.onreading = reading => {
      if (!this.cancelled) this.ontuning?.(reading);
    };
    void this.connect();
  }
  private async connect() {
    try {
      // Create/resume during the user's tap for Safari's audio activation policy. The
      // hardware's own rate: a forced one crackles; voice-capture.js converts to 48 kHz.
      this.context = new AudioContext();
      const resumed = this.context.resume();
      setCapturing(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          // Echo cancellation stays off: on iPhone it routes playback through call
          // processing, louder and crackling on the drum kit (voice mode must not change
          // playback; `?mic` compares, temporarily). Noise suppression stays off: it keeps
          // only voice, erasing the instruments and claps rhythm tracking needs.
          echoCancellation: micEchoCancellation(),
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      if (this.cancelled) {
        stream.getTracks().forEach(track => track.stop());
        setCapturing(false);
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
      const url = new URL(session.url);
      if (import.meta.env.DEV) {
        // The dev server proxies the relay (see vite.config.mjs).
        url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        url.host = location.host;
      }
      const socket = (this.socket = new WebSocket(url));
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
              this.listen(new Int16Array(data));
            };
            this.source.connect(this.capture);
            // Worklet emits silence; connecting it keeps capture running on Safari.
            this.capture.connect(this.context!.destination);
            this.onready?.();
          } else if (data.type === 'transcript.partial') {
            if (data.text?.trim()) this.lastSpeech = this.audioTime;
            // Chunk finals are included again in the complete utterance. Submit only speech_final.
            const words: TranscriptWord[] | undefined =
              Array.isArray(data.words) && data.words.length <= 80
                ? data.words.map(({ text, start, end }: TranscriptWord) => ({ text, start, end }))
                : undefined;
            this.onresult?.({
              resultIndex: 0,
              words,
              onsets:
                data.speech_final && words?.length
                  ? this.onsets.between(words[0].start - 1, words[words.length - 1].end + 1)
                  : undefined,
              // While the metronome plays, its own clicks would read as music and make
              // commands ("stop") look like lyrics, so phrases aren't flagged then.
              music:
                data.speech_final && words?.length && !this.ignoreRhythm?.()
                  ? Math.max(
                      musicLikelihood(
                        this.onsets.music(words[0].start - 2, words[words.length - 1].end + 1),
                      ),
                      this.instrumentPlaying(),
                    )
                  : data.speech_final && words?.length
                    ? 0
                    : undefined,
              sung:
                data.speech_final && words?.length
                  ? musicLikelihood({
                      heldNotes: this.onsets.music(words[0].start, words[words.length - 1].end)
                        .heldNotes,
                      sharpOnsets: 0,
                    })
                  : undefined,
              results: [
                {
                  isFinal: data.speech_final === true,
                  length: 1,
                  0: { transcript: data.text || '' },
                },
              ],
            });
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
  /** Onsets for count-ins, and rhythm analysis of stretches with no speech. */
  private listen(pcm: Int16Array) {
    this.recording.push(pcm);
    this.onsets.push(pcm);
    this.audioTime += pcm.length / RATE;
    // Like rhythm, the tuner only listens while the metronome is stopped.
    this.tuner.enabled = !this.ignoreRhythm?.();
    this.tuner.live = this.showingTuner;
    this.tuner.push(pcm);
    let sum = 0;
    for (let i = 0; i < pcm.length; i++) sum += (pcm[i] / 32768) ** 2;
    this.peak = Math.max(this.peak, 10 * Math.log10(sum / pcm.length + 1e-12));
    if (this.audioTime < this.nextAnalysis) return;
    this.nextAnalysis += ANALYZE_EVERY;
    const level = Math.round(this.peak);
    this.peak = -Infinity;
    const heard = this.onsets.between(this.audioTime - QUIET_FOR, this.audioTime).length;
    const status = (state: RhythmStatus['state'], diagnosis?: RhythmDiagnosis) =>
      this.onrhythmstatus?.({ state, level, onsets: heard, diagnosis });
    if (this.ignoreRhythm?.()) {
      this.rhythm.next(null);
      this.noteSteady(null, this.audioTime);
      status('metronome playing');
      return;
    }
    // Plucks and strums while tuning aren't a rhythm.
    if (this.showingTuner) {
      this.rhythm.next(null);
      this.noteSteady(null, this.audioTime);
      status('tuning');
      return;
    }
    // Speech pauses rhythm tracking, unless the audio shows music (singing over an
    // instrument, clapping while talking).
    let speech = null;
    if (this.audioTime - this.lastSpeech < QUIET_FOR) {
      speech = this.onsets.music(this.audioTime - QUIET_FOR, this.audioTime);
      // Words transcribed while an instrument is clearly playing are often the instrument
      // itself; the stricter over-speech bar still applies to the analysis.
      if (musicLikelihood(speech) < 0.5 && this.instrumentPlaying() < 0.5) {
        this.rhythm.next(null);
        status('paused for speech');
        devLog('rhythm', {
          now: this.audioTime,
          skipped: 'speech without music',
          music: speech,
          onsets: this.onsets.between(this.audioTime - QUIET_FOR, this.audioTime),
        });
        return;
      }
    }
    if (!this.rhythmWorker && typeof Worker !== 'undefined') {
      this.rhythmWorker = new Worker(new URL('./rhythm-worker.ts', import.meta.url), {
        type: 'module',
      });
      this.rhythmWorker.onmessage = ({ data }) => {
        if (this.cancelled) return;
        this.noteSteady(data.result, data.input.now);
        this.onrhythmstatus?.({ ...data.input.status, diagnosis: data.diagnosis });
        const report = this.rhythm.next(data.result);
        devLog('rhythm', { ...data.input, analysis: data.result, reported: report });
        if (report) this.onrhythm?.(report);
        else if (data.result) this.onrhythmcandidate?.();
      };
    }
    this.rhythmWorker?.postMessage({
      onsets: this.onsets.between(this.audioTime - QUIET_FOR, this.audioTime),
      now: this.audioTime,
      speech,
      status: { state: 'analyzing', level, onsets: heard },
    });
  }
  private noteSteady(result: HeardRhythm | null, now: number) {
    if (!result) {
      this.steady = { at: -Infinity, streak: 0, confidence: 0, pulse: 0 };
      return;
    }
    const pulse = result.bpm * result.subdivisions;
    const same = Math.abs(Math.log(pulse / (this.steady.pulse || pulse))) < 0.03;
    this.steady = {
      at: now,
      streak: same ? this.steady.streak + 1 : 1,
      confidence: result.confidence,
      pulse,
    };
  }
  /** 0…1: confidence that an instrument is playing, from a steady rhythm held recently. */
  private instrumentPlaying() {
    const { at, streak, confidence } = this.steady;
    return streak >= STEADY_STREAK && this.audioTime - at <= STEADY_RECENT ? confidence : 0;
  }
  abort() {
    if (!this.cancelled) this.recording.flush();
    this.cancelled = true;
    this.rhythmWorker?.terminate();
    this.aborter.abort();
    clearTimeout(this.timeout);
    this.socket?.close();
    this.capture?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    void this.context?.close().catch(() => {});
    setCapturing(false);
  }
}
