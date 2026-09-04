/**
 * Local station-status alerts.
 *
 * These are foreground/near-foreground notifications the app raises itself when a
 * report changes a station's status while a tab (or the installed PWA) is running.
 * There is no push subscription or server — true background Web Push would need
 * `pushManager.subscribe()` + VAPID + a backend. The service worker's
 * `notificationclick` handler (public/sw-custom.js) routes taps to the station.
 */
import { GasStation, StationStatus, UserProfile } from '../types';
import { checkNotificationPermission } from './permissionManager';
import { getDistanceInKm } from './proximityAlertEngine';

export type TransitionType = 'recovered' | 'depleted';

export interface PushNotificationResult {
  sent: boolean;
  reason?: string;
}

/**
 * Requests browser notification permission if available.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[PushAlerts] Web Notifications API not supported by browser.');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('[PushAlerts] Error requesting notification permission:', error);
    return 'denied';
  }
}

/**
 * Checks if browser push notifications are currently supported & granted.
 */
export function isPushNotificationGranted(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Detects if a station status change represents a recovery (back to Full Stock)
 * or a depletion (Out of Gas / Low Pressure).
 */
export function detectStatusTransition(
  oldStatus?: StationStatus,
  newStatus?: StationStatus
): TransitionType | null {
  if (!oldStatus || !newStatus || oldStatus === newStatus) {
    return null;
  }

  // Station recovered (became Full Stock / 'full')
  if (newStatus === 'full' && oldStatus !== 'full') {
    return 'recovered';
  }

  // Station depleted (became Out of Gas / 'out' or Low Pressure / 'low' from 'full' or 'queue')
  if (
    (newStatus === 'out' || newStatus === 'low') &&
    oldStatus !== 'out' &&
    oldStatus !== 'low'
  ) {
    return 'depleted';
  }

  return null;
}

/**
 * Evaluates whether a driver should be notified for a specific station status change based on:
 * 1. Favorite station list OR proximity (<= 15 km).
 * 2. Driver state scoping.
 */
export function checkShouldNotifyDriver(
  station: GasStation,
  userProfile: UserProfile,
  userCoords?: { lat: number; lng: number } | null,
  favoriteStationIds: string[] = []
): { notify: boolean; isFavorite: boolean; distanceKm?: number; reason?: string } {
  const isFavorite = favoriteStationIds.includes(station.id);

  // 1. State Scoping Check
  const stateCheck = checkNotificationPermission(userProfile.state, station.state);
  if (!stateCheck.allowed && !isFavorite) {
    return {
      notify: false,
      isFavorite,
      reason: stateCheck.reason || 'Station state does not match driver state.',
    };
  }

  // 2. Compute Proximity Distance
  let distanceKm: number | undefined;
  if (userCoords?.lat != null && userCoords?.lng != null && station.lat != null && station.lng != null) {
    distanceKm = getDistanceInKm(userCoords.lat, userCoords.lng, station.lat, station.lng);
  }

  const isNearby = distanceKm !== undefined && distanceKm <= 15.0;

  // Trigger push alert if station is a favorite OR within 15 km
  if (isFavorite || isNearby) {
    return {
      notify: true,
      isFavorite,
      distanceKm,
    };
  }

  return {
    notify: false,
    isFavorite,
    distanceKm,
    reason: `Station is neither in driver favorites nor within 15 km proximity (${distanceKm ? distanceKm.toFixed(1) : '?'} km).`,
  };
}

/**
 * Formats and dispatches a rich browser Push Notification alert for a station status transition.
 */
export function sendStationPushAlert(
  station: GasStation,
  transitionType: TransitionType,
  distanceKm?: number
): PushNotificationResult {
  if (!isPushNotificationGranted()) {
    return { sent: false, reason: 'Notification permission not granted by browser.' };
  }

  const distCopy = distanceKm !== undefined ? ` (${distanceKm.toFixed(1)} km away)` : '';
  const cityStateCopy = station.city ? `${station.city}, ${station.state}` : station.state;

  let title = '';
  let body = '';
  const icon = '/pwa-192x192.png';

  if (transitionType === 'recovered') {
    title = `🟢 Pump Online: ${station.name}`;
    body = `${station.name} in ${cityStateCopy} is back at Full Stock (220 bar)!${distCopy} Ready for fast refuelling.`;
  } else if (transitionType === 'depleted') {
    const statusText = station.status === 'out' ? 'Out of Gas' : 'Low Pressure';
    title = `🔴 Station Alert: ${station.name}`;
    body = `${station.name} in ${cityStateCopy} is now ${statusText}.${distCopy} Tap to check alternative stations nearby.`;
  }

  try {
    // If Service Worker is active, use showNotification for maximum background resilience
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        const swOptions: any = {
          body,
          icon,
          badge: '/pwa-192x192.png',
          vibrate: [200, 100, 200],
          tag: `station-status-${station.id}`,
          renotify: true,
          data: {
            stationId: station.id,
            url: `/?stationId=${station.id}`,
          },
        };
        reg.showNotification(title, swOptions);
      });
      return { sent: true };
    }

    // Fallback to standard Browser Notification constructor
    const notification = new Notification(title, {
      body,
      icon,
      badge: '/pwa-192x192.png',
      tag: `station-status-${station.id}`,
    });

    notification.onclick = () => {
      window.focus();
      // No SW controlling this page (rare): reload onto the deep link so the
      // ?stationId= handler in App picks it up.
      window.location.assign(`/?stationId=${station.id}`);
      notification.close();
    };

    return { sent: true };
  } catch (error: any) {
    console.error('[PushAlerts] Error dispatching push notification:', error);
    return { sent: false, reason: error?.message || 'Notification dispatch error' };
  }
}
