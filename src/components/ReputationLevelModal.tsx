import React from 'react';
import { Modal } from './common/Modal';
import { DriverTier } from '../utils/reputationEngine';

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
    <Modal isOpen={isOpen} onClose={onClose} title="Level up" bare className="max-w-sm">
      <div className="flex flex-col items-center text-center px-6 pt-8 pb-6">
        <div className="w-[76px] h-[76px] rounded-full bg-[#FDF6E3] flex items-center justify-center text-[34px]">
          {tier.badgeIcon}
        </div>
        <h3 className="font-extrabold text-heading leading-tight mt-4">
          You&apos;ve reached
          <br />
          {tier.title}
        </h3>
        <p className="text-caption text-outline mt-2">{totalPoints.toLocaleString()} total points</p>
        <p className="text-caption text-on-surface-variant mt-3 leading-relaxed">{tier.perk}</p>

        {onOpenProfile && (
          <button
            onClick={() => {
              onClose();
              onOpenProfile();
            }}
            className="w-full mt-5 py-3.5 bg-primary text-white font-bold text-body rounded-full active:scale-[0.98] transition-transform"
          >
            View Profile
          </button>
        )}
        <button onClick={onClose} className="mt-3 text-caption font-semibold text-outline py-1">
          Keep going
        </button>
      </div>
    </Modal>
  );
};
