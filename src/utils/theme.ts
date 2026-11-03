/**
 * Light / dark / system theme. The actual colors live in src/index.css as CSS custom
 * properties re-themed by `[data-theme="dark"]` / a `prefers-color-scheme: dark` media
 * query — this module only ever sets or removes that `data-theme` attribute on <html>.
 *
 * index.html runs the same "read storage, set the attribute" logic inline, synchronously,
 * before the stylesheet paints anything, so a driver who chose "Dark" never sees a flash
 * of the light theme on load. Keep the two in sync if this logic ever changes.
 */
export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'cng_theme_pref';

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* private mode: falls back to system */
  }
  return 'system';
}

/**
 * Whether the dark palette is actually showing: an explicit "dark" on <html>, or no explicit
 * choice and the system prefers dark. (An explicit "light" always wins, as in index.css.)
 */
export function isDarkTheme(dataTheme: string | null, systemPrefersDark: boolean): boolean {
  if (dataTheme === 'dark') return true;
  if (dataTheme === 'light') return false;
  return systemPrefersDark;
}

export function applyThemePref(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* private mode: the choice just won't survive a reload */
  }
  applyThemePref(pref);
}
