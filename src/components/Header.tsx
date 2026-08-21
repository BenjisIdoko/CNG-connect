import React from 'react';
import { ASSETS } from '../data/mockData';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onAvatarClick?: () => void;
  onOpenAiAssistant?: () => void;
  userAvatar?: string;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  onAvatarClick,
  onOpenAiAssistant,
  userAvatar = ASSETS.userAvatar,
  rightAction
}) => {
  return (
    <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
      <div className="h-16 px-4 md:px-6 max-w-xl mx-auto flex items-center justify-between pt-safe">
        <div className="flex items-center gap-2.5">
          {showBack && (
            <button
              onClick={onBack}
              aria-label="Go back"
              className="w-9 h-9 -ml-1 flex items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <img
              src={ASSETS.logo}
              alt="GasFinder Logo"
              className="h-7 w-auto object-contain"
            />
            <span className="font-black text-[19px] sm:text-[20px] text-[#006c50] tracking-tight truncate max-w-[160px] sm:max-w-[240px]">
              {title}
            </span>
          </div>
        </div>

        {rightAction ? (
          rightAction
        ) : (
          <div className="flex items-center gap-2">
            {onOpenAiAssistant && (
              <button
                onClick={onOpenAiAssistant}
                aria-label="Open AI Assistant"
                className="flex items-center gap-1.5 bg-[#004D40] hover:bg-[#006c50] text-white text-[12px] font-extrabold px-3.5 py-1.5 rounded-full shadow-xs active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px] text-[#00E676]">
                  auto_awesome
                </span>
                <span>AI Guide</span>
              </button>
            )}
            <button
              onClick={onAvatarClick}
              aria-label="Open profile"
              className="w-9 h-9 rounded-full object-cover p-0.5 border-2 border-[#006c50]/30 hover:border-[#006c50] transition-all active:scale-95 focus:outline-none"
            >
              <img
                src={userAvatar}
                alt="User Profile"
                className="w-full h-full rounded-full object-cover"
              />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
