import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Mic, Square, X, Send } from 'lucide-react';
import type { ApiConfig, RuntimeApi } from '@/core/api';

type RecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; [index: number]: { transcript: string } };
  };
};
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};
type VoiceResult = {
  prompt: string;
  message: string;
  call: { method: 'setConfig' | 'stop'; args: ApiConfig[] } | null;
  playback?: string;
  confidence: Record<string, number>;
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
export function ListenControl() {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('Describe a beat to get started.');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<VoiceResult[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('bipium-voice-history') || '[]').slice(-10);
    } catch {
      return [];
    }
  });
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
    setListening(false);
    setInterim('');
    setBusy(false);
  };
  useEffect(
    () => () => {
      active.current = false;
      generation.current++;
      controller.current?.abort();
      sr.current?.abort();
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
  const submit = (prompt: string) => {
    prompt = prompt.trim();
    if (!prompt) return;
    if (/^stop listening[.!?]*$/i.test(prompt)) {
      stop();
      setStatus('Listening stopped.');
      return;
    }
    setText(prompt);
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, currentConfig: api.getConfig() }),
            signal: abort.signal,
          });
          const result = await response.json();
          if (!response.ok) throw Error(result.error || 'Could not interpret that phrase.');
          if (version !== generation.current) return;
          if (result.call?.method === 'setConfig') {
            const validated = api.validateConfig(result.call.args[0]);
            if (!validated.ok) throw Error('The returned beat could not be played.');
            flushSync(() => api.setConfig(validated.value));
            if (result.playback === 'start') api.start();
          } else if (result.call?.method === 'stop') api.stop();
          setHistory(previous => [...previous, result].slice(-10));
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
      setStatus('Voice recognition is unavailable in this browser. You can type a beat below.');
      return;
    }
    const recognition = new SR();
    sr.current = recognition;
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    recognition.continuous = !ios;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = event => {
      if (sr.current !== recognition) return;
      let unfinished = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!active.current) break;
        const result = event.results[i];
        if (result.isFinal) submit(result[0].transcript);
        else unfinished += result[0].transcript;
      }
      setInterim(unfinished);
    };
    recognition.onerror = event => {
      if (sr.current !== recognition) return;
      if (['no-speech', 'aborted'].includes(event.error)) return;
      stop();
      setStatus(
        event.error === 'not-allowed'
          ? 'Microphone permission was denied. You can type your beat below.'
          : `Listening stopped (${event.error}). You can try again or type below.`,
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
    } catch {
      stop();
      setStatus('Could not start the microphone. You can type below.');
    }
  };
  const latest = history.at(-1);
  return (
    <>
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border-2 border-stone-800 px-3 text-xs font-bold shadow-sm ${listening ? 'bg-red-700 text-white' : 'bg-[#f6f3ea] text-stone-900'}`}
      >
        {listening ? <Square size={14} /> : <Mic size={16} />}{' '}
        {listening ? 'Stop listening' : 'Listen'}
      </button>
      {!open && history.length > 0 && (
        <button type="button" className="text-xs underline" onClick={() => setOpen(true)}>
          Last prompt
        </button>
      )}
      {open &&
        createPortal(
          <section
            aria-label="Beat voice controls"
            className="fixed bottom-3 right-3 z-50 max-h-[70dvh] w-[min(380px,calc(100vw-24px))] overflow-auto rounded-xl border-2 border-stone-800 bg-[#faf8f2] p-4 text-stone-900 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <strong className="flex items-center gap-2">
                <Mic size={17} />
                {listening ? 'Listening' : 'Describe a beat'}
              </strong>
              <button
                type="button"
                aria-label="Hide voice panel"
                onClick={() => setOpen(false)}
                className="p-1"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed">
              Try “a funky beat at 100 BPM with a little swing,” then “remove the hats.” Say “stop
              listening” or use the button to finish.
            </p>
            <p
              role="status"
              aria-live="polite"
              className="my-3 rounded-md bg-stone-200/60 p-2 text-sm"
            >
              {interim || status}
              {busy && <span className="ml-2 animate-pulse">•••</span>}
            </p>
            <form
              onSubmit={event => {
                event.preventDefault();
                window.dispatchEvent(new Event('bipium:unlock-audio'));
                submit(text);
              }}
              className="flex gap-2"
            >
              <input
                aria-label="Beat prompt"
                placeholder="Or type a beat…"
                value={text}
                onChange={event => setText(event.target.value)}
                maxLength={1000}
                className="min-w-0 flex-1 rounded-md border border-stone-400 bg-white p-2 text-sm"
              />
              <button
                type="submit"
                aria-label="Play prompt"
                disabled={!text.trim()}
                className="rounded-md bg-stone-900 p-2 text-white disabled:opacity-40"
              >
                <Send size={17} />
              </button>
            </form>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => (listening ? stop() : start())}
                className="rounded-md border border-stone-800 px-3 py-2 text-xs font-bold"
              >
                {listening ? 'Stop listening' : 'Listen'}
              </button>
              <button
                type="button"
                onClick={() => {
                  generation.current++;
                  controller.current?.abort();
                  setBusy(false);
                  runtime()?.stop();
                  setStatus(
                    listening ? 'Beat stopped. Listening for your next phrase…' : 'Beat stopped.',
                  );
                }}
                className="rounded-md border border-stone-800 px-3 py-2 text-xs font-bold"
              >
                Stop beat
              </button>
              <span className="text-xs text-stone-600">
                {history.length} recent {history.length === 1 ? 'prompt' : 'prompts'}
              </span>
            </div>
            {latest && (
              <details className="mt-3 border-t border-stone-300 pt-2 text-xs">
                <summary className="cursor-pointer font-semibold">
                  Prompt, confidence & references
                </summary>
                <p className="my-2">“{latest.prompt}”</p>
                <dl className="grid grid-cols-2 gap-1">
                  {Object.entries(latest.confidence).map(([field, value]) => (
                    <div key={field} className="flex justify-between gap-2">
                      <dt>{field}</dt>
                      <dd>{Math.round(value * 100)}%</dd>
                    </div>
                  ))}
                </dl>
                <p className="my-2 text-stone-600">
                  Jev confidence describes its choice distribution, not a measured accuracy score.
                </p>
                {latest.references.map(ref => (
                  <a
                    key={ref.id}
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-1 block underline"
                  >
                    {ref.title}
                  </a>
                ))}
                <button
                  type="button"
                  className="mt-2 underline"
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' }),
                    );
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'bipium-prompts.json';
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Download prompt history and full decisions
                </button>
              </details>
            )}
          </section>,
          document.body,
        )}
    </>
  );
}
