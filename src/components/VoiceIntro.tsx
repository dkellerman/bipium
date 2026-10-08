/* Shown before voice mode starts: what it is and what you can say. "Don't show this
 * again" persists in localStorage, after which the Listen button starts right away. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { hideVoiceIntro } from '@/lib/voice-intro';

// Examples per category; a short note only where the examples don't explain it.
const SECTIONS: { title: string; note?: string; say: string[] }[] = [
  {
    title: 'Tempo and feel',
    say: ['120 BPM', 'faster', '3/4 time', 'triplets', 'more swing', 'quieter'],
  },
  { title: 'Styles', say: ['bossa nova', 'slow funk'] },
  {
    title: 'Count in',
    note: 'Count a bar out loud, in time.',
    say: ['1, 2, 3, 4', '1 and 2 and…', '1 e and a 2 e and a…'],
  },
  {
    title: 'Play along',
    note: 'With the metronome stopped, play or clap steadily, then say “start”. Stop it to have it listen again.',
    say: [],
  },
  {
    title: 'Tune a guitar',
    note: 'With the metronome stopped, pluck an open string or strum all six and let them ring. A tuner pops up.',
    say: [],
  },
  { title: 'Drum parts', say: ['snare on 2 and 4', 'hi-hat on every eighth', 'clear the drums'] },
  { title: 'Control', say: ['start', 'stop', 'reset', 'stop listening'] },
];

export function VoiceIntro({ onStart, onCancel }: { onStart: () => void; onCancel: () => void }) {
  const [dontShow, setDontShow] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const close = (start: boolean) => {
    if (dontShow) hideVoiceIntro();
    (start ? onStart : onCancel)();
  };

  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    startRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && closeRef.current(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60"
        onClick={() => close(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-intro-title"
        className="relative flex max-h-[85dvh] w-full flex-col text-left sm:max-h-[85vh] sm:max-w-lg rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xl"
      >
        <div className="px-5 pt-5 sm:px-6">
          <h2 id="voice-intro-title" className="flex items-center gap-2 text-lg font-semibold">
            Voice mode
            <span className="rounded px-1.5 py-0.5 text-px-11 font-semibold uppercase tracking-wide bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
              Experimental
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Control the metronome by talking, counting in, or playing along.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6">
          <dl className="divide-y text-sm leading-snug divide-slate-100 dark:divide-slate-800">
            {SECTIONS.map(section => (
              <div key={section.title} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2.5">
                <dt className="pt-0.5 font-semibold">{section.title}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {section.note && (
                    <span className="w-full text-slate-600 dark:text-slate-400">
                      {section.note}
                    </span>
                  )}
                  {section.say.map(phrase => (
                    <span
                      key={phrase}
                      className="rounded px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      {phrase}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col gap-3 border-t px-5 pb-5 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 border-slate-200 dark:border-slate-700">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={event => setDontShow(event.target.checked)}
              className="size-4 accent-sky-600"
            />
            Don’t show this again
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => close(false)}
              className="h-11 flex-1 rounded-md px-4 text-sm font-medium sm:h-10 sm:flex-none border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              ref={startRef}
              type="button"
              onClick={() => close(true)}
              className="h-11 flex-1 rounded-md px-5 text-sm font-semibold sm:h-10 sm:flex-none bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white"
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
