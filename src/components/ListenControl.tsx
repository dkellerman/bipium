import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Mic, Square, LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readVoiceResponse } from '@/lib/voice-response';
import { GrokRecognition, type TranscriptWord } from '@/lib/grok-recognition';
import type { ApiConfig, RuntimeApi } from '@/core/api';

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
export function ListenControl({
  variant = 'classic',
}: {
  variant?: 'classic' | 'machine' | 'api';
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [resetTarget, setResetTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.getElementById(`voice-text-${variant}`));
    setResetTarget(document.getElementById(`reset-control-${variant}`));
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
    sr = useRef<GrokRecognition | null>(null),
    generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    queue = useRef(Promise.resolve());
  const stop = () => {
    active.current = false;
    generation.current++;
    controller.current?.abort();
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
  const submit = (prompt: string, alternatives: string[] = [], words?: TranscriptWord[]) => {
    prompt = prompt.trim();
    if (!prompt) return;
    setLastHeard(prompt);
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
              transcriptionWords: words,
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
          if (result.listening === 'stop') stop();
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
    const recognition = new GrokRecognition();
    sr.current = recognition;
    recognition.onanalysis = result => {
      if (active.current && sr.current === recognition) setStatus(result.message);
    };
    recognition.onready = () => {
      if (active.current && sr.current === recognition)
        setStatus('Listening for your next phrase…');
    };
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
            event.words,
          );
        else unfinished += result[0].transcript;
      }
      setInterim(unfinished);
    };
    recognition.onerror = event => {
      if (sr.current !== recognition) return;
      stop();
      setStatus(
        event.error === 'not-allowed'
          ? 'Microphone permission was denied. Allow microphone access to use voice mode.'
          : 'Could not continue listening. Tap the microphone to try again.',
      );
    };
    active.current = true;
    setListening(true);
    setStatus('Connecting microphone…');
    try {
      recognition.start();
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
      setStatus('');
      setOpen(false);
    } else {
      setStatus('The player is still loading. Try again shortly.');
      setOpen(true);
    }
  };
  const resetButton =
    variant === 'machine' ? (
      <button
        type="button"
        aria-label="Reset"
        title="Reset"
        onClick={reset}
        className="grid size-10 place-items-center rounded-md border-[3px] border-stone-900 bg-[#f6f3ea] shadow-[2px_2px_0_#1c1917] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1c1917]"
      >
        <RotateCcw className="size-5" aria-hidden="true" />
      </button>
    ) : (
      <Button
        type="button"
        variant={variant === 'classic' ? 'ghost' : 'outline'}
        size={variant === 'classic' ? 'icon' : 'default'}
        className={variant === 'classic' ? 'size-9' : undefined}
        title="Reset"
        aria-label="Reset"
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
      {resetTarget ? createPortal(resetButton, resetTarget) : variant === 'api' && resetButton}
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
