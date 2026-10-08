/* Light or dark. The choice (system, light or dark) persists in localStorage; "system"
 * follows the OS setting live. Dark is a `dark` class on <html>, set while a page is
 * showing (see ColorModeScope). index.html sets the class before first paint, so dark
 * pages don't flash white. */
import { useEffect, useSyncExternalStore } from 'react';

export type ColorMode = 'system' | 'light' | 'dark';

const MODE_KEY = 'colorMode';
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

export function getColorMode(): ColorMode {
  try {
    const value = window.localStorage.getItem(MODE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function setColorMode(mode: ColorMode) {
  try {
    if (mode === 'system') window.localStorage.removeItem(MODE_KEY);
    else window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Applies for this visit; only persistence is lost.
  }
  listeners.forEach(listener => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const query = darkQuery();
  query.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    query.removeEventListener('change', listener);
  };
};

export const useColorMode = () => useSyncExternalStore(subscribe, getColorMode);

const isDark = () => {
  const mode = getColorMode();
  return mode === 'dark' || (mode === 'system' && darkQuery().matches);
};

/** Applies the color mode to the page while mounted. */
export function ColorModeScope({ children }: { children: React.ReactNode }) {
  const dark = useSyncExternalStore(subscribe, isDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => document.documentElement.classList.remove('dark');
  }, [dark]);
  return children;
}
