import React, { useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

/**
 * Dismissible "install this app" banner, pinned just above the bottom nav.
 * - Chrome / Edge / Android / desktop: a real Install button (native chooser).
 * - iOS Safari: expandable "Add to Home Screen" steps (no native prompt exists).
 * - Hidden entirely when already installed, dismissed recently, or not offerable.
 */
export const InstallPrompt: React.FC = () => {
  const { canInstall, isIosSafari, isStandalone, dismissedRecently, promptInstall, dismiss } =
    useInstallPrompt();
  const [iosStepsOpen, setIosStepsOpen] = useState(false);

  if (isStandalone || dismissedRecently) return null;
  if (!canInstall && !isIosSafari) return null;

  return (
    <div className="fixed inset-x-0 bottom-24 z-40 px-4 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto bg-white rounded-2xl border border-outline-variant shadow-[0_10px_30px_rgba(0,0,0,0.14)] p-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">install_mobile</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-on-surface leading-tight">Install CNG-Connect</p>
            <p className="text-caption text-on-surface-variant truncate">
              Full-screen, works offline.
            </p>
          </div>

          {canInstall ? (
            <button
              onClick={() => void promptInstall()}
              className="shrink-0 px-3 py-2 rounded-full bg-primary text-white text-caption font-bold active:scale-95 transition-transform"
            >
              Install
            </button>
          ) : (
            <button
              onClick={() => setIosStepsOpen((v) => !v)}
              className="shrink-0 px-3 py-2 rounded-full bg-primary text-white text-caption font-bold active:scale-95 transition-transform flex items-center gap-1"
            >
              <span>How</span>
              <span className="material-symbols-outlined text-[16px]">
                {iosStepsOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          )}

          <button
            onClick={dismiss}
            aria-label="Dismiss install banner"
            className="shrink-0 w-7 h-7 rounded-full text-outline hover:bg-surface-container flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {isIosSafari && iosStepsOpen && (
          <ol className="mt-2.5 pt-2.5 border-t border-outline-variant/50 text-caption text-on-surface-variant space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">ios_share</span>
              <span>
                Tap the <strong>Share</strong> button in Safari's toolbar.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">add_box</span>
              <span>
                Choose <strong>Add to Home Screen</strong>.
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
              <span>
                Tap <strong>Add</strong> — the CNG-Connect icon appears on your home screen.
              </span>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
};
