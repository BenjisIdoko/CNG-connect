import { getDistanceInKm } from './proximityAlertEngine';

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Normalizes state names for accurate state-scoped matching.
 * e.g., 'Abuja FCT' -> 'abuja fct', 'FCT' -> 'abuja fct', 'Lagos State' -> 'lagos'
 */
/**
 * Normalizes state names for accurate state-scoped matching.
 * e.g., 'Abuja FCT' -> 'abuja', 'FCT' -> 'abuja', 'Lagos State' -> 'lagos'
 */
export function normalizeStateName(stateStr?: string): string {
  if (!stateStr) return '';
  const lower = stateStr.toLowerCase().trim();
  if (lower.includes('abuja') || lower.includes('fct')) return 'abuja fct';
  if (lower.includes('lagos')) return 'lagos';
  if (lower.includes('edo') || lower.includes('benin')) return 'edo';
  if (lower.includes('oyo') || lower.includes('ibadan')) return 'oyo';
  if (lower.includes('rivers') || lower.includes('ph') || lower.includes('port harcourt')) return 'rivers';
  if (lower.includes('kano')) return 'kano';
  if (lower.includes('ogun') || lower.includes('abeokuta')) return 'ogun';
  if (lower.includes('delta') || lower.includes('warri')) return 'delta';
  if (lower.includes('kaduna')) return 'kaduna';
  if (lower.includes('katsina')) return 'katsina';
  if (lower.includes('enugu')) return 'enugu';
  if (lower.includes('imo')) return 'imo';
  if (lower.includes('ondo')) return 'ondo';
  if (lower.includes('osun')) return 'osun';
  if (lower.includes('ekiti')) return 'ekiti';
  return lower.replace(/\s*(state|\(.*\))/gi, '').trim();
}

/**
 * PERMISSION CHECK 1: State-Scoped Broadcast Notifications
 * Push notifications are delivered ONLY when the recipient's registered/detected
 * state matches the station's state. Not nationwide, not proximity-gated.
 * Fail-closed: blocks notification if userState or stationState is unassigned.
 */
export function checkNotificationPermission(
  userState?: string,
  stationState?: string
): PermissionCheckResult {
  if (!userState || !stationState) {
    return {
      allowed: false,
      reason: `Push notification blocked: Destination station state (${stationState || 'Unassigned'}) or user state (${userState || 'Unassigned'}) is missing. Notifications are scoped by state.`,
    };
  }

  const normUser = normalizeStateName(userState);
  const normStation = normalizeStateName(stationState);

  if (normUser && normStation && (normUser === normStation || normUser.includes(normStation) || normStation.includes(normUser))) {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason: `Push notification blocked: Destination station state (${stationState}) does not match driver registered state (${userState}). Notifications are scoped by state.`,
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
