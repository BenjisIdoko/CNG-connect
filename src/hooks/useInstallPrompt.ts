import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'cng_install_dismissed_at';
const DISMISS_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 14; // re-offer after 2 weeks

function readDismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function detectIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

export interface InstallPromptState {
  /** A native install prompt is available (Chrome / Edge / Android / desktop). */
  canInstall: boolean;
  /** iOS Safari — no native prompt; show manual "Add to Home Screen" steps. */
  isIosSafari: boolean;
  /** Already running as an installed app — nothing to offer. */
  isStandalone: boolean;
  /** User dismissed the banner within the cooldown window. */
  dismissedRecently: boolean;
  /** Fire the native chooser. Resolves to the user's choice. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  /** Remember the dismissal so the banner stays hidden for a while. */
  dismiss: () => void;
}

export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(detectStandalone);
  const [dismissedRecently, setDismissedRecently] = useState(readDismissedRecently);
  const isIosSafari = detectIosSafari();

  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault(); // stop Chrome's mini-infobar; we show our own UI
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);

    const mq = window.matchMedia?.('(display-mode: standalone)');
    const onMode = () => setIsStandalone(detectStandalone());
    mq?.addEventListener?.('change', onMode);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
      mq?.removeEventListener?.('change', onMode);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'dismissed') {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* storage unavailable */
      }
      setDismissedRecently(true);
    }
    return outcome;
  }, [deferred]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage unavailable */
    }
    setDismissedRecently(true);
  }, []);

  return {
    canInstall: Boolean(deferred),
    isIosSafari,
    isStandalone,
    dismissedRecently,
    promptInstall,
    dismiss,
  };
}
