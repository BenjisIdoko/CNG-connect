import React from 'react';
import { GasStation } from '../types';
import { openExternalMaps, openGoogleMapsPin } from '../utils/navigationHelper';
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

  const handleLaunchPin = () => {
    openGoogleMapsPin(station);
    onClose();
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Station Navigation Summary" className="text-on-surface">
      <div className="flex flex-col gap-5">
        {/* Station Overview Card */}
        <div className="bg-surface-container rounded-2xl p-4 flex flex-col gap-2.5">
          <div>
            <h2 className="font-bold text-[19px] text-on-surface leading-snug truncate">
              {station.name}
            </h2>
            <p className="text-[13px] text-slate-500 font-normal mt-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-outline">
                location_on
              </span>
              <span>{station.address}</span>
            </p>

            {station.lat && station.lng && (
              <p className="text-[11.5px] text-primary font-medium mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  {station.locationPrecision === 'gps_confirmed' ? 'my_location' : 'pin_drop'}
                </span>
                <span>
                  Coordinates: {station.lat.toFixed(6)}, {station.lng.toFixed(6)}
                  {station.locationPrecision === 'gps_confirmed' ? ' (GPS Confirmed Exact)' : ''}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="bg-primary-container text-on-primary-container text-[11.5px] font-semibold px-3 py-1 rounded-full">
              {station.statusLabel} {station.pumpPressure ? `• ${station.pumpPressure} bar` : ''}
            </span>
            {station.cngPrice && (
              <span className="bg-white text-slate-700 text-[11.5px] font-medium px-3 py-1 rounded-full">
                ₦{station.cngPrice}/kg
              </span>
            )}
          </div>
        </div>

        {/* Real Distance & Drive Time Summary Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container rounded-2xl p-3.5 text-center">
            <span className="text-[10.5px] font-semibold uppercase text-outline block mb-0.5">
              Estimated Distance
            </span>
            <span className="text-[20px] font-bold text-on-surface">
              {station.distance}
            </span>
          </div>

          <div className="bg-surface-container rounded-2xl p-3.5 text-center">
            <span className="text-[10.5px] font-semibold uppercase text-outline block mb-0.5">
              Drive Time ETA
            </span>
            <span className="text-[20px] font-bold text-primary">
              {station.driveTime}
            </span>
          </div>
        </div>

        {/* External Navigation Launchers */}
        <div className="flex flex-col gap-2.5 pt-1">
          <button
            onClick={handleLaunchPin}
            className="w-full py-3.5 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-[14.5px] rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">pin_drop</span>
            <span>Open Location Pin on Google Maps</span>
          </button>

          <button
            onClick={handleLaunchMaps}
            className="w-full py-3.5 bg-primary hover:opacity-95 text-white font-bold text-[14.5px] rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">turn_right</span>
            <span>Turn-by-Turn Navigation</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 text-outline hover:text-slate-900 font-bold text-[13px] rounded-full active:scale-[0.98] transition-all"
          >
            Close Summary
          </button>
        </div>
      </div>
    </Modal>
  );
};
