import React from 'react';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  onShareApp?: () => void;
  /** Replaces the default single action button when provided. */
  rightAction?: React.ReactNode;
  /** Hide on phone widths (the map screen draws its own overlay header). */
  mobileHidden?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  onShareApp,
  rightAction,
  mobileHidden = false,
}) => {
  return (
    <header className={`${mobileHidden ? 'hidden lg:block ' : ''}fixed top-0 inset-x-0 lg:left-64 z-50 bg-white/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(31,41,35,0.06)] pt-safe`}>
      <div className="h-14 px-4 md:px-8 max-w-7xl mx-auto flex items-center justify-between gap-3">
        {showBack ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={onBack}
              aria-label="Go back"
              className="w-10 h-10 -ml-1 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container active:scale-95 transition-all shrink-0"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
            <span className="font-extrabold text-title text-slate-900 tracking-tight truncate">
              {title}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0 flex-1 whitespace-nowrap lg:invisible">
            <img
              src="/pwa-icon.svg"
              alt=""
              className="h-7 w-7 rounded-lg shrink-0"
            />
            <span className="font-headline font-extrabold text-heading text-primary tracking-tight truncate">
              {title || 'CNG-Connect'}
            </span>
          </div>
        )}

        {rightAction ??
          (onShareApp && (
            <button
              onClick={onShareApp}
              aria-label="Share the app with other drivers"
              title="Share the app"
              className="w-10 h-10 rounded-full bg-emerald-50 hover:bg-emerald-100 text-primary border border-emerald-200/80 flex items-center justify-center shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">share</span>
            </button>
          ))}
      </div>
    </header>
  );
};
