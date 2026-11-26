import { haversineMeters } from './stationDuplicates';

/** A driver whose phone is this close to a station counts as a car there. */
export const PRESENCE_GEOFENCE_METERS = 1000;
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

/**
 * A report must come from someone near the station: within this many metres when the photo is taken (and
 * again when the report is submitted). 1 km is the same radius that counts a driver as present at a station,
 * and covers a queue along the road and drivers whose phone places them a few hundred metres off (300 m
 * turned drivers away at Bovas Chika while they were logged as present).
 */
export const REPORT_GEOFENCE_METERS = PRESENCE_GEOFENCE_METERS;

/**
 * How close a driver must be for the "you have arrived, report?" nudge to appear. "Arrived" means at the
 * station or in its queue, so this stays tighter than the reporting distance; it never shows where a report
 * would be refused.
 */
export const ARRIVAL_PROMPT_METERS = 300;

export type ReportPositionCheck = { allowed: true } | { allowed: false; reason: string };

/** Whether a GPS fix is good enough, and close enough, to let a driver report this station. */
export function checkReportPosition(
  position: PingPosition | null | undefined,
  station: { lat: number; lng: number },
): ReportPositionCheck {
  if (!position || !hasCoordinates(position)) return { allowed: false, reason: 'Turn on location to report.' };
  if (!isAccurateEnough(position)) {
    return { allowed: false, reason: "Your location isn't precise enough yet. Step into the open and try again." };
  }
  if (!hasCoordinates(station) || haversineMeters(position, station) > REPORT_GEOFENCE_METERS) {
    return {
      allowed: false,
      reason: `Reports unlock within ${REPORT_GEOFENCE_METERS / 1000} km of the station so every status comes from someone actually there.`,
    };
  }
  return { allowed: true };
}
