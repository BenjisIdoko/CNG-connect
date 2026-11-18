import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A small status message that shows for a couple of seconds. `flash(message)` shows it;
 * `toast` is the element to render once inside the screen. It is announced to screen readers.
 */
export function useAdminToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = useCallback((m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(m);
    timer.current = setTimeout(() => setMessage(null), 2600);
  }, []);

  const toast = (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-6 left-1/2 z-[250] -translate-x-1/2">
      {message && (
        <div className="rounded-md border border-white/20 bg-adm-note px-4 py-2 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(13,59,46,0.3)]">
          {message}
        </div>
      )}
    </div>
  );

  return { flash, toast };
}
