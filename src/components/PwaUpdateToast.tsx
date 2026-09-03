import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, WifiOff, CheckCircle2, X } from 'lucide-react';

export const PwaUpdateToast: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [showOfflineNotice, setShowOfflineNotice] = useState<boolean>(!navigator.onLine);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates every 15 minutes
        setInterval(() => {
          r.update().catch(console.error);
        }, 15 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('[PWA] SW registration failed:', error);
    },
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowOfflineNotice(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setShowOfflineNotice(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const closeUpdateModal = () => {
    setNeedRefresh(false);
  };

  const closeOfflineReadyModal = () => {
    setOfflineReady(false);
  };

  return (
    <aside className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[120] flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {/* 1. App Update Banner */}
      {needRefresh && (
        <div className="pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-xl bg-[#004D40] text-white shadow-2xl border stroke-[#00FFC2]/30 border-[#00FFC2]/40 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#00FFC2]/20 text-[#00FFC2]">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">App Update Available</p>
              <p className="text-xs text-emerald-200">Reload to get the latest station reports & features.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-3 py-1.5 rounded-lg bg-[#00FFC2] hover:bg-[#00e6af] text-[#004D40] font-bold text-xs transition-colors shadow-sm cursor-pointer"
            >
              Reload
            </button>
            <button
              onClick={closeUpdateModal}
              aria-label="Dismiss app update notice"
              className="p-1 text-emerald-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Offline Ready Confirmation */}
      {offlineReady && !needRefresh && (
        <div className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-950/90 text-emerald-100 shadow-xl border border-emerald-500/30 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-xs font-medium">Map & station data cached for offline driving!</p>
          </div>
          <button
            onClick={closeOfflineReadyModal}
            aria-label="Dismiss offline ready confirmation"
            className="p-1 text-emerald-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Offline Mode Banner */}
      {isOffline && showOfflineNotice && !needRefresh && (
        <div className="pointer-events-auto flex items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-950/90 text-amber-100 shadow-xl border border-amber-500/30 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-200">You are offline</p>
              <p className="text-[11px] text-amber-300/90">Showing cached station map and data.</p>
            </div>
          </div>
          <button
            onClick={() => setShowOfflineNotice(false)}
            aria-label="Dismiss offline warning"
            className="p-1 text-amber-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
};
