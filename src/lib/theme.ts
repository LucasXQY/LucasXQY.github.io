// Theme read/write for client scripts. The matching pre-paint snippet is the inline script in
// Base.astro; keep the storage key and the dark default in sync with it.

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'qx.theme';

const isTheme = (value: unknown): value is Theme => value === 'dark' || value === 'light';

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null; // storage blocked or unavailable
  }
}

/**
 * The theme in effect: the page's own `data-theme` first (it stays right even when storage is
 * blocked), then the stored choice, then dark. The system colour scheme is deliberately not
 * consulted: a first visit is dark for everyone.
 */
export function getTheme(): Theme {
  const applied =
    typeof document === 'undefined' ? undefined : document.documentElement.dataset.theme;
  if (isTheme(applied)) return applied;
  return readStored() ?? 'dark';
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The theme still applies for this page view.
  }
}

/** Flip the theme and return the new one. */
export function toggleTheme(): Theme {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
