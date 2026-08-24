import React, { useState } from 'react';
import { GasStation, StationStatus, DriverReport } from '../types';

interface ProximityAlertBannerProps {
  station: GasStation;
  onQuickSubmitReport?: (station: GasStation, newReport: DriverReport, newStatus: StationStatus) => void;
  onShareStatus: (station: GasStation) => void;
  onDismiss: () => void;
}

export const ProximityAlertBanner: React.FC<ProximityAlertBannerProps> = ({
  station,
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
    };

    const quickReport: DriverReport = {
      id: `nudge-rep-${Date.now()}`,
      author: 'You (Geofence Nudge)',
      authorAvatar: '',
      verified: false,
      isPhotoVerified: false,
      timestamp: 'Just now',
      status: status,
      statusLabel: statusLabels[status],
      comment: `1-tap geofence update near ${station.name}`,
      likes: 1,
    };

    if (onQuickSubmitReport) {
      onQuickSubmitReport(station, quickReport, status);
    }

    setIsSubmitted(true);
    dismissTimerRef.current = setTimeout(() => {
      onDismiss();
    }, 2200);
  };

  return (
    <div className="fixed top-16 left-0 right-0 z-50 px-3 max-w-xl mx-auto pointer-events-none animate-slide-down">
      <div className="bg-[#141d19]/95 text-white rounded-3xl shadow-[0_16px_48px_rgba(0,0,0,0.35)] border border-status-green/30 p-4.5 flex flex-col gap-3 pointer-events-auto backdrop-blur-xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-status-green/15 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* GPS Pulse Dot */}
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-status-green/20 border border-status-green/40">
              <div className="w-3 h-3 rounded-full bg-status-green animate-ping absolute" />
              <div className="w-2.5 h-2.5 rounded-full bg-status-green relative z-10" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-status-green shrink-0">
                  Geofence Nudge
                </span>
                <span className="text-[10px] bg-status-green/20 text-status-green font-medium px-2 py-0.5 rounded-full border border-status-green/30 shrink-0">
                  +50 PTS
                </span>
              </div>
              <h2 className="text-[15.5px] font-bold text-white leading-tight truncate">
                Arrived near {station.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onDismiss}
            aria-label="Close notification"
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {!isSubmitted ? (
          <>
            {/* Subtext */}
            <p className="text-[12.5px] text-slate-300 leading-snug">
              {station.activePresenceCount ? (
                <>
                  <strong className="text-status-green font-semibold">{station.activePresenceCount} drivers</strong> near {station.name} right now — share what you see!
                </>
              ) : (
                <>You're near {station.name} — share what you see!</>
              )}
            </p>

            {/* Quick 1-Tap Pills Grid */}
            <div className="grid grid-cols-2 gap-2 mt-0.5">
              <button
                onClick={() => handleQuickTap('full')}
                className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-[12px] font-medium transition-all active:scale-95 text-left"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-status-green shrink-0" />
                <span>Full Stock (Fast)</span>
              </button>

              <button
                onClick={() => handleQuickTap('queue')}
                className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-200 text-[12px] font-medium transition-all active:scale-95 text-left"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-status-orange shrink-0" />
                <span>Queuing (&lt;15m)</span>
              </button>

              <button
                onClick={() => handleQuickTap('low')}
                className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-orange-950/80 hover:bg-orange-900 border border-orange-500/40 text-orange-200 text-[12px] font-medium transition-all active:scale-95 text-left"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-status-orange shrink-0" />
                <span>Low Pressure</span>
              </button>

              <button
                onClick={() => handleQuickTap('out')}
                className="flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[12px] font-medium transition-all active:scale-95 text-left"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-outline shrink-0" />
                <span>Out of Gas</span>
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[12px]">
              <button
                onClick={() => onShareStatus(station)}
                className="text-status-green font-semibold hover:underline flex items-center gap-1"
              >
                <span>Add pressure & photo report</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
              <button
                onClick={onDismiss}
                className="text-slate-400 font-medium hover:text-white"
              >
                Not now
              </button>
            </div>
          </>
        ) : (
          /* Confirmation State */
          <div className="py-3 text-center flex flex-col items-center justify-center gap-1.5 animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-status-green/20 border border-status-green text-status-green flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">check_circle</span>
            </div>
            <p className="font-bold text-[15px] text-white">
              Thanks for the update!
            </p>
            <p className="text-[12px] text-status-green font-bold">
              +50 Community Reputation Points Earned 🏆
            </p>
          </div>
        )}
      </div>
    </div>
  );
};


