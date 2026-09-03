import React from 'react';
import { ASSETS } from '../data/mockData';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onAvatarClick?: () => void;
  onOpenAiAssistant?: () => void;
  onOpenRoiCalculator?: () => void;
  onTogglePushNotifications?: () => void;
  isPushGranted?: boolean;
  userAvatar?: string;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  onAvatarClick,
  onOpenAiAssistant,
  onOpenRoiCalculator,
  onTogglePushNotifications,
  isPushGranted = false,
  userAvatar = ASSETS.userAvatar,
  rightAction
}) => {
  return (
    <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl border-b border-outline-variant/80 shadow-[0_1px_6px_rgba(0,0,0,0.03)] lg:pl-64">
      <div className="h-16 px-4 md:px-8 max-w-7xl mx-auto flex items-center justify-between pt-safe">
        <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
          {showBack ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={onBack}
                aria-label="Go back"
                className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all shrink-0"
              >
                <span className="material-symbols-outlined text-[22px]">arrow_back</span>
              </button>
              <span className="font-extrabold text-title text-slate-900 tracking-tight truncate">
                {title}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={ASSETS.logo}
                alt="CNG-Connect Logo"
                className="h-7 w-auto object-contain shrink-0"
              />
              <span className="font-extrabold text-heading text-primary tracking-tight truncate max-w-[160px] sm:max-w-[240px]">
                {title || 'CNG-Connect'}
              </span>
            </div>
          )}
        </div>

        {rightAction ? (
          rightAction
        ) : (
          <div className="flex items-center gap-2">
            {onTogglePushNotifications && (
              <button
                onClick={onTogglePushNotifications}
                aria-label={isPushGranted ? 'Push Notifications Active' : 'Enable Push Notifications'}
                title={isPushGranted ? 'Push Notifications Active for Favorite & Nearby Stations' : 'Enable Web Push Notifications'}
                className={`w-10 h-10 rounded-full flex items-center justify-center border shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer ${
                  isPushGranted
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isPushGranted ? 'notifications_active' : 'notifications'}
                </span>
              </button>
            )}
            {onOpenAiAssistant && (
              <button
                onClick={onOpenAiAssistant}
                aria-label="Open AI Assistant"
                title="AI Assistant Guide"
                className="w-10 h-10 rounded-full bg-emerald-50 hover:bg-emerald-100 text-primary border border-emerald-200/80 flex items-center justify-center shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">
                  auto_awesome
                </span>
              </button>
            )}
            <button
              onClick={onAvatarClick}
              aria-label="Open profile"
              className="w-11 h-11 rounded-full object-cover p-0.5 border-2 border-primary/30 hover:border-primary transition-all active:scale-95 focus:outline-none cursor-pointer"
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
