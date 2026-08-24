import React from 'react';
import { GasStation } from '../types';
import { openExternalMaps } from '../utils/navigationHelper';
import { Modal } from './common/Modal';

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
    <Modal isOpen={true} onClose={onClose} title="Station Navigation Summary" className="bg-on-surface text-white p-6 border border-emerald-500/30">
      <div className="flex flex-col gap-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-status-green text-[22px]">
              navigation
            </span>
            <span className="font-bold text-[16px] text-white">
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
        <div className="bg-surface-container-high/20 rounded-2xl p-4 border border-status-green/20 flex flex-col gap-2.5">
          <div>
            <h2 className="font-bold text-[19px] text-white leading-snug truncate">
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
            <span className="bg-status-green/20 text-status-green text-[11.5px] font-semibold px-3 py-1 rounded-full border border-status-green/30">
              {station.statusLabel} • {station.pumpPressure} bar
            </span>
            <span className="bg-white/10 text-white text-[11.5px] font-medium px-3 py-1 rounded-full">
              ₦{station.cngPrice}/kg
            </span>
          </div>
        </div>

        {/* Real Distance & Drive Time Summary Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 text-center">
            <span className="text-[10.5px] font-semibold uppercase text-slate-400 block mb-0.5">
              Estimated Distance
            </span>
            <span className="text-[20px] font-bold text-white">
              {station.distance}
            </span>
          </div>

          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 text-center">
            <span className="text-[10.5px] font-semibold uppercase text-slate-400 block mb-0.5">
              Drive Time ETA
            </span>
            <span className="text-[20px] font-bold text-status-green">
              {station.driveTime}
            </span>
          </div>
        </div>

        {/* External Navigation Launchers */}
        <div className="flex flex-col gap-2.5 pt-1">
          <button
            onClick={handleLaunchMaps}
            className="w-full py-4 bg-status-green hover:opacity-95 text-on-surface font-bold text-[15px] rounded-full shadow-lg flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all"
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
    </Modal>
  );
};
