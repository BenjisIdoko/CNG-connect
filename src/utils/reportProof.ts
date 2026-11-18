import type { StationStatus } from '../types';
import { REPORT_GEOFENCE_METERS } from './geofencePresence';
import { haversineMeters } from './stationDuplicates';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Why this report cannot be posted, as a sentence for the driver, or null when it carries the proof
 * every report needs: a live photo plus the position it was taken at, within 150 m of the station.
 */
export function reportProofProblem(
  report: { photo?: string; photoLat?: number; photoLng?: number },
  station: { lat: number; lng: number },
): string | null {
  if (!report.photo) return 'Take a live photo at the station to post this report.';
  if (!finite(report.photoLat) || !finite(report.photoLng)) {
    return 'The photo needs your position at the station. Retake it.';
  }
  if (!finite(station.lat) || !finite(station.lng)) return 'The photo was taken too far from the station.';
  const away = haversineMeters({ lat: report.photoLat, lng: report.photoLng }, station);
  return away > REPORT_GEOFENCE_METERS ? 'The photo was taken too far from the station.' : null;
}

/** What to photograph for the chosen status. */
export function reportPhotoHint(status: StationStatus, isEv: boolean): string {
  if (isEv) {
    if (status === 'full') return 'Photograph the charger display';
    if (status === 'queue') return 'Photograph the busy ports';
    if (status === 'out') return "Photograph the charger showing it's out of service";
    return '';
  }
  if (status === 'full') return 'Photograph the pump meter';
  if (status === 'queue') return 'Photograph the queue';
  if (status === 'out') return "Photograph the pump showing it's out";
  return '';
}
