import { useEffect, useState } from 'react';

/**
 * The current time, refreshed every minute and whenever the tab becomes visible again.
 *
 * Station freshness is computed from "now", so without a tick a chip reading
 * "Available · 55 min ago" would never become "Available · 1 hr ago" (or turn grey at 24h)
 * until something unrelated re-rendered the screen. Pass the returned value into
 * `getFreshness` / `describeStatus` / `currentStatus` and list it in memo/effect dependencies.
 */
export const useNow = (intervalMs = 60_000): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return now;
};
