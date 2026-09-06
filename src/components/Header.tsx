import React from 'react';
import { ASSETS } from '../data/mockData';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onOpenAiAssistant?: () => void;
  /** Replaces the default single action button when provided. */
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  onOpenAiAssistant,
  rightAction,
}) => {
  return (
    <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl border-b border-outline-variant/80 shadow-[0_1px_6px_rgba(0,0,0,0.03)] pt-safe lg:pl-64">
      <div className="h-14 px-4 md:px-8 max-w-7xl mx-auto flex items-center justify-between gap-3">
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
          <div className="flex items-center gap-2 min-w-0 flex-1 whitespace-nowrap">
            <img
              src={ASSETS.logo}
              alt="CNG-Connect Logo"
              className="h-6 w-auto object-contain shrink-0"
            />
            <span className="font-extrabold text-heading text-primary tracking-tight truncate">
              {title || 'CNG-Connect'}
            </span>
          </div>
        )}

        {rightAction ??
          (onOpenAiAssistant && (
            <button
              onClick={onOpenAiAssistant}
              aria-label="Open AI Assistant"
              title="AI Assistant Guide"
              className="w-10 h-10 rounded-full bg-emerald-50 hover:bg-emerald-100 text-primary border border-emerald-200/80 flex items-center justify-center shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">auto_awesome</span>
            </button>
          ))}
      </div>
    </header>
  );
};
