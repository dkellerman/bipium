/* A faint green streak in the header's bottom shadow while the metronome plays: one
 * crossing per beat, always left to right, brightest mid-way and a little brighter on the
 * downbeat. Timed from the metronome's scheduled beats on the audio clock, so it stays
 * with the sound. Hidden with reduced motion. */
import { useEffect, useRef } from 'react';
import { useApp } from '@/AppContext';

export function BeatGlow() {
  const { metronome, started } = useApp();
  const streak = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = streak.current;
    if (!el || !started) return;
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const now = metronome.now;
      const beats = metronome.scheduledClicks.filter(c => c.subDiv === 1 && c.time <= now);
      const last = beats[beats.length - 1];
      if (!last) {
        el.style.opacity = '0';
        return;
      }
      const phase = Math.min(1, (now - last.time) / metronome.beatTime);
      const x = phase; // left to right, once per beat
      const peak = last.beat === 1 ? 0.75 : 0.5;
      el.style.opacity = String(peak * Math.sin(Math.PI * phase));
      // The streak is 40% of the edge, centered: its center travels the full width.
      el.style.transform = `translateX(${((x - 0.5) * 250).toFixed(2)}%)`;
    };
    draw();
    return () => {
      cancelAnimationFrame(frame);
      el.style.opacity = '0';
    };
  }, [metronome, started]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 overflow-hidden motion-reduce:hidden"
    >
      <div
        ref={streak}
        className="absolute inset-y-0 left-[30%] w-[40%] bg-[radial-gradient(closest-side,var(--color-emerald-500),transparent)] opacity-0"
      />
    </div>
  );
}
