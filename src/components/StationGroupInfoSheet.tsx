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
      <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-[#dbe5de] flex flex-col gap-4 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c50] text-[22px]">
              info
            </span>
            <h2 className="text-[16px] font-extrabold text-[#141d19]">
              Station Group Policy
            </h2>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Canonical 1-Sentence Explainer */}
        <div className="bg-[#f2fcf5] border border-emerald-200 rounded-2xl p-4">
          <p className="text-[13.5px] font-semibold text-[#004D40] leading-relaxed">
            Reports and availability chat only happen in a station's group.
          </p>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={handleDismiss}
          className="w-full py-3 bg-[#004D40] hover:bg-[#006c50] text-white font-extrabold text-[14px] rounded-full shadow-md active:scale-95 transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
