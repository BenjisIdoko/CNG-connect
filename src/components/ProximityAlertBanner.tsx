import React from 'react';
import { GasStation, StationStatus } from '../types';

interface ProximityAlertBannerProps {
  station: GasStation;
  /**
   * Called when the driver taps a status. A report needs a live photo taken at the station, so the
   * app answers by opening the report sheet on that status; nothing is posted from here.
   */
  onPickStatus: (station: GasStation, status: StationStatus) => void;
  /** 'arrival' = geofence says you're here; 'followup' = you tapped Directions earlier. */
  variant?: 'arrival' | 'followup';
  onDismiss: () => void;
}

export const ProximityAlertBanner: React.FC<ProximityAlertBannerProps> = ({
  station,
  variant = 'arrival',
  onPickStatus,
  onDismiss,
}) => {
  // 'out' uses a neutral grey circle, not the alarming red the full Report flow uses elsewhere —
  // per design_handoff_cng_connect 9, this quick nudge is deliberately "lighter-weight."
  const options: { key: StationStatus; label: string; icon: string; dot: string }[] = [
    { key: 'full', label: 'Full Stock (Fast)', icon: 'check', dot: 'bg-rd-available' },
    { key: 'queue', label: 'Queuing (<15m)', icon: 'schedule', dot: 'bg-rd-queuing' },
    { key: 'out', label: 'Out of Gas', icon: 'close', dot: 'bg-outline' },
  ];

  return (
    //: same reasoning as the other rebuilt screens — the handoff has no
    // dark-mode values yet.
    <div className="fixed bottom-0 left-0 right-0 z-[60] max-w-xl mx-auto pointer-events-none animate-slide-down">
      <div className="bg-rd-surface rounded-t-[28px] shadow-[0_-14px_40px_rgba(0,0,0,0.3)] px-5 pt-2.5 pb-7 pointer-events-auto">
        <div className="w-10 h-1 bg-rd-handle rounded-full mx-auto mb-4" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-geist text-[1.0625rem] font-extrabold text-rd-fg leading-snug">
              {variant === 'followup' ? `Did you fill up at ${station.name}?` : `Arrived near ${station.name}`}
            </h2>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-2 h-2 rounded-full bg-rd-available animate-pulse" />
              <span className="text-caption font-semibold text-primary">
                {variant === 'followup'
                  ? 'Tap what you saw, then add a photo'
                  : station.activePresenceCount
                  ? `${station.activePresenceCount} drivers here — tap what you see`
                  : 'Tap what you see, then add a photo'}
              </span>
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Close notification"
            className="w-8 h-8 -mr-1 rounded-full text-rd-text-tertiary flex items-center justify-center hover:bg-surface-container"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onPickStatus(station, opt.key)}
              className="flex items-center gap-2 bg-surface-container rounded-[14px] p-3 text-left active:scale-95 transition-transform"
            >
              <span className={`w-[26px] h-[26px] rounded-full text-white flex items-center justify-center shrink-0 ${opt.dot}`}>
                <span aria-hidden="true" className="material-symbols-outlined text-[15px] material-symbols-fill">{opt.icon}</span>
              </span>
              <span className="text-caption font-semibold text-rd-fg">{opt.label}</span>
            </button>
          ))}
        </div>

        <div className="h-px bg-surface-container-highest mt-4" />
        <div className="flex items-center justify-end mt-3.5">
          <button onClick={onDismiss} className="text-caption font-semibold text-rd-text-tertiary">
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};
