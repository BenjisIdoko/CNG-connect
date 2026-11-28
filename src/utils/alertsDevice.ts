import { parseIosVersion, type AlertsDevice } from './alertsCard';

/** What this phone or browser is, for the Alerts card. Reads the browser; call it at render time. */
export function detectAlertsDevice(): AlertsDevice {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { platform: 'other', iosVersion: null, isStandalone: false, canPush: false };
  }
  const ua = navigator.userAgent || '';
  // An iPad can report itself as a Mac with a touch screen.
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return {
    platform: isIos ? 'ios' : isAndroid ? 'android' : 'other',
    iosVersion: isIos ? parseIosVersion(ua) : null,
    isStandalone,
    canPush: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window,
  };
}

/** The browser's notification permission; 'default' (not asked yet) when the browser has no Notification. */
export function readNotificationPermission(): 'default' | 'granted' | 'denied' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'default';
  return window.Notification.permission;
}
