import { haversineMeters } from './stationDuplicates';
import { MAX_GPS_ACCURACY_METERS, type PingPosition } from './geofencePresence';

/**
 * "Is the queue still there?" When a driver reports Queuing we remember it on the phone. If their
 * app then sees them more than 250 m from that station (within 3 hours), it asks them once.
 * Everything here quietly does nothing when storage is unavailable.
 */
const WATCH_KEY = 'cng_queue_watch';

export const LEFT_DISTANCE_METERS = 250;
export const WATCH_MAX_AGE_MINUTES = 180;

export interface QueueWatch {
  stationId: string;
  name: string;
  lat: number;
  lng: number;
  reportedAt: number;
}

function read(): QueueWatch | null {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<QueueWatch> | null;
    if (
      !value ||
      typeof value.stationId !== 'string' ||
      typeof value.name !== 'string' ||
      !Number.isFinite(value.lat) ||
      !Number.isFinite(value.lng) ||
      !Number.isFinite(value.reportedAt)
    ) {
      return null;
    }
    return value as QueueWatch;
  } catch {
    return null;
  }
}

function drop(): void {
  try {
    localStorage.removeItem(WATCH_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Remembers the latest queue report; a newer one replaces the older. */
export function rememberQueueReport(
  station: { id: string; name: string; lat: number; lng: number },
  now = Date.now(),
): void {
  const watch: QueueWatch = { stationId: station.id, name: station.name, lat: station.lat, lng: station.lng, reportedAt: now };
  try {
    localStorage.setItem(WATCH_KEY, JSON.stringify(watch));
  } catch {
    /* storage unavailable */
  }
}

/** Forgets the watch when something newer at that station makes the question pointless. */
export function clearQueueWatchFor(stationId: string): void {
  const watch = read();
  if (watch && watch.stationId === stationId) drop();
}

/**
 * Returns the remembered queue report (and forgets it, so the question is asked once) when this
 * GPS fix shows the driver has left that station; null otherwise. A poor fix (accuracy over
 * 100 m) never decides anything. A watch older than 3 hours is dropped.
 */
export function takeDueLeftPrompt(position: PingPosition, now = Date.now()): QueueWatch | null {
  const watch = read();
  if (!watch) return null;

  if ((now - watch.reportedAt) / 60_000 > WATCH_MAX_AGE_MINUTES) {
    drop();
    return null;
  }

  if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) return null;
  if (position.accuracy !== undefined && position.accuracy > MAX_GPS_ACCURACY_METERS) return null;

  if (haversineMeters(position, watch) > LEFT_DISTANCE_METERS) {
    drop();
    return watch;
  }
  return null;
}
