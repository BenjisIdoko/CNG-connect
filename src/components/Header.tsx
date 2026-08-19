import React from 'react';
import { ASSETS } from '../data/mockData';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onAvatarClick?: () => void;
  userAvatar?: string;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  onAvatarClick,
  userAvatar = ASSETS.userAvatar,
  rightAction
}) => {
  return (
    <header className="fixed top-0 w-full z-50 bg-[#f2fcf5]/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-[#dbe5de]/60">
      <div className="h-16 px-4 md:px-6 max-w-xl mx-auto flex items-center justify-between pt-safe">
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              onClick={onBack}
              aria-label="Go back"
              className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full text-[#006c50] hover:bg-[#e6f0e9] active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
          ) : null}

          <div className="flex items-center gap-2">
            <img
              src={ASSETS.logo}
              alt="GasFinder Logo"
              className="h-7 w-auto object-contain"
            />
            <span className="font-extrabold text-[20px] text-[#006c50] tracking-tight">
              {title}
            </span>
          </div>
        </div>

        {rightAction ? (
          rightAction
        ) : (
          <button
            onClick={onAvatarClick}
            aria-label="Open profile"
            className="w-10 h-10 rounded-full object-cover p-0.5 border border-[#006c50]/20 hover:border-[#006c50] transition-transform active:scale-95 focus:outline-none"
          >
            <img
              src={userAvatar}
              alt="User Profile"
              className="w-full h-full rounded-full object-cover"
            />
          </button>
        )}
      </div>
    </header>
  );
};
