import React, { useEffect, useRef, useState } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';

const THRESHOLD = 64;

/**
 * Pull-down-to-refresh for screens that scroll the page (the browser's native
 * gesture is disabled app-wide via overscroll-behavior). Only starts when the
 * page is scrolled to the very top and no dialog is open.
 */
export const PullToRefresh: React.FC<{ onRefresh: () => Promise<unknown>; disabled?: boolean }> = ({
  onRefresh,
  disabled = false,
}) => {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const pullRef = useRef(0);
  const busyRef = useRef(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (disabled) return;
    let startY = 0;
    let tracking = false;

    const setP = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const onStart = (e: TouchEvent) => {
      if (busyRef.current || window.scrollY > 0 || document.querySelector('[role="dialog"]')) return;
      startY = e.touches[0].clientY;
      tracking = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) return setP(0);
      setP(Math.min(96, dy * 0.5));
    };
    const onEnd = async () => {
      if (!tracking) return;
      tracking = false;
      if (pullRef.current >= THRESHOLD) {
        busyRef.current = true;
        setBusy(true);
        setP(THRESHOLD - 8);
        try {
          await refreshRef.current();
        } finally {
          busyRef.current = false;
          setBusy(false);
          setP(0);
        }
      } else {
        setP(0);
      }
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [disabled]);

  if (pull === 0 && !busy) return null;
  return (
    <div
      className="fixed left-1/2 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-40 -translate-x-1/2 pointer-events-none"
      style={{ transform: `translate(-50%, ${pull - 24}px)`, opacity: Math.min(1, pull / 40) }}
      aria-live="polite"
    >
      <div className="w-10 h-10 rounded-full bg-white shadow-[0_6px_18px_rgba(31,41,35,0.18)] flex items-center justify-center text-primary">
        <ArrowClockwise
          size={20}
          weight="bold"
          className={busy ? 'animate-spin' : ''}
          style={busy ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
      </div>
    </div>
  );
};
