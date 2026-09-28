import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installStaleChunkReload } from './staleChunkReload';

// The test environment is plain node, so `window` needs a minimal stand-in: a real
// EventTarget (for addEventListener/dispatchEvent) plus a stubbed `location.reload`.
describe('installStaleChunkReload', () => {
  const store: Record<string, string> = {};
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    (globalThis as any).sessionStorage = {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    };
    reloadSpy = vi.fn();
    const target = new EventTarget() as unknown as Window;
    (target as any).location = { reload: reloadSpy };
    (globalThis as any).window = target;
  });

  it('reloads once when a lazy chunk fails to load after a deploy', () => {
    installStaleChunkReload();
    const event = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(event);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not reload a second time in the same tab session (no reload loop)', () => {
    installStaleChunkReload();
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('still reloads even when sessionStorage is unavailable (private browsing)', () => {
    (globalThis as any).sessionStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    installStaleChunkReload();
    window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
