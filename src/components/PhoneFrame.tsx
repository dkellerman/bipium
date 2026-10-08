/* On desktop, the player is styled as a phone: the app keeps its 480px column and the
 * page background, and a bezel is drawn over the column's edges. The transform makes
 * the screen the containing block for the app's fixed-position pieces (dialogs,
 * drawers), so they stay inside it. */
import { useEffect, useState, type ReactNode } from 'react';
import { PHONE_BEZEL, PHONE_WIDTH, phoneHeight } from '@/lib/phone-frame';

const oddSpace = () => ((document.documentElement.clientWidth - PHONE_WIDTH) % 2 === 1 ? 1 : 0);

export function PhoneFrame({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(phoneHeight);
  // Centered in an odd-width window the screen would sit on a half pixel, and the screen
  // layer (the transform) then blurs everything in it: a 1px nudge keeps it whole.
  const [nudge, setNudge] = useState(oddSpace);
  useEffect(() => {
    const onResize = () => {
      setHeight(phoneHeight());
      setNudge(oddSpace());
    };
    window.addEventListener('resize', onResize);
    // The page itself never scrolls; only the phone screen does.
    const root = document.documentElement;
    root.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('resize', onResize);
      root.style.overflow = '';
    };
  }, []);

  return (
    // Around the phone, the page background the app has without the frame.
    <div className="flex h-dvh items-center justify-center overflow-hidden bg-linear-to-b from-[#f8fbff] via-[#eef6ff] to-[#f8fbff] dark:from-[#03060b] dark:via-[#060b14] dark:to-[#03060b]">
      <div className="relative" style={{ width: PHONE_WIDTH, height, marginLeft: nudge }}>
        <div
          id="phone-screen"
          className="h-full w-full overflow-x-hidden overflow-y-auto rounded-[28px] [scrollbar-width:none] *:h-full [&_.min-h-dvh]:min-h-full"
          style={{ transform: 'translateZ(0)' }}
        >
          {children}
        </div>
        {/* The bezel sits outside the screen, so the UI itself is unchanged. */}
        <div
          aria-hidden
          className="pointer-events-none absolute border-neutral-900 shadow-[0_24px_60px_rgba(15,23,42,0.3)] dark:border-slate-600 dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
          // The bezel follows the screen's 28px corners.
          style={{ inset: -PHONE_BEZEL, borderWidth: PHONE_BEZEL, borderRadius: 28 + PHONE_BEZEL }}
        />
      </div>
    </div>
  );
}
