import React from 'react';

interface StationGroupInfoSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StationGroupInfoSheet: React.FC<StationGroupInfoSheetProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem('hasSeenGroupPolicy', 'true');
    } catch {
      // localStorage fallback
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 font-['Plus_Jakarta_Sans',sans-serif] animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-outline-variant flex flex-col gap-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">
              info
            </span>
            <h2 className="text-[16px] font-bold text-on-surface">
              Station Group Policy
            </h2>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Close"
            className="w-11 h-11 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-all active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Canonical 1-Sentence Explainer */}
        <div className="bg-surface border border-outline-variant rounded-2xl p-4">
          <p className="text-[13.5px] font-medium text-primary leading-relaxed">
            Reports and availability chat only happen in a station's group.
          </p>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={handleDismiss}
          className="w-full py-3 min-h-[44px] bg-primary hover:opacity-95 text-on-primary font-bold text-[14px] rounded-full shadow-md active:scale-95 transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
