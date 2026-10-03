/**
 * A 1px line centered on a pixel boundary straddles two pixels; without antialiasing
 * the renderer picks one or drops it depending on the exact position, so lines go
 * missing or look uneven after a resize. Centering on a pixel keeps every line crisp.
 */
export function crispLine(position: number, size: number) {
  return Math.min(size - 0.5, Math.max(0.5, Math.floor(position) + 0.5));
}
