import React, { useState, useEffect } from 'react';
import { GasStation } from '../types';
import { ASSETS } from '../data/mockData';

interface LiveNavigationModalProps {
  station: GasStation;
  onClose: () => void;
}

export const LiveNavigationModal: React.FC<LiveNavigationModalProps> = ({
  station,
  onClose,
}) => {
  const [currentSpeed, setCurrentSpeed] = useState(42);
  const [stepIndex, setStepIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const navigationSteps = [
    { icon: 'turn_right', instruction: 'In 200m, turn right onto Aminu Kano Crescent', distance: '200m' },
    { icon: 'straight', instruction: 'Continue straight past Wuse 2 Park', distance: '600m' },
    { icon: 'turn_left', instruction: 'In 300m, turn left into Total Service Station', distance: '300m' },
    { icon: 'local_gas_station', instruction: `Arrive at ${station.name} on the right`, distance: '100m' },
  ];

  // Simulate speed variation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSpeed(Math.floor(35 + Math.random() * 18));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const openExternalMaps = () => {
    const lat = station.lat || 9.0765;
    const lng = station.lng || 7.4853;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      window.open(`https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
    }
  };

  const activeStep = navigationSteps[stepIndex];

  return (
    <div className="fixed inset-0 z-50 bg-[#141d19] text-white flex flex-col justify-between font-['Plus_Jakarta_Sans',sans-serif] animate-fade-in">
      {/* Top HUD Card */}
      <div className="p-4 pt-10 bg-gradient-to-b from-[#004D40] to-[#006c50] rounded-b-[32px] shadow-2xl relative">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white backdrop-blur-md transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E676] animate-pulse" />
            <span className="text-[12px] font-black uppercase tracking-wider text-emerald-200">
              Live Turn-By-Turn Navigation
            </span>
          </div>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white backdrop-blur-md transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isMuted ? 'volume_off' : 'volume_up'}
            </span>
          </button>
        </div>

        {/* Next Maneuver Banner */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center gap-4 border border-white/15">
          <div className="w-14 h-14 rounded-2xl bg-[#00E676] text-[#004D40] flex items-center justify-center shrink-0 shadow-lg">
            <span className="material-symbols-outlined text-[34px] font-bold">
              {activeStep.icon}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
              In {activeStep.distance}
            </span>
            <p className="text-[16px] font-extrabold text-white leading-tight truncate">
              {activeStep.instruction}
            </p>
          </div>
        </div>
      </div>

      {/* Center Simulated Route Display */}
      <div className="flex-1 relative flex items-center justify-center p-6 bg-[#0c1310] overflow-hidden">
        {/* Animated GPS Navigation Path Line */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
          <div className="w-96 h-96 rounded-full border-4 border-dashed border-[#00E676] animate-spin" style={{ animationDuration: '20s' }} />
        </div>

        {/* Station Target Card */}
        <div className="bg-[#141d19] border border-emerald-500/30 rounded-3xl p-5 w-full max-w-sm shadow-2xl flex flex-col items-center text-center relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-[#00E676] flex items-center justify-center mb-3 border border-emerald-400/30">
            <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              navigation
            </span>
          </div>
          <h2 className="font-extrabold text-[20px] text-white leading-snug">
            {station.name}
          </h2>
          <p className="text-[13px] text-emerald-300/90 font-medium mt-1">
            {station.address}
          </p>

          <div className="mt-4 flex items-center gap-3 w-full justify-center">
            <span className="bg-emerald-500/20 text-[#00E676] text-[12px] font-bold px-3 py-1 rounded-full border border-emerald-500/40">
              🟢 {station.statusLabel} ({station.pumpPressure} bar)
            </span>
            <span className="text-[12px] font-semibold text-slate-300">
              {station.distance}
            </span>
          </div>

          {/* Maneuver Step Progress Toggles */}
          <div className="mt-5 flex items-center justify-between w-full pt-4 border-t border-white/10">
            <button
              onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
              disabled={stepIndex === 0}
              className="px-3 py-1.5 rounded-xl bg-white/10 disabled:opacity-30 text-[12px] font-bold"
            >
              Prev Step
            </button>
            <span className="text-[12px] font-bold text-slate-400">
              Step {stepIndex + 1} of {navigationSteps.length}
            </span>
            <button
              onClick={() => setStepIndex((prev) => Math.min(prev + 1, navigationSteps.length - 1))}
              disabled={stepIndex === navigationSteps.length - 1}
              className="px-3 py-1.5 rounded-xl bg-[#00E676] text-[#004D40] disabled:opacity-30 text-[12px] font-extrabold"
            >
              Next Step
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Floating Controls & External Maps Launcher */}
      <div className="p-5 pb-8 bg-[#141d19] border-t border-white/10 rounded-t-[32px] flex flex-col gap-4">
        {/* Real-time Telemetry Stats */}
        <div className="flex items-center justify-around bg-white/5 rounded-2xl p-3 border border-white/10 text-center">
          <div>
            <span className="text-[10.5px] font-bold uppercase text-slate-400 block">ETA</span>
            <span className="text-[18px] font-extrabold text-[#00E676]">
              {station.driveTime.replace(' drive', '')}
            </span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Distance</span>
            <span className="text-[18px] font-extrabold text-white">
              {station.distance}
            </span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div>
            <span className="text-[10.5px] font-bold uppercase text-slate-400 block">Speed</span>
            <span className="text-[18px] font-extrabold text-amber-400">
              {currentSpeed} <span className="text-[11px] font-normal">km/h</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={openExternalMaps}
            className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-[14.5px] rounded-full shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">map</span>
            <span>Open Google / Apple Maps</span>
          </button>
          <button
            onClick={onClose}
            className="py-4 px-6 bg-rose-600/90 hover:bg-rose-600 text-white font-extrabold text-[14.5px] rounded-full shadow-md active:scale-95 transition-all"
          >
            End Drive
          </button>
        </div>
      </div>
    </div>
  );
};
