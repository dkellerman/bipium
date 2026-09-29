import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Mic, Square, LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readVoiceResponse } from '@/lib/voice-response';
import type { ApiConfig, RuntimeApi } from '@/core/api';

type RecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; length: number; [index: number]: { transcript: string } };
  };
};
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  phrases?: { phrase: string; boost: number }[];
  start(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};
type VoiceResult = {
  prompt: string;
  message: string;
  call: {
    method: 'setConfig' | 'stop' | 'clearLoopPattern' | 'resetToDefaults';
    args: ApiConfig[];
  } | null;
  playback?: string;
  confidence: number;
  references: { id: number; title: string; url: string }[];
  [key: string]: unknown;
};
const runtime = () => (window as unknown as { bpm: RuntimeApi }).bpm;
const constructor = () => {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const duckAudio = (listening: boolean) => {
  if (!isIOS()) window.dispatchEvent(new CustomEvent('bipium:voice-duck', { detail: listening }));
};
export function ListenControl({
  variant = 'classic',
}: {
  variant?: 'classic' | 'machine' | 'api';
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.getElementById(`voice-text-${variant}`));
  }, [variant]);
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [lastHeard, setLastHeard] = useState('');
  const [status, setStatus] = useState('Describe a beat to get started.');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<VoiceResult[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('bipium-voice-history') || '[]').slice(-10);
    } catch {
      return [];
    }
  });
  const historyRef = useRef(history);
  const active = useRef(false),
    sr = useRef<Recognition | null>(null),
    generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    queue = useRef(Promise.resolve()),
    restart = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    active.current = false;
    generation.current++;
    controller.current?.abort();
    if (restart.current) clearTimeout(restart.current);
    sr.current?.abort();
    duckAudio(false);
    setListening(false);
    setInterim('');
    setBusy(false);
    setStatus('Listening stopped.');
  };
  useEffect(
    () => () => {
      active.current = false;
      generation.current++;
      controller.current?.abort();
      sr.current?.abort();
      duckAudio(false);
      if (restart.current) clearTimeout(restart.current);
    },
    [],
  );
  useEffect(() => {
    try {
      sessionStorage.setItem('bipium-voice-history', JSON.stringify(history));
    } catch {
      /* Session history is optional when storage is full. */
    }
  }, [history]);
  const submit = (prompt: string, alternatives: string[] = []) => {
    prompt = prompt.trim();
    if (!prompt) return;
    setLastHeard(prompt);
    if (/^stop listening[.!?]*$/i.test(prompt)) {
      stop();
      setStatus('Listening stopped.');
      return;
    }
    const version = generation.current;
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (version !== generation.current) return;
        const api = runtime();
        if (!api) {
          setStatus('The player is still loading. Try again shortly.');
          return;
        }
        const abort = new AbortController();
        controller.current = abort;
        setBusy(true);
        setStatus(`Finding a beat for “${prompt}”…`);
        try {
          const response = await fetch('/api/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
            body: JSON.stringify({
              prompt,
              alternatives,
              currentConfig: api.getConfig(),
              recentTurns: historyRef.current
                .slice(-6)
                .map(turn => ({ prompt: turn.prompt, applied: turn.call !== null })),
            }),
            signal: abort.signal,
          });
          const result = await readVoiceResponse(response, message => {
            if (version === generation.current) setStatus(message);
          });
          if (version !== generation.current) return;
          if (result.call?.method === 'setConfig') {
            const validated = api.validateConfig(result.call.args[0]);
            if (!validated.ok) throw Error('The returned beat could not be played.');
            flushSync(() => api.setConfig(validated.value));
            if (result.playback === 'start') api.start();
          } else if (result.call?.method === 'stop') api.stop();
          else if (result.call?.method === 'clearLoopPattern')
            flushSync(() => api.clearLoopPattern());
          else if (result.call?.method === 'resetToDefaults')
            flushSync(() => api.resetToDefaults());
          historyRef.current = [...historyRef.current, result].slice(-10);
          setHistory(historyRef.current);
          setStatus(result.message);
        } catch (error) {
          if (!abort.signal.aborted)
            setStatus(error instanceof Error ? error.message : 'Could not interpret that phrase.');
        } finally {
          if (version === generation.current) setBusy(false);
        }
      });
  };
  const start = () => {
    setOpen(true);
    window.dispatchEvent(new Event('bipium:unlock-audio'));
    const SR = constructor();
    if (!SR) {
      setStatus(
        'Voice recognition is unavailable in this browser. Try a browser that supports it.',
      );
      return;
    }
    const recognition = new SR();
    sr.current = recognition;
    recognition.continuous = !isIOS();
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;
    const Phrase = (
      window as unknown as {
        SpeechRecognitionPhrase?: new (
          phrase: string,
          boost: number,
        ) => { phrase: string; boost: number };
      }
    ).SpeechRecognitionPhrase;
    if (Phrase && 'phrases' in recognition) {
      try {
        recognition.phrases = [
          'kick',
          'snare',
          'hi hat',
          'beat one',
          'beat two',
          'beat three',
          'beat four',
          'on the one',
          'on the two',
          'on the three',
          'on the four',
          'and',
          'ee',
          'uh',
          'e and a',
          'and of one',
          'and of two',
          'and of three',
          'and of four',
          'one ee and uh',
          'two ee and uh',
          'three ee and uh',
          'four ee and uh',
          'triplet',
          'one triplet',
          'two triplet',
          'three triplet',
          'four triplet',
          'upbeat',
          'offbeat',
          'subdivs',
          'subdivisions',
          'eighths',
          'sixteenths',
          'tempo',
          'eighth notes',
          'sixteenth notes',
          'triplets',
          'BPM',
          'stop listening',
        ].map(phrase => new Phrase(phrase, 3));
      } catch {
        /* Optional hints must not prevent normal recognition. */
      }
    }
    recognition.onresult = event => {
      if (sr.current !== recognition) return;
      let unfinished = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!active.current) break;
        const result = event.results[i];
        if (result.isFinal)
          submit(
            result[0].transcript,
            Array.from({ length: Math.min(result.length - 1, 2) }, (_, j) =>
              result[j + 1].transcript.trim(),
            ).filter(transcript => transcript && transcript !== result[0].transcript.trim()),
          );
        else unfinished += result[0].transcript;
      }
      setInterim(unfinished);
    };
    recognition.onerror = event => {
      if (sr.current !== recognition) return;
      if (['no-speech', 'aborted'].includes(event.error)) return;
      if (event.error === 'phrases-not-supported' && recognition.phrases?.length) {
        recognition.phrases = [];
        // The normal onend handler restarts without unsupported hints.
        return;
      }
      stop();
      setStatus(
        event.error === 'not-allowed'
          ? 'Microphone permission was denied. Allow microphone access to use voice mode.'
          : `Listening stopped (${event.error}). Tap the microphone to try again.`,
      );
    };
    recognition.onend = () => {
      if (active.current && sr.current === recognition)
        restart.current = setTimeout(() => {
          if (active.current && sr.current === recognition)
            try {
              recognition.start();
            } catch {
              stop();
              setStatus('Listening ended. Tap Listen to try again.');
            }
        }, 150);
    };
    active.current = true;
    setListening(true);
    setStatus('Listening for your next phrase…');
    try {
      recognition.start();
      duckAudio(true);
    } catch {
      stop();
      setStatus('Could not start the microphone. Please try again.');
    }
  };
  const label = listening ? 'Stop listening' : 'Listen';
  const icon = listening ? (
    <Square className="size-5" aria-hidden="true" />
  ) : (
    <Mic className="size-5" aria-hidden="true" />
  );
  const toggle = () => (listening ? stop() : start());
  const reset = () => {
    stop();
    historyRef.current = [];
    setHistory([]);
    setLastHeard('');
    const api = runtime();
    if (api) {
      flushSync(() => api.resetToDefaults());
      setStatus('Beat and voice context reset.');
    } else {
      setStatus('The player is still loading. Try again shortly.');
    }
    setOpen(true);
  };
  const resetButton =
    variant === 'machine' ? (
      <button
        type="button"
        aria-label="Reset beat and voice context"
        title="Reset beat and voice context"
        onClick={reset}
        className="grid size-10 place-items-center rounded-md border-[3px] border-stone-900 bg-[#f6f3ea] shadow-[2px_2px_0_#1c1917] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1c1917]"
      >
        <RotateCcw className="size-5" aria-hidden="true" />
      </button>
    ) : (
      <Button
        type="button"
        variant="outline"
        size={variant === 'classic' ? 'icon' : 'default'}
        className={
          variant === 'classic' ? 'size-11 rounded-full bg-white p-2 shadow-md' : undefined
        }
        title="Reset beat and voice context"
        aria-label="Reset beat and voice context"
        onClick={reset}
      >
        <RotateCcw className="size-5" aria-hidden="true" />
        {variant === 'api' && 'Reset'}
      </Button>
    );
  return (
    <>
      {variant === 'machine' ? (
        <button
          type="button"
          aria-label={label}
          title={label}
          onClick={toggle}
          className="grid size-10 place-items-center rounded-md border-[3px] border-stone-900 bg-[#f6f3ea] shadow-[2px_2px_0_#1c1917] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1c1917]"
        >
          {icon}
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size={variant === 'classic' ? 'icon' : 'default'}
          className={
            variant === 'classic'
              ? 'relative z-10 size-11 rounded-full bg-white p-2 shadow-md'
              : undefined
          }
          title={label}
          aria-label={label}
          onClick={toggle}
        >
          {icon}
          {variant === 'api' && label}
        </Button>
      )}
      {resetButton}
      {open &&
        target &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="h-8 w-full min-w-0 overflow-hidden text-xs leading-4"
            title={`${lastHeard ? `Heard: ${lastHeard}\n` : ''}${status}`}
          >
            <div className="truncate">
              {interim
                ? `Hearing: ${interim}`
                : lastHeard
                  ? `Heard: ${lastHeard}`
                  : listening
                    ? 'Listening…'
                    : ''}
            </div>
            <div className="flex items-center justify-center gap-1 truncate">
              {busy && (
                <LoaderCircle size={12} className="shrink-0 animate-spin" aria-hidden="true" />
              )}
              <span className="truncate">
                {status === 'Listening for your next phrase…'
                  ? 'Try “snare on beat four.”'
                  : status}
              </span>
            </div>
          </div>,
          target,
        )}
    </>
  );
}
