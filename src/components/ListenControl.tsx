import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Mic, Square, LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readVoiceResponse } from '@/lib/voice-response';
import { GrokRecognition, type RhythmStatus, type TranscriptWord } from '@/lib/grok-recognition';
import type { Onset } from '@/lib/onsets';
import { devLog } from '@/lib/dev-log';
import { VoiceIntro } from '@/components/VoiceIntro';
import { TunerPopup } from '@/components/TunerPopup';
import { tunerStore } from '@/lib/tuner-store';
import type { TunerReading } from '@/lib/tuner';
import { voiceIntroHidden } from '@/lib/voice-intro';
import type { ApiConfig, RuntimeApi } from '@/core/api';

type VoiceResult = {
  prompt: string;
  message: string;
  call: {
    method: 'setConfig' | 'stop' | 'clearLoopPattern' | 'resetToDefaults';
    args: ApiConfig[];
  } | null;
  playback?: string;
  listening?: string;
  debug?: Record<
    string,
    { answers?: Record<string, { choice: string; confidence: number }> } | null
  >;
  [key: string]: unknown;
};
const runtime = () => (window as unknown as { bpm: RuntimeApi }).bpm;
// Local development: log Jev's answers to the console.
const DEV_TOOLS = import.meta.env.DEV && import.meta.env.MODE !== 'test';
function logDecisions(result: VoiceResult) {
  console.groupCollapsed(`[voice] ${result.prompt} → ${result.message}`);
  // Jev stages have answers; others (the count-in estimate) are just logged below.
  for (const [stage, trace] of Object.entries(result.debug ?? {})) {
    const answers = trace?.answers;
    if (!answers) continue;
    console.table(
      Object.fromEntries(
        Object.entries(answers)
          .filter(([, a]) => !['keep', 'none'].includes(a.choice))
          .map(([key, a]) => [`${stage}.${key}`, { choice: a.choice, confidence: a.confidence }]),
      ),
    );
  }
  console.log(result);
  console.groupEnd();
}
const IDLE = 'Listening for your next phrase…';
// Shown while claps or playing are heard, until a tempo is found.
const HEARING_RHYTHM = 'Hearing a rhythm… keep going';
// Progress messages a newer rhythm check may replace (never a voice reply).
const RHYTHM_PROGRESS = [IDLE, HEARING_RHYTHM];
const CONNECTING = 'Connecting microphone…';
const CLAPS_START = 0.9; // how surely the hits were claps for a heard tempo to start playing

// `?voicedebug` in the URL shows what rhythm detection sees; only while it's there.
function voiceDebugEnabled() {
  try {
    localStorage.removeItem('voiceDebug'); // an earlier version remembered the flag
    const flag = new URLSearchParams(window.location.search).get('voicedebug');
    return flag !== null && flag !== '0';
  } catch {
    return false;
  }
}

function describeRhythmStatus({ state, level, onsets, diagnosis }: RhythmStatus) {
  const parts = [`mic ${Number.isFinite(level) ? level : '-∞'} dB`, `${onsets} onsets/8s`, state];
  if (diagnosis) {
    parts.push(diagnosis.result ? `${diagnosis.result.bpm} BPM` : diagnosis.reason);
    if (diagnosis.pulse !== undefined)
      parts.push(
        `pulse ${diagnosis.pulse.toFixed(2)} cov ${diagnosis.coverage?.toFixed(2)}/${diagnosis.chance?.toFixed(2)}`,
      );
  }
  return parts.join(' · ');
}

export function ListenControl({
  variant = 'classic',
}: {
  variant?: 'classic' | 'machine' | 'api';
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [resetTarget, setResetTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  // Looked up again whenever voice mode opens, in case the page re-rendered its slots.
  useEffect(() => {
    setTarget(document.getElementById(`voice-text-${variant}`));
    setResetTarget(document.getElementById(`reset-control-${variant}`));
  }, [variant, open]);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [lastHeard, setLastHeard] = useState('');
  const [status, setStatus] = useState('Describe a beat to get started.');
  const [debug] = useState(voiceDebugEnabled);
  const [debugLine, setDebugLine] = useState('');
  // The last tempo heard from playing, shown with a Start badge while it's the status.
  const [heardTempo, setHeardTempo] = useState<{ label: string; status: string } | null>(null);
  // Playing along: the metronome was started while a tempo heard from playing was shown.
  // Then only a spoken "stop" acts (decided on the server, by what Jev chose).
  const playAlong = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  const heardTempoRef = useRef(heardTempo);
  heardTempoRef.current = heardTempo;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  // When evenly spaced hits (claps, snaps) were last heard, for feedback before a tempo.
  const lastSteady = useRef(-Infinity);
  const iconRef = useRef<SVGSVGElement>(null);
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
  // The guitar tuner: shown when voice mode hears open strings, or opened through the API.
  const tuner = useSyncExternalStore(tunerStore.subscribe, tunerStore.showing);
  useEffect(() => {
    if (sr.current) sr.current.showingTuner = !!tuner;
  }, [tuner]);
  // Local development: `bipiumTuner(reading)` in the console shows the tuner (null hides it).
  useEffect(() => {
    if (!DEV_TOOLS) return;
    const w = window as unknown as { bipiumTuner?: (reading: TunerReading | null) => void };
    w.bipiumTuner = tunerStore.show;
    return () => void delete w.bipiumTuner;
  }, []);
  const stop = () => {
    if (active.current) tunerStore.setVoiceListening(false);
    active.current = false;
    generation.current++;
    controller.current?.abort();
    sr.current?.abort();
    setListening(false);
    setInterim('');
    setBusy(false);
    // The transcript line clears; its row keeps its space.
    setStatus('');
    setOpen(false);
  };
  useEffect(
    () => () => {
      if (active.current) tunerStore.setVoiceListening(false);
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
  const submit = (
    prompt: string,
    alternatives: string[] = [],
    words?: TranscriptWord[],
    onsets?: Onset[],
    music?: number,
    sung?: number,
  ) => {
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
        // Was a tempo heard from playing showing when this was said? (For play-along.)
        const onHeardTempo =
          !!heardTempoRef.current && statusRef.current === heardTempoRef.current.status;
        setStatus(`Finding a beat for “${prompt}”…`);
        const currentConfig = api.getConfig();
        try {
          const response = await fetch('/api/voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
            body: JSON.stringify({
              prompt,
              alternatives,
              transcriptionWords: words,
              ...(onsets?.length ? { onsets } : {}),
              ...(music !== undefined ? { music } : {}),
              ...(sung !== undefined ? { sung } : {}),
              playAlong: playAlong.current,
              playing: api.isStarted(),
              currentConfig,
              recentTurns: historyRef.current.slice(-6).map(turn => ({
                prompt: turn.prompt,
                applied: turn.call !== null,
                outcome: turn.message,
              })),
              ...(DEV_TOOLS || debug ? { debug: true } : {}),
            }),
            signal: abort.signal,
          });
          const result = await readVoiceResponse(response, message => {
            if (version === generation.current) setStatus(message);
          });
          if (version !== generation.current) return;
          if (DEV_TOOLS) logDecisions(result);
          if (debug) {
            const action = result.debug?.main?.answers?.action;
            setDebugLine(
              `“${prompt}” · music ${(music ?? 0).toFixed(2)} · sung ${(sung ?? 0).toFixed(2)}${playAlong.current ? ' · playing along' : ''} → ${
                action ? `${action.choice} ${action.confidence.toFixed(2)}` : 'no action'
              } · ${result.call?.method ?? 'no call'}`,
            );
          }
          devLog('voice', {
            prompt,
            current: currentConfig,
            words,
            onsets,
            music,
            message: result.message,
            call: result.call,
            countIn: result.countIn,
            action: (result.debug as any)?.main?.answers?.action,
          });
          if (result.listening === 'stop') stop();
          if (result.call?.method === 'setConfig') {
            const validated = api.validateConfig(result.call.args[0]);
            if (!validated.ok) throw Error('The returned beat could not be played.');
            flushSync(() => api.setConfig(validated.value));
            if (result.playback === 'start') {
              // Starting on a tempo just heard from playing: from here, only "stop" acts.
              if (onHeardTempo) playAlong.current = true;
              api.start();
            }
          } else if (result.call?.method === 'stop') api.stop();
          else if (result.call?.method === 'clearLoopPattern')
            flushSync(() => api.clearLoopPattern());
          else if (result.call?.method === 'resetToDefaults')
            flushSync(() => api.resetToDefaults());
          historyRef.current = [...historyRef.current, result].slice(-10);
          setHistory(historyRef.current);
          if (result.message) setStatus(result.message);
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
    // Rhythm is only detected while the metronome is stopped: while it plays, its own
    // click reaches the mic and the player isn't asking for a tempo.
    const metronomePlaying = () => !!runtime()?.isStarted();
    recognition.ignoreRhythm = metronomePlaying;
    // Feedback while a rhythm is being confirmed, so playing never looks ignored.
    // Every clap pulses the button; a few evenly spaced say a rhythm is being heard,
    // replacing an older reply (not one still being worked on, or a tempo already heard).
    recognition.onhit = steady => {
      if (!active.current || sr.current !== recognition || metronomePlaying()) return;
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        iconRef.current?.animate(
          [{ transform: 'scale(1.35)', color: '#059669' }, { transform: 'scale(1)' }],
          { duration: 280, easing: 'ease-out' },
        );
      if (!steady) return;
      lastSteady.current = performance.now();
      setOpen(true);
      setStatus(current =>
        busyRef.current ||
        current === CONNECTING ||
        (heardTempoRef.current && current === heardTempoRef.current.status)
          ? current
          : HEARING_RHYTHM,
      );
    };
    recognition.onrhythmcandidate = () => {
      if (!active.current || sr.current !== recognition || metronomePlaying()) return;
      setOpen(true);
      setStatus(current => (RHYTHM_PROGRESS.includes(current) ? HEARING_RHYTHM : current));
    };
    // Feedback whenever the mic picks up sound, so playing is never met with silence.
    recognition.onrhythmstatus = rhythmStatus => {
      if (!active.current || sr.current !== recognition) return;
      if (debug) setDebugLine(describeRhythmStatus(rhythmStatus));
      if (rhythmStatus.state === 'metronome playing') {
        tunerStore.close();
        if (heardTempoRef.current && statusRef.current === heardTempoRef.current.status)
          playAlong.current = true;
      } else playAlong.current = false;
      if (rhythmStatus.state !== 'analyzing' || rhythmStatus.diagnosis?.result) return;
      // Enough onsets to analyze means it's working on a tempo, even if this check failed.
      const analyzed = (rhythmStatus.diagnosis?.onsets ?? 0) >= 8;
      const hitLately = performance.now() - lastSteady.current < 2500;
      const next = analyzed || hitLately ? HEARING_RHYTHM : IDLE;
      setStatus(current => (RHYTHM_PROGRESS.includes(current) ? next : current));
    };
    recognition.onrhythm = rhythm => {
      const api = runtime();
      if (!api || !active.current || sr.current !== recognition) return;
      if (metronomePlaying()) return;
      const patch: Partial<ApiConfig> = { bpm: rhythm.bpm };
      if (rhythm.subdivisions > 1)
        Object.assign(patch, {
          subDivs: rhythm.subdivisions,
          playSubDivs: true,
          swing: rhythm.swing,
        });
      const validated = api.validateConfig(patch);
      if (!validated.ok) return;
      flushSync(() => api.setConfig(validated.value));
      const message = `[rhythm] ${rhythm.bpm} BPM${
        rhythm.subdivisions > 1 ? ` · ${rhythm.subdivisions} per beat` : ''
      }${rhythm.swing ? ` · ${rhythm.swing}% swing` : ''}`;
      // Keep it in the conversation, so "make that half time" refers to it.
      historyRef.current = [
        ...historyRef.current,
        {
          prompt: '(no speech: rhythm heard from playing or clapping)',
          message,
          call: { method: 'setConfig' as const, args: [validated.value] },
        },
      ].slice(-10);
      setHistory(historyRef.current);
      setOpen(true);
      const heard = `${rhythm.bpm} BPM${rhythm.subdivisions > 1 ? `, ${rhythm.subdivisions} per beat` : ''}${
        rhythm.swing ? `, ${rhythm.swing}% swing` : ''
      }`;
      // Clearly claps: play along right away (then only a spoken stop acts). Anything
      // else (an instrument, singing, unsure) waits for "start" or the Start button.
      if ((rhythm.claps ?? 0) >= CLAPS_START) {
        window.dispatchEvent(new Event('bipium:unlock-audio'));
        playAlong.current = true;
        api.start();
        setHeardTempo(null);
        setStatus(`Playing ${heard}.`);
        return;
      }
      const statusText = `Hearing ${heard}. Say “start” or press Start to play.`;
      setHeardTempo({ label: heard, status: statusText });
      setStatus(statusText);
    };
    // Never while the metronome plays (the recognizer doesn't analyze then either).
    recognition.ontuning = reading => {
      if (!active.current || sr.current !== recognition || metronomePlaying()) return;
      recognition.showingTuner = true;
      tunerStore.report(reading);
    };
    recognition.onready = () => {
      if (active.current && sr.current === recognition) setStatus(IDLE);
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
            event.onsets,
            event.music,
            event.sung,
          );
        else unfinished += result[0].transcript;
      }
      setInterim(unfinished);
    };
    recognition.onerror = event => {
      if (sr.current !== recognition) return;
      stop();
      setOpen(true); // errors stay visible
      setStatus(
        event.error === 'not-allowed'
          ? 'Microphone permission was denied. Allow microphone access to use voice mode.'
          : 'Could not continue listening. Tap the microphone to try again.',
      );
    };
    active.current = true;
    // Voice mode's mic takes over the tuner's, if the API had opened one.
    tunerStore.setVoiceListening(true);
    recognition.showingTuner = !!tunerStore.showing();
    setListening(true);
    setStatus(CONNECTING);
    try {
      recognition.start();
    } catch {
      stop();
      setOpen(true);
      setStatus('Could not start the microphone. Please try again.');
    }
  };
  const label = listening ? 'Stop listening' : 'Listen';
  const icon = listening ? (
    <Square ref={iconRef} className="size-5" aria-hidden="true" />
  ) : (
    <Mic ref={iconRef} className="size-5" aria-hidden="true" />
  );
  const [intro, setIntro] = useState(false);
  const toggle = () => {
    if (listening) stop();
    else if (voiceIntroHidden()) start();
    else setIntro(true);
  };
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
        className="grid size-16 place-items-center rounded-md border-[3px] border-stone-900 bg-[#f6f3ea] shadow-[2px_2px_0_#1c1917] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1c1917]"
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
          className="grid size-16 place-items-center rounded-md border-[3px] border-stone-900 bg-[#f6f3ea] shadow-[2px_2px_0_#1c1917] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1c1917]"
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
              ? 'relative z-10 size-11 rounded-full bg-white dark:bg-slate-800 p-2 shadow-md'
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
      {intro && (
        <VoiceIntro
          variant={variant}
          onStart={() => {
            setIntro(false);
            start();
          }}
          onCancel={() => setIntro(false)}
        />
      )}
      {tuner && <TunerPopup reading={tuner} variant={variant} onClose={tunerStore.close} />}
      {open &&
        target &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="h-full w-full min-w-0 overflow-hidden text-center text-xs leading-4 [.voice-roomy_&]:text-px-13 [.voice-roomy_&]:leading-5"
            title={`${lastHeard ? `Heard: ${lastHeard}\n` : ''}${status}`}
          >
            {status === IDLE && !interim && !lastHeard && !debug ? (
              <div className="line-clamp-2 whitespace-normal">
                Try “Make a medium tempo funk beat with a little bit of swing.”
              </div>
            ) : (
              <>
                <div className="truncate opacity-60">
                  {/* What the transcriber heard is lighter and in italics, apart from the app's replies. */}
                  {debug && debugLine && !interim ? (
                    debugLine
                  ) : interim ? (
                    <>
                      Hearing: <i>{interim}</i>
                    </>
                  ) : lastHeard ? (
                    <>
                      Heard: <i>{lastHeard}</i>
                    </>
                  ) : listening ? (
                    'Listening…'
                  ) : (
                    ''
                  )}
                </div>
                <div className="flex items-center justify-center gap-1 truncate">
                  {busy && (
                    <LoaderCircle size={12} className="shrink-0 animate-spin" aria-hidden="true" />
                  )}
                  {heardTempo && status === heardTempo.status ? (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">
                        Hearing <strong>{heardTempo.label}</strong>
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded-full bg-emerald-700 px-2 text-px-11 font-semibold leading-4 text-white hover:bg-emerald-800"
                        onClick={() => {
                          window.dispatchEvent(new Event('bipium:unlock-audio'));
                          playAlong.current = true;
                          runtime()?.start();
                        }}
                      >
                        ▶ Start
                      </button>
                    </span>
                  ) : (
                    <span className="truncate">{status}</span>
                  )}
                </div>
              </>
            )}
          </div>,
          target,
        )}
    </>
  );
}
