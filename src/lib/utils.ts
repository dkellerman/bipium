import { clsx } from 'clsx';
import { extendTailwindMerge, validators } from 'tailwind-merge';
import type { ClassValue } from 'clsx';

// text-px-* (index.css) is a font size, so it merges against text-sm etc., not colors.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ 'text-px': [validators.isNumber] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  return target.isContentEditable;
}
