import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Mic, Square, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    setStatus('Listening stopped.');
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
  const label = listening ? 'Stop listening' : 'Listen';
  const icon = listening ? (
    <Square className="size-5" aria-hidden="true" />
  ) : (
    <Mic className="size-5" aria-hidden="true" />
  );
  const toggle = () => (listening ? stop() : start());
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
      {open &&
        target &&
        createPortal(
          <div className="w-full text-sm leading-5">
            <p role="status" aria-live="polite" className="text-inherit">
              {interim ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle size={14} className="shrink-0 animate-spin" />
                  <em>{interim}</em>
                </span>
              ) : status === 'Listening for your next phrase…' ? (
                <>
                  Describe a beat. Try “a funky beat at 100 BPM with a little swing.” Say “stop
                  listening” or click the button to stop.
                </>
              ) : (
                <span className="inline-flex items-center gap-2">
                  {busy && <LoaderCircle size={14} className="shrink-0 animate-spin" />}
                  {status}
                </span>
              )}
            </p>
            <details className="mt-1 text-xs opacity-80">
              <summary className="w-fit cursor-pointer">Prompt{latest ? ' & details' : ''}</summary>
              <div className="mt-2 max-h-36 overflow-auto">
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
                    placeholder="Type a beat…"
                    value={text}
                    onChange={event => setText(event.target.value)}
                    maxLength={1000}
                    className="min-w-0 flex-1 rounded border border-slate-300 bg-white p-2 text-sm text-slate-900"
                  />
                  <Button type="submit" aria-label="Play prompt" disabled={!text.trim()}>
                    Play
                  </Button>
                </form>
                {latest && (
                  <>
                    <p className="my-2">“{latest.prompt}”</p>
                    <dl className="grid grid-cols-2 gap-x-5 gap-y-1">
                      {Object.entries(latest.confidence).map(([field, value]) => (
                        <div key={field} className="flex justify-between gap-2">
                          <dt>{field}</dt>
                          <dd>{Math.round(value * 100)}%</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="my-2">
                      Jev confidence describes its choice distribution, not measured accuracy.
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
                          new Blob([JSON.stringify(history, null, 2)], {
                            type: 'application/json',
                          }),
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
                  </>
                )}
              </div>
            </details>
          </div>,
          target,
        )}
    </>
  );
}
