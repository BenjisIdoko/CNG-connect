import { useEffect, useRef } from 'react';

/**
 * Makes the system back gesture / browser back button close the top-most
 * sheet, dialog or detail screen instead of leaving the app (iOS edge-swipe,
 * Android back). Each open layer owns one history entry.
 */
type Layer = { depth: number; close: () => void };

const layers: Layer[] = [];
let pendingBacks = 0; // history.back() calls we issued and haven't seen a popstate for
const queued: Array<() => void> = [];
let installed = false;
// Depth numbers are unique per page load so history entries left over from an
// earlier session (whose state survives a reload) can never collide with ours.
const BASE = Date.now() * 100;

function flushQueue() {
  while (pendingBacks === 0 && queued.length) queued.shift()!();
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('popstate', () => {
    if (pendingBacks > 0) {
      pendingBacks--;
      flushQueue();
      return;
    }
    const current = (history.state && history.state.cngDepth) || 0;
    while (layers.length && layers[layers.length - 1].depth > current) {
      layers.pop()!.close();
    }
  });
}

export function useBackLayer(active: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    install();

    let layer: Layer | null = null;
    const open = () => {
      const depth = (layers[layers.length - 1]?.depth ?? BASE) + 1;
      layer = { depth, close: () => closeRef.current() };
      layers.push(layer);
      history.pushState({ ...(history.state || {}), cngDepth: depth }, '');
    };

    // Deferred a tick: React StrictMode mounts/unmounts/mounts effects, and a
    // synchronous push+back pair would race the browser's async history.back().
    const timer = window.setTimeout(() => {
      if (pendingBacks > 0) queued.push(open);
      else open();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (!layer) return;
      const i = layers.indexOf(layer);
      if (i === -1) return; // already closed via the back gesture
      const wasTop = i === layers.length - 1;
      layers.splice(i, 1);
      if (wasTop && (history.state?.cngDepth ?? 0) === layer.depth) {
        pendingBacks++;
        history.back();
      }
    };
  }, [active]);
}
