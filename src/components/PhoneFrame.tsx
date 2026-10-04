/* On desktop, the player is styled as a phone: the app keeps its 480px column and the
 * page background, and a bezel is drawn over the column's edges. The transform makes
 * the screen the containing block for the app's fixed-position pieces (the machine
 * layout, dialogs, drawers), so they stay inside it. */
import { useEffect, useState, type ReactNode } from 'react';
import { PHONE_BEZEL, PHONE_WIDTH, phoneHeight } from '@/lib/phone-frame';

export function PhoneFrame({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(phoneHeight);
  useEffect(() => {
    const onResize = () => setHeight(phoneHeight());
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
    // Around the phone, the page background the theme has without the frame.
    <div className="flex h-dvh items-center justify-center overflow-hidden bg-linear-to-b from-[#f8fbff] via-[#eef6ff] to-[#f8fbff] has-[[data-theme=machine]]:bg-[#d8d3c4] has-[[data-theme=machine]]:bg-none">
      <div className="relative" style={{ width: PHONE_WIDTH, height }}>
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
          className="pointer-events-none absolute rounded-[36px] border-neutral-900 shadow-[0_24px_60px_rgba(15,23,42,0.3)]"
          style={{ inset: -PHONE_BEZEL, borderWidth: PHONE_BEZEL }}
        />
      </div>
    </div>
  );
}
