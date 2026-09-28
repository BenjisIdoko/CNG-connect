/**
 * A tab left open across a deploy can try to lazy-load a piece of the app (a modal, the
 * admin dashboard, ...) whose file no longer exists on the server — Vercel doesn't keep
 * a previous deploy's assets once a new one goes live. The browser reports this as
 * "Failed to fetch dynamically imported module" and the tab is stuck: that one screen
 * never opens until the driver manually reloads.
 *
 * Vite's own runtime fires `vite:preloadError` on `window` for exactly this case, so we
 * reload once automatically to pick up the current build. Guarded with sessionStorage so
 * a genuinely broken deploy can't reload the tab in a loop.
 */
export function installStaleChunkReload(): void {
  const KEY = 'cng_reloaded_after_stale_chunk';
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    try {
      if (sessionStorage.getItem(KEY)) return; // already tried this session — avoid a reload loop
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* private mode: sessionStorage unavailable — reload still helps this once */
    }
    window.location.reload();
  });
}
