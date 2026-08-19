import React from 'react';
import { GasStation } from '../types';

interface ProximityAlertBannerProps {
  station: GasStation;
  onShareStatus: (station: GasStation) => void;
  onDismiss: () => void;
}

export const ProximityAlertBanner: React.FC<ProximityAlertBannerProps> = ({
  station,
  onShareStatus,
  onDismiss,
}) => {
  return (
    <div className="fixed top-16 left-0 right-0 z-50 px-3 max-w-xl mx-auto pointer-events-none animate-slide-down">
      <div className="bg-white rounded-3xl shadow-[0_12px_36px_rgba(0,0,0,0.14)] border border-slate-200/90 p-5 flex flex-col gap-3 pointer-events-auto">
        {/* Top bar with icon and close button */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-[#006c50] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[22px]">
                local_gas_station
              </span>
            </div>
            <div>
              <p className="text-[12px] font-semibold text-slate-500 tracking-wide">
                GasFinder
              </p>
              <h2 className="text-[16px] font-bold text-slate-900 leading-tight">
                You're near {station.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Close notification"
            className="w-7 h-7 -mt-1 -mr-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Description body */}
        <p className="text-[13.5px] text-slate-600 leading-snug pl-0.5">
          Last update was 42 min ago. Got a second to share the current status?
        </p>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-1">
          <button
            onClick={() => onShareStatus(station)}
            className="px-6 py-2.5 bg-[#005a40] hover:bg-[#004732] text-white font-bold text-[14px] rounded-full transition-all active:scale-95 shadow-xs"
          >
            Share status
          </button>
          <button
            onClick={onDismiss}
            className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-[14px] rounded-full transition-all active:scale-95"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
};

