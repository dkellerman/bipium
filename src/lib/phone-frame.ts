// On desktop the player is styled as a phone: the app renders inside a phone-sized box
// (see PhoneFrame). Code that sizes itself from the window uses viewportSize() so it
// sees the box instead.

export const PHONE_WIDTH = 460;
export const PHONE_BEZEL = 6; // drawn over the column's own edge padding, not added to it

let framed: boolean | null = null;

/**
 * Desktop only: a wide, tall window with a mouse (hover-capable fine pointer) and no
 * touchscreen, so phones and tablets (including iPads with a trackpad) never get it.
 */
export function phoneFramed() {
  if (framed !== null) return framed;
  if (typeof window === 'undefined') return (framed = false);
  framed =
    !new URLSearchParams(window.location.search).has('noframe') &&
    ['/', '/machine'].includes(window.location.pathname) &&
    navigator.maxTouchPoints === 0 &&
    window.matchMedia(
      '(min-width: 900px) and (min-height: 700px) and (pointer: fine) and (hover: hover)',
    ).matches;
  return framed;
}

const MARGIN = 16; // space between the phone and the window edges

/** The screen's height: the window's, less the margin and bezel above and below. */
export function phoneHeight() {
  return window.innerHeight - 2 * (MARGIN + PHONE_BEZEL);
}

/** The space the app has: the phone screen when framed, otherwise the window. */
export function viewportSize() {
  if (typeof window === 'undefined') return { width: 390, height: 844 };
  return phoneFramed()
    ? { width: PHONE_WIDTH, height: phoneHeight() }
    : { width: window.innerWidth, height: window.innerHeight };
}
