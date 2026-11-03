import React, { useEffect, useRef } from 'react';
import { GasStation, StationStatus } from '../types';
import { getFreshness, STATUS_SHORT_LABEL } from '../utils/stationFreshness';

// Drive mode: the one decision a driver in a queue, at night, with one hand free needs —
// where to fill up now — in large type on a dark surface, with every control in the bottom
// half of the screen. Reuses the phone map's ink surface; the app has no dark theme yet.

const STATUS_TEXT: Record<StationStatus, string> = {
  full: 'text-rd-available',
  queue: 'text-rd-queuing',
  low: 'text-rd-low',
  out: 'text-rd-out',
  unknown: 'text-white/70',
};

const goLabel = (station: GasStation) => `Go to ${station.name}, opens directions`;

// Keeps the screen on while the panel is open. Browsers drop the lock when the tab is hidden,
// so it is re-requested when the page comes back. Unsupported or refused is fine: it is a
// convenience, never a requirement.
const useScreenWakeLock = (active: boolean) => {
  const lockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let cancelled = false;
    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.release();
          return;
        }
        lockRef.current = lock;
      } catch {
        // Denied (battery saver, permissions policy): drive mode still works, the screen may dim.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
};

interface DriveModeProps {
  best: GasStation | null;
  /** Other usable stations, best first. Only the first two are shown. */
  alternatives: GasStation[];
  /** Shown when nothing has a usable report, so the panel still offers a next step. */
  fallback: GasStation | null;
  now: number;
  hasGps: boolean;
  onGo: (station: GasStation) => void;
  onExit: () => void;
}

export const DriveMode: React.FC<DriveModeProps> = ({ best, alternatives, fallback, now, hasGps, onGo, onExit }) => {
  useScreenWakeLock(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const target = best ?? fallback;
  const f = target ? getFreshness(target, now) : null;
  const live = !!best && (f?.tier === 'fresh' || f?.tier === 'recent');
  const status: StationStatus = live && f?.lastKnownStatus ? f.lastKnownStatus : 'unknown';
  const meta = target
    ? [hasGps && target.distance ? target.distance : null, hasGps && target.driveTime ? target.driveTime : null]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <section
      aria-label="Drive mode"
      data-theme="light"
      // pb-32 keeps the Exit button above the fixed bottom nav and the floating report button
      // (nav is 68px tall at bottom-4; the report button rises ~117px). Scrolls on short screens.
      className="screen-in lg:hidden absolute bottom-0 left-0 right-0 z-40 max-w-xl mx-auto max-h-[calc(100dvh-4rem)] overflow-y-auto bg-rd-ink text-white rounded-t-[28px] shadow-[0_-10px_30px_rgba(20,32,26,0.35)] px-5 pt-5 pb-32 flex flex-col gap-4"
    >
      {target ? (
        <>
          <p className="font-geist-mono text-micro font-medium text-[#B4BAC4]">
            {best ? 'Best option now' : hasGps ? 'Nearest station' : 'A station in this area'}
            {meta ? ` · ${meta}` : ''}
          </p>
          <div>
            <h2 className="font-geist font-bold text-display leading-tight line-clamp-2">{target.name}</h2>
            <p className={`mt-1 font-geist font-bold text-display leading-tight ${STATUS_TEXT[status]}`}>
              {live && f?.lastKnownStatus ? STATUS_SHORT_LABEL[f.lastKnownStatus] : 'No live report'}
            </p>
            <p className="text-body-lg text-white/80 mt-0.5">
              {live && f ? f.ageText : 'Nobody has reported here today. Report from the pump to help the next driver.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onGo(target)}
            aria-label={goLabel(target)}
            className="w-full min-h-16 rounded-2xl bg-primary text-white font-geist font-bold text-title inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[28px]">directions</span>
            Go
          </button>
        </>
      ) : (
        <div className="py-2">
          <h2 className="font-geist font-bold text-display leading-tight">No stations to show</h2>
          <p className="text-body-lg text-white/80 mt-1">Clear your filters or choose a different area, then try again.</p>
        </div>
      )}

      {best && alternatives.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Other options">
          {alternatives.slice(0, 2).map((st) => {
            const af = getFreshness(st, now);
            const s: StationStatus = af.lastKnownStatus ?? 'unknown';
            const extra = hasGps && st.distance ? ` · ${st.distance}` : '';
            return (
              <li key={st.id} className="flex items-center gap-3 rounded-2xl bg-rd-ink-2 pl-4 pr-2 min-h-16">
                <div className="min-w-0 flex-1 py-2">
                  <p className="font-geist font-semibold text-body-lg truncate">{st.name}</p>
                  <p className={`text-body font-semibold ${STATUS_TEXT[s]}`}>
                    {STATUS_SHORT_LABEL[s]}
                    <span className="text-white/70 font-normal">
                      {' · '}
                      {af.ageText}
                      {extra}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onGo(st)}
                  aria-label={goLabel(st)}
                  className="shrink-0 w-14 h-14 rounded-full bg-white/10 text-white inline-flex items-center justify-center active:scale-95 transition-transform"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[26px]">directions</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={onExit}
        className="w-full min-h-14 rounded-2xl border border-rd-ink-border text-white/90 font-geist font-semibold text-body inline-flex items-center justify-center gap-2 active:bg-rd-ink-2"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[22px]">close</span>
        Exit drive mode
      </button>
    </section>
  );
};
