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
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    // Around the phone, the page background the theme has without the frame.
    <div className="flex h-dvh items-center justify-center bg-linear-to-b from-[#f8fbff] via-[#eef6ff] to-[#f8fbff] has-[[data-theme=machine]]:bg-[#d8d3c4] has-[[data-theme=machine]]:bg-none">
      <div
        className="relative overflow-hidden rounded-[36px] shadow-[0_24px_60px_rgba(15,23,42,0.3)]"
        style={{ width: PHONE_WIDTH, height }}
      >
        <div
          id="phone-screen"
          className="h-full w-full overflow-x-hidden overflow-y-auto [&_.min-h-dvh]:min-h-full"
          style={{ transform: 'translateZ(0)' }}
        >
          {children}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[100] rounded-[36px] border-neutral-900"
          style={{ borderWidth: PHONE_BEZEL }}
        />
      </div>
    </div>
  );
}
