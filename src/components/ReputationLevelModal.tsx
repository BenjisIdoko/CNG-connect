import React from 'react';
import { Modal } from './common/Modal';
import { DriverTier } from '../utils/reputationEngine';
import { TierBadge } from './common/TierBadge';

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
      {/* data-theme="light" + explicit bg-white: same reasoning as the other rebuilt screens
          (the handoff has no dark-mode values yet) — without the explicit bg, Modal's own
          dark-mode background would show through on a dark system theme. */}
      <div data-theme="light" className="flex flex-col items-center text-center bg-white px-6 pt-8 pb-6">
        <div className="w-[76px] h-[76px] rounded-full bg-[#FDF6E3] flex items-center justify-center text-[2.125rem]">
          <TierBadge tierId={tier.id} size={40} />
        </div>
        <h3 className="font-geist font-extrabold text-heading text-rd-ink leading-tight mt-4">
          You&apos;ve reached
          <br />
          {tier.title}
        </h3>
        <p className="text-caption text-rd-text-tertiary mt-2">{totalPoints.toLocaleString()} total points</p>
        <p className="text-caption text-rd-text-tertiary mt-3 leading-relaxed">{tier.perk}</p>

        {onOpenProfile && (
          <button
            onClick={() => {
              onClose();
              onOpenProfile();
            }}
            className="w-full mt-5 py-3.5 bg-primary text-white font-geist font-bold text-body rounded-full active:scale-[0.98] transition-transform"
          >
            View Profile
          </button>
        )}
        <button onClick={onClose} className="mt-3 text-caption font-semibold text-rd-text-tertiary py-1">
          Keep going
        </button>
      </div>
    </Modal>
  );
};
