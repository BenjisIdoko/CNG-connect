import React, { useState } from 'react';
import { GasStation, StationStatus, DriverReport } from '../types';

interface ProximityAlertBannerProps {
  station: GasStation;
  /** Return false to signal the report was NOT sent (e.g. driver not signed in). */
  onQuickSubmitReport?: (station: GasStation, newReport: DriverReport, newStatus: StationStatus) => boolean | void;
  /** 'arrival' = geofence says you're here; 'followup' = you tapped Directions earlier. */
  variant?: 'arrival' | 'followup';
  onShareStatus: (station: GasStation) => void;
  onDismiss: () => void;
}

export const ProximityAlertBanner: React.FC<ProximityAlertBannerProps> = ({
  station,
  variant = 'arrival',
  onQuickSubmitReport,
  onShareStatus,
  onDismiss,
}) => {
  const [selectedQuickStatus, setSelectedQuickStatus] = useState<StationStatus | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const dismissTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const handleQuickTap = (status: StationStatus) => {
    setSelectedQuickStatus(status);

    const statusLabels: Record<StationStatus, string> = {
      full: 'Full Stock',
      low: 'Low Pressure',
      queue: 'Queuing',
      out: 'Out of Gas',
      unknown: 'No recent reports',
    };

    const quickReport: DriverReport = {
      id: `nudge-rep-${Date.now()}`,
      author: 'You',
      authorAvatar: '',
      verified: false,
      isPhotoVerified: false,
      timestamp: new Date().toISOString(),
      status: status,
      statusLabel: statusLabels[status],
      likes: 1,
    };

    if (onQuickSubmitReport && onQuickSubmitReport(station, quickReport, status) === false) {
      setSelectedQuickStatus(null);
      return;
    }

    setIsSubmitted(true);
    dismissTimerRef.current = setTimeout(() => {
      onDismiss();
    }, 2200);
  };

  const options: { key: StationStatus; label: string; icon: string; dot: string }[] = [
    { key: 'full', label: 'Full Stock (Fast)', icon: 'check', dot: 'bg-status-green' },
    { key: 'queue', label: 'Queuing (<15m)', icon: 'schedule', dot: 'bg-status-amber' },
    { key: 'low', label: 'Low Pressure', icon: 'warning', dot: 'bg-status-orange' },
    { key: 'out', label: 'Out of Gas', icon: 'close', dot: 'bg-status-red' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] max-w-xl mx-auto pointer-events-none animate-slide-down">
      <div className="bg-white rounded-t-3xl shadow-[0_-14px_40px_rgba(0,0,0,0.3)] px-5 pt-2.5 pb-7 pointer-events-auto">
        <div className="w-10 h-1 bg-surface-container-highest rounded-full mx-auto mb-4" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-body-lg font-extrabold text-slate-900 leading-snug">
              {variant === 'followup' ? `Did you fill up at ${station.name}?` : `Arrived near ${station.name}`}
            </h2>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="w-2 h-2 rounded-full bg-status-green animate-pulse" />
              <span className="text-caption font-semibold text-emerald-700">
                {variant === 'followup'
                  ? 'One tap tells the drivers behind you'
                  : station.activePresenceCount
                  ? `${station.activePresenceCount} drivers here — share what you see`
                  : 'Share what you see'}
              </span>
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Close notification"
            className="w-8 h-8 -mr-1 rounded-full text-outline flex items-center justify-center hover:bg-surface-container"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {!isSubmitted ? (
          <>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {options.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleQuickTap(opt.key)}
                  className="flex items-center gap-2 bg-surface-container rounded-[14px] p-3 text-left active:scale-95 transition-transform"
                >
                  <span className={`w-[26px] h-[26px] rounded-full text-white flex items-center justify-center shrink-0 ${opt.dot}`}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[15px] material-symbols-fill">{opt.icon}</span>
                  </span>
                  <span className="text-caption font-semibold text-slate-900">{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="h-px bg-surface-container-highest mt-4" />
            <div className="flex items-center justify-between mt-3.5">
              <button
                onClick={() => onShareStatus(station)}
                className="text-caption font-bold text-emerald-700 flex items-center gap-1.5"
              >
                Add pressure &amp; photo report
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
              <button onClick={onDismiss} className="text-caption font-semibold text-outline">
                Not now
              </button>
            </div>
          </>
        ) : (
          <div className="py-5 text-center flex flex-col items-center gap-1.5 animate-fade-in">
            <div className="w-11 h-11 rounded-full bg-primary-container text-primary flex items-center justify-center">
              <span aria-hidden="true" className="material-symbols-outlined text-[26px]">check_circle</span>
            </div>
            <p className="font-extrabold text-body-lg text-slate-900">Thanks for the update!</p>
            <p className="text-caption text-emerald-700 font-bold">+50 reputation points earned</p>
          </div>
        )}
      </div>
    </div>
  );
};
