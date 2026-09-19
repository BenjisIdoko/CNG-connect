/**
 * Version check independent of the service worker. Installed PWAs (especially
 * on iOS) can sit on a stale copy for days: the SW update check only runs on a
 * real navigation. Every build publishes /version.json; if it differs from the
 * id baked into this running copy, wipe the SW + caches and reload so the next
 * load comes straight from the network.
 */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';

const RELOAD_GUARD_KEY = 'cng_update_reload_for';

async function fetchLatestBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.id === 'string' ? data.id : null;
  } catch {
    return null;
  }
}

async function wipeAndReload(latestId: string): Promise<void> {
  try {
    // Guard against a reload loop if something keeps serving the old build.
    if (sessionStorage.getItem(RELOAD_GUARD_KEY) === latestId) return;
    sessionStorage.setItem(RELOAD_GUARD_KEY, latestId);
  } catch {
    // sessionStorage unavailable: proceed once anyway
  }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((regs || []).map((r) => r.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      // Keep map tiles / fonts; they are not versioned with the app.
      await Promise.all(
        keys.filter((k) => !/osm-tiles|google-fonts/.test(k)).map((k) => caches.delete(k))
      );
    }
  } catch {
    // best effort
  }
  window.location.reload();
}

export type UpdateResult = 'updating' | 'current' | 'unknown';

/** Returns 'updating' if a newer build exists (the page is about to reload). */
export async function checkForAppUpdate(): Promise<UpdateResult> {
  if (BUILD_ID === 'dev' || !navigator.onLine) return 'unknown';
  const latest = await fetchLatestBuildId();
  if (!latest) return 'unknown';
  if (latest !== BUILD_ID) {
    void wipeAndReload(latest);
    return 'updating';
  }
  return 'current';
}
