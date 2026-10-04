/* On desktop, the player is styled as a phone: the app renders inside a phone-shaped
 * box. The transform makes the box the containing block for the app's fixed-position
 * pieces (the machine layout, dialogs, drawers), so they stay inside the screen. */
import { useEffect, useState, type ReactNode } from 'react';
import { PHONE_BEZEL, PHONE_WIDTH, phoneHeight } from '@/lib/phone-frame';

export function PhoneFrame({ children }: { children: ReactNode }) {
  const [height, setHeight] = useState(phoneHeight);
  useEffect(() => {
    const onResize = () => setHeight(phoneHeight());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="flex h-dvh items-center justify-center bg-linear-to-b from-slate-200 to-slate-300">
      <div
        className="rounded-[36px] bg-neutral-900 shadow-[0_24px_60px_rgba(15,23,42,0.3)]"
        style={{ padding: PHONE_BEZEL }}
      >
        <div
          id="phone-screen"
          className="overflow-x-hidden overflow-y-auto rounded-[28px] [&_.min-h-dvh]:min-h-full"
          style={{ width: PHONE_WIDTH, height, transform: 'translateZ(0)' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
