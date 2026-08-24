import React from 'react';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'search_off',
  title,
  message,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-3xl p-6 text-center border border-slate-200/80 shadow-xs flex flex-col items-center gap-2 my-2 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-primary flex items-center justify-center font-bold">
        <span className="material-symbols-outlined text-[28px]">{icon}</span>
      </div>
      <h4 className="font-extrabold text-slate-900 text-body-lg">{title}</h4>
      <p className="text-caption text-slate-500 font-normal max-w-xs">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 px-5 py-2.5 bg-primary hover:bg-deep-teal text-white text-caption font-bold rounded-full shadow-md active:scale-95 transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
