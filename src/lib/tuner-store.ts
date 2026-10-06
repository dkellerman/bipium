// The one guitar tuner the page shows (see tuner.ts). Voice mode reports what its mic
// hears; `window.bpm.startTuner()` opens it with a mic of its own when voice mode isn't
// listening. The popup renders from here, and the API reads its state from here.
import type { ApiTunerState } from '@/core/api';
import { micEchoCancellation, setCapturing } from './audio-session';
import { GuitarTuner, TUNINGS, type TunerReading } from './tuner';

const IDLE_MS = 45000; // the tuner closes after this long with no string ringing
const RATE = 48000; // what voice-capture.js delivers

export class TunerError extends Error {
  constructor(
    readonly code: 'microphone-denied' | 'audio-blocked' | 'unavailable',
    message: string,
  ) {
    super(message);
  }
}

/** A mic for the tuner alone: no transcriber, nothing sent anywhere. */
class TunerMic {
  private context?: AudioContext;
  private stream?: MediaStream;
  private source?: MediaStreamAudioSourceNode;
  private capture?: AudioWorkletNode;
  private readonly tuner = new GuitarTuner(RATE);
  private stopped = false;

  constructor(
    onreading: (reading: TunerReading) => void,
    private readonly paused: () => boolean,
    private readonly onpause: () => void,
  ) {
    this.tuner.live = true;
    this.tuner.onreading = reading => {
      if (!this.stopped) onreading(reading);
    };
  }

  async start() {
    if (typeof AudioContext === 'undefined' || !navigator.mediaDevices?.getUserMedia)
      throw new TunerError('unavailable', 'This browser has no microphone access.');
    const context = (this.context = new AudioContext());
    // Without a tap on the page, browsers may keep audio suspended.
    await Promise.race([context.resume(), new Promise(resolve => setTimeout(resolve, 1500))]);
    if (context.state !== 'running') {
      this.stop();
      throw new TunerError('audio-blocked', 'Tap the page first to allow audio, then try again.');
    }
    setCapturing(true);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        // As voice mode's mic: noise suppression would erase the strings.
        audio: {
          channelCount: 1,
          echoCancellation: micEchoCancellation(),
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });
      await context.audioWorklet.addModule('/voice-capture.js');
    } catch (error) {
      this.stop();
      throw error instanceof DOMException && error.name === 'NotAllowedError'
        ? new TunerError('microphone-denied', 'Microphone permission was denied.')
        : new TunerError('unavailable', 'Could not start the microphone.');
    }
    if (this.stopped) return this.stop();
    this.source = context.createMediaStreamSource(this.stream);
    this.capture = new AudioWorkletNode(context, 'voice-capture');
    this.capture.port.onmessage = ({ data }) => {
      if (this.stopped) return;
      // Like voice mode's, the tuner never listens while the metronome plays.
      if (this.paused()) return this.onpause();
      this.tuner.push(new Int16Array(data));
    };
    this.source.connect(this.capture);
    // The worklet emits silence; connecting it keeps capture running on Safari.
    this.capture.connect(context.destination);
  }

  stop() {
    if (this.stopped && !this.context) return;
    this.stopped = true;
    this.capture?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach(track => track.stop());
    void this.context?.close().catch(() => {});
    this.context = undefined;
    setCapturing(false);
  }
}

const empty = (): TunerReading => ({
  tuning: TUNINGS[0],
  offset: null,
  cents: TUNINGS[0].notes.map(() => null),
  sounding: TUNINGS[0].notes.map(() => false),
  guessed: false,
});

let showing: TunerReading | null = null;
let last: TunerReading | null = null;
let mic: TunerMic | null = null;
let voiceListening = false;
let idle: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function show(reading: TunerReading) {
  showing = last = reading;
  if (reading.sounding.some(Boolean)) {
    clearTimeout(idle);
    idle = setTimeout(close, IDLE_MS);
  }
  listeners.forEach(listener => listener());
}

function close() {
  clearTimeout(idle);
  mic?.stop();
  mic = null;
  if (!showing) return;
  showing = null;
  listeners.forEach(listener => listener());
}

const round = (cents: number | null) => (cents === null ? null : Math.round(cents * 10) / 10);

export const tunerStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  /** The reading on screen, or null when the tuner isn't showing. */
  showing: () => showing,
  close,
  /** For local development: show a reading (null closes). */
  show: (reading: TunerReading | null) => (reading ? show(reading) : close()),
  /** Voice mode heard strings ringing. Its own mic is used only when voice mode isn't. */
  report(reading: TunerReading) {
    if (!mic) show(reading);
  },
  /** Voice mode starts or stops listening: it takes over the tuner's mic, or closes it. */
  setVoiceListening(on: boolean) {
    voiceListening = on;
    if (on) {
      mic?.stop();
      mic = null;
    } else if (!mic) close();
  },
  /** Show the tuner and listen: through voice mode if it's on, otherwise a mic of its own. */
  async open(metronomePlaying: () => boolean) {
    if (!showing) show(empty());
    clearTimeout(idle);
    idle = setTimeout(close, IDLE_MS);
    if (voiceListening || mic) return;
    const own = (mic = new TunerMic(show, metronomePlaying, close));
    try {
      await own.start();
    } catch (error) {
      if (mic === own) close();
      throw error;
    }
  },
  /** What the tuner shows, or showed last, for the API. */
  state(): ApiTunerState {
    const reading = showing ?? last;
    return {
      available: true,
      showing: !!showing,
      listening: !!showing && (voiceListening || !!mic),
      tuning: reading?.tuning.name ?? null,
      tuningConfirmed: !!reading && !reading.guessed,
      wholeGuitarCents: round(reading?.offset ?? null),
      strings: reading
        ? reading.tuning.notes.map((note, s) => ({
            note: reading.tuning.names[s],
            octave: Math.floor(note / 12) - 1,
            cents: round(reading.cents[s]),
            ringing: !!showing && reading.sounding[s],
          }))
        : [],
    };
  },
};

/** The tuner for `createRuntimeApi`'s controls. */
export function tunerControls(metronomePlaying: () => boolean) {
  return {
    start: () => tunerStore.open(metronomePlaying),
    stop: () => tunerStore.close(),
    getState: () => tunerStore.state(),
  };
}
