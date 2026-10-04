/* Shown before voice mode starts: what it is and what you can say. "Don't show this
 * again" persists in localStorage, after which the Listen button starts right away. */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
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
  { title: 'Drum parts', say: ['snare on 2 and 4', 'hi-hat on every eighth', 'clear the drums'] },
  { title: 'Control', say: ['start', 'stop', 'reset', 'stop listening'] },
];

export function VoiceIntro({
  variant,
  onStart,
  onCancel,
}: {
  variant: 'classic' | 'machine' | 'api';
  onStart: () => void;
  onCancel: () => void;
}) {
  const [dontShow, setDontShow] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const machine = variant === 'machine';
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/60"
        onClick={() => close(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-intro-title"
        className={cn(
          'relative flex max-h-[88dvh] w-full flex-col text-left sm:max-h-[85vh] sm:max-w-lg',
          machine
            ? 'rounded-t-xl border-[3px] border-stone-900 bg-[#f6f3ea] text-stone-900 shadow-[4px_4px_0_#1c1917] sm:rounded-xl'
            : 'rounded-t-2xl bg-white text-slate-900 shadow-xl sm:rounded-2xl',
        )}
      >
        <div className="px-5 pt-5 sm:px-6">
          <h2 id="voice-intro-title" className="flex items-center gap-2 text-lg font-semibold">
            Voice mode
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                machine ? 'border-2 border-stone-900 bg-[#ffd76a]' : 'bg-amber-100 text-amber-800',
              )}
            >
              Experimental
            </span>
          </h2>
          <p className={cn('mt-1 text-sm', machine ? 'text-stone-600' : 'text-slate-600')}>
            Control the metronome by talking, counting in, or playing along.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6">
          <dl
            className={cn(
              'divide-y text-sm leading-snug',
              machine ? 'divide-stone-900/15' : 'divide-slate-100',
            )}
          >
            {SECTIONS.map(section => (
              <div key={section.title} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2.5">
                <dt className="pt-0.5 font-semibold">{section.title}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {section.note && (
                    <span className={cn('w-full', machine ? 'text-stone-600' : 'text-slate-600')}>
                      {section.note}
                    </span>
                  )}
                  {section.say.map(phrase => (
                    <span
                      key={phrase}
                      className={cn(
                        'rounded px-1.5 py-0.5',
                        machine
                          ? 'border border-stone-900/30 bg-white/60'
                          : 'bg-slate-100 text-slate-700',
                      )}
                    >
                      {phrase}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          className={cn(
            'flex flex-col gap-3 border-t px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pb-5',
            machine ? 'border-stone-900/20' : 'border-slate-200',
          )}
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={event => setDontShow(event.target.checked)}
              className={cn('size-4', machine ? 'accent-stone-900' : 'accent-sky-600')}
            />
            Don’t show this again
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => close(false)}
              className={cn(
                'h-11 flex-1 rounded-md px-4 text-sm font-medium sm:h-10 sm:flex-none',
                machine
                  ? 'border-[3px] border-stone-900 bg-[#f6f3ea] shadow-[2px_2px_0_#1c1917] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1c1917]'
                  : 'border border-slate-300 bg-white hover:bg-slate-50',
              )}
            >
              Cancel
            </button>
            <button
              ref={startRef}
              type="button"
              onClick={() => close(true)}
              className={cn(
                'h-11 flex-1 rounded-md px-5 text-sm font-semibold sm:h-10 sm:flex-none',
                machine
                  ? 'border-[3px] border-stone-900 bg-[#e5484d] text-white shadow-[2px_2px_0_#1c1917] active:translate-x-px active:translate-y-px active:shadow-[1px_1px_0_#1c1917]'
                  : 'bg-slate-900 text-white hover:bg-slate-800',
              )}
            >
              Start
            </button>
          </div>
        </div>
      </div>
    </div>,
    // Inside the phone screen on desktop (see PhoneFrame), otherwise the page.
    document.getElementById('phone-screen') ?? document.body,
  );
}
