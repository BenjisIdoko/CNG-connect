import { ComponentType, LazyExoticComponent, lazy } from 'react';

/**
 * A stale chunk 404 after a deploy (a tab left open, trying to load a piece
 * that no longer exists — see staleChunkReload.ts) fires Vite's own
 * `vite:preloadError` event. Our handler for it calls `event.preventDefault()`
 * so the browser doesn't log it as an uncaught crash, but that has a side
 * effect inside Vite's `__vitePreload` runtime: instead of rethrowing, it
 * resolves the dynamic import to `undefined`. A plain
 * `import(...).then((m) => ({ default: m.X }))` then throws
 * "Cannot read properties of undefined" reading `m.X` — in the brief window
 * before the reload our handler already triggered actually takes effect.
 * This renders nothing in that window instead of crashing. `select` (rather
 * than a string key) keeps the component's real prop types intact, same as
 * the plain `.then((m) => ({ default: m.X }))` it replaces.
 */
export function safeLazy<M, T extends ComponentType<any>>(
  loader: () => Promise<M>,
  select: (mod: M) => T
): LazyExoticComponent<T> {
  return lazy(async () => {
    let mod: M | undefined;
    try {
      mod = await loader();
    } catch {
      mod = undefined;
    }
    const Component = mod ? select(mod) : undefined;
    return { default: (Component ?? (() => null)) as T };
  });
}
