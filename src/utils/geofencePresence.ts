import { haversineMeters } from './stationDuplicates';

/** A driver whose phone is this close to a station counts as a car there. */
export const PRESENCE_GEOFENCE_METERS = 250;
/** While inside, the app tells the database again at most this often, per station. */
export const PRESENCE_PING_INTERVAL_MS = 120_000;
/** A presence record lapses this long after the last ping, so leaving (or closing the app) drops out fast. */
export const PRESENCE_TTL_MINUTES = 6;
/** A GPS fix less accurate than this says nothing reliable about which station a driver is at. */
export const MAX_GPS_ACCURACY_METERS = 100;

/** At most this many overlapping stations are pinged for one GPS fix. */
const MAX_STATIONS_PER_FIX = 2;

export interface PingPosition {
  lat: number;
  lng: number;
  /** Radius in metres the browser reports for the fix; absent when unknown. */
  accuracy?: number;
}

const hasCoordinates = (p: { lat: number; lng: number }) => Number.isFinite(p.lat) && Number.isFinite(p.lng);
const isAccurateEnough = (p: PingPosition) => p.accuracy === undefined || p.accuracy <= MAX_GPS_ACCURACY_METERS;

/** True when the fix is trustworthy and inside the station's geofence. */
export function isAtStation(position: PingPosition, station: { lat: number; lng: number }): boolean {
  if (!hasCoordinates(position) || !hasCoordinates(station) || !isAccurateEnough(position)) return false;
  return haversineMeters(position, station) <= PRESENCE_GEOFENCE_METERS;
}

/**
 * The stations whose presence this GPS fix should refresh: inside the geofence, not pinged in the
 * last two minutes, nearest first, at most two.
 */
export function stationsToPing(
  position: PingPosition,
  stations: { id: string; lat: number; lng: number }[],
  lastPingAt: Record<string, number>,
  now = Date.now(),
): string[] {
  return stations
    .filter((s) => isAtStation(position, s))
    .filter((s) => now - (lastPingAt[s.id] ?? Number.NEGATIVE_INFINITY) >= PRESENCE_PING_INTERVAL_MS)
    .map((s) => ({ id: s.id, distance: haversineMeters(position, s) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_STATIONS_PER_FIX)
    .map((s) => s.id);
}
