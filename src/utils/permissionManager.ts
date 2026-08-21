import { getDistanceInKm } from './proximityAlertEngine';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Normalizes state names for accurate state-scoped matching.
 * e.g., 'Abuja FCT' -> 'abuja fct', 'FCT' -> 'abuja fct', 'Lagos State' -> 'lagos'
 */
export function normalizeStateName(stateStr?: string): string {
  if (!stateStr) return '';
  let cleaned = stateStr.trim().toLowerCase();
  
  // Clean up common suffix/prefix variations
  cleaned = cleaned.replace(/\bstate\b/g, '').trim();
  if (cleaned === 'fct' || cleaned === 'abuja') {
    return 'abuja fct';
  }
  return cleaned;
}

/**
 * PERMISSION CHECK 1: State-Scoped Broadcast Notifications
 * Push notifications are delivered ONLY when the recipient's registered/detected
 * state matches the station's state. Not nationwide, not proximity-gated.
 */
export function checkNotificationPermission(
  userState?: string,
  stationState?: string
): PermissionCheckResult {
  const normUser = normalizeStateName(userState || 'Abuja FCT');
  const normStation = normalizeStateName(stationState || 'Abuja FCT');

  if (normUser === normStation) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason: `Push notification blocked: Destination station state (${stationState}) does not match driver registered state (${userState || 'Unassigned'}). Notifications are scoped by state.`,
  };
}

/**
 * PERMISSION CHECK 2: Open Station Group Chat
 * Public discussion board per station — open to all signed-in users regardless of location.
 * No presence or proximity gating.
 */
export function checkChatPermission(isAuthenticated: boolean): PermissionCheckResult {
  if (isAuthenticated) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason: 'You must be signed in to view and post messages in the station group chat.',
  };
}

/**
 * PERMISSION CHECK 3: Presence-Gated Live Status Updates
 * Submitting structured status reports (Full Stock / Low Pressure / Queuing / Out of Gas)
 * or live camera updates requires active station_presence (user GPS within geofence radius).
 */
export function checkLiveUpdatePermission(
  isPresenceActive: boolean,
  userGps?: { lat: number; lng: number },
  stationLocation?: { lat: number; lng: number },
  maxGeofenceKm: number = 0.8
): PermissionCheckResult {
  // 1. Direct active presence flag check
  if (isPresenceActive) {
    return {
      allowed: true,
    };
  }

  // 2. Haversine GPS distance check if user and station coordinates are provided
  if (userGps?.lat != null && userGps?.lng != null && stationLocation?.lat != null && stationLocation?.lng != null) {
    const distanceKm = getDistanceInKm(
      userGps.lat,
      userGps.lng,
      stationLocation.lat,
      stationLocation.lng
    );

    if (distanceKm <= maxGeofenceKm) {
      return {
        allowed: true,
      };
    }
  }

  // Block submission with clear, unambiguous message
  return {
    allowed: false,
    reason: 'You need to be at the station to report its status.',
  };
}
