/* UI theme selection: which interface the site root serves. The choice is
 * made in the side menus and persists in localStorage; /machine renders the
 * machine theme without touching the stored choice. */

export type UITheme = 'classic' | 'machine';

const THEME_KEY = 'uiTheme';

export function getStoredTheme(): UITheme | null {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'classic' || value === 'machine' ? value : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: UITheme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Navigation still lands on the right page; only persistence is lost.
  }
}
