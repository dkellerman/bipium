/* On desktop, the app is shown in a phone-shaped frame: the real page runs in a
 * phone-sized iframe, so its layout, breakpoints and scrolling match a phone. */
import { useEffect, useState } from 'react';

const WIDTH = 430; // a large phone's width (iPhone Pro Max)
const MAX_HEIGHT = 932;
const BEZEL = 8;
const MARGIN = 16; // space around the frame

/**
 * Desktop only: a wide, tall window with a mouse (hover-capable fine pointer) and no
 * touchscreen, so phones and tablets (including iPads with a trackpad) never get it.
 */
export function shouldShowPhoneFrame() {
  if (window.top !== window.self) return false;
  if (new URLSearchParams(window.location.search).has('noframe')) return false;
  if (!['/', '/machine'].includes(window.location.pathname)) return false;
  if (navigator.maxTouchPoints > 0) return false;
  return window.matchMedia(
    '(min-width: 900px) and (min-height: 700px) and (pointer: fine) and (hover: hover)',
  ).matches;
}

export function PhoneFrame() {
  // As tall as the window allows, so the app gets as much room as possible.
  const fit = () => Math.min(MAX_HEIGHT, window.innerHeight - 2 * (MARGIN + BEZEL));
  const [height, setHeight] = useState(fit);
  useEffect(() => {
    const onResize = () => setHeight(fit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="flex h-dvh items-center justify-center bg-linear-to-b from-slate-200 to-slate-300">
      <div
        className="rounded-[36px] bg-neutral-900 shadow-[0_24px_60px_rgba(15,23,42,0.3)]"
        style={{ padding: BEZEL }}
      >
        <iframe
          title="Bipium"
          src={window.location.pathname + window.location.search + window.location.hash}
          allow="microphone; autoplay; clipboard-write"
          className="block rounded-[28px] bg-white"
          style={{ width: WIDTH, height }}
        />
      </div>
    </div>
  );
}
