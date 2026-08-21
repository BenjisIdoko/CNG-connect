import React from 'react';
import { GasStation } from '../types';
import { openExternalMaps } from '../utils/navigationHelper';

interface LiveNavigationModalProps {
  station: GasStation;
  onClose: () => void;
}

export const LiveNavigationModal: React.FC<LiveNavigationModalProps> = ({
  station,
  onClose,
}) => {
  const handleLaunchMaps = () => {
    openExternalMaps(station);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 font-['Plus_Jakarta_Sans',sans-serif] animate-fade-in">
      {/* Container Card */}
      <div className="bg-[#141d19] text-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-emerald-500/30 flex flex-col gap-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#00E676] text-[22px]">
              navigation
            </span>
            <span className="font-extrabold text-[16px] text-white">
              Station Navigation Summary
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
            aria-label="Close Summary"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Station Overview Card */}
        <div className="bg-[#1c2923] rounded-2xl p-4 border border-emerald-500/20 flex flex-col gap-2.5">
          <div>
            <h2 className="font-extrabold text-[19px] text-white leading-snug">
              {station.name}
            </h2>
            <p className="text-[13px] text-slate-300 font-normal mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-slate-400">
                location_on
              </span>
              <span>{station.address}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
            <span className="bg-emerald-500/20 text-[#00E676] text-[11.5px] font-extrabold px-3 py-1 rounded-full border border-emerald-500/30">
              {station.statusLabel} • {station.pumpPressure} bar
            </span>
            <span className="bg-white/10 text-white text-[11.5px] font-bold px-3 py-1 rounded-full">
              ₦{station.cngPrice}/kg
            </span>
          </div>
        </div>

        {/* Real Distance & Drive Time Summary Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 text-center">
            <span className="text-[10.5px] font-extrabold uppercase text-slate-400 block mb-0.5">
              Estimated Distance
            </span>
            <span className="text-[20px] font-black text-white">
              {station.distance}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 text-center">
            <span className="text-[10.5px] font-extrabold uppercase text-slate-400 block mb-0.5">
              Drive Time ETA
            </span>
            <span className="text-[20px] font-black text-[#00E676]">
              {station.driveTime}
            </span>
          </div>
        </div>

        {/* External Navigation Launchers */}
        <div className="flex flex-col gap-2.5 pt-1">
          <button
            onClick={handleLaunchMaps}
            className="w-full py-4 bg-[#00E676] hover:bg-emerald-400 text-[#004D40] font-black text-[15px] rounded-full shadow-lg flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[22px] shrink-0">map</span>
            <span className="whitespace-nowrap">Open in Maps</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-[13.5px] rounded-full active:scale-[0.98] transition-all"
          >
            Close Summary
          </button>
        </div>
      </div>
    </div>
  );
};
