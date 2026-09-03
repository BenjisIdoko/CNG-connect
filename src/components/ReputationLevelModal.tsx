import React from 'react';
import { Modal } from './common/Modal';
import { DriverTier } from '../utils/reputationEngine';
import { Trophy, Award, CheckCircle, ArrowRight } from 'lucide-react';

interface ReputationLevelModalProps {
  isOpen: boolean;
  tier: DriverTier;
  totalPoints: number;
  onClose: () => void;
  onOpenProfile?: () => void;
}

export const ReputationLevelModal: React.FC<ReputationLevelModalProps> = ({
  isOpen,
  tier,
  totalPoints,
  onClose,
  onOpenProfile,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Driver Reputation Level Up!">
      <div className="flex flex-col items-center text-center p-2 sm:p-4 gap-4">
        {/* Animated Trophy Icon Container */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center border-4 border-[#00FFC2] shadow-xl animate-bounce">
            <span className="text-5xl">{tier.badgeIcon}</span>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-[#004D40] text-[#00FFC2] p-2 rounded-full shadow-md border border-[#00FFC2]">
            <Trophy className="w-5 h-5" />
          </div>
        </div>

        {/* Level Up Title */}
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold tracking-wide uppercase mb-2">
            New Driver Level Unlocked
          </span>
          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {tier.title}
          </h3>
          <p className="text-sm font-semibold text-emerald-700 mt-1">
            Total Points: <span className="font-extrabold text-[#004D40]">{totalPoints} pts</span>
          </p>
        </div>

        {/* Tier Perks Box */}
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            <Award className="w-4 h-4 text-primary" />
            <span>Unlocked Perks & Privileges</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{tier.perk}</span>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-700 font-medium">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Official <strong className="font-bold text-slate-900">{tier.title}</strong> badge rendered next to your reports & posts.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
          >
            Keep Driving
          </button>
          {onOpenProfile && (
            <button
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-[#004D40] hover:bg-[#00382e] text-[#00FFC2] font-extrabold text-sm transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View Profile</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
