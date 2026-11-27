import type { StationStatus } from '../types';
import { REPORT_GEOFENCE_METERS, type ReportBlockCode } from './geofencePresence';
import { haversineMeters } from './stationDuplicates';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

type ProofCode = Extract<ReportBlockCode, 'no_photo' | 'photo_no_position' | 'photo_too_far'>;

const PROOF_PROBLEMS: Record<ProofCode, string> = {
  no_photo: 'Take a live photo at the station to post this report.',
  photo_no_position: 'The photo needs your position at the station. Retake it.',
  photo_too_far: 'The photo was taken too far from the station.',
};

/**
 * Why this report cannot be posted, as a stable name for logs, or null when it carries the proof every report
 * needs: a live photo plus the position it was taken at, within the reporting distance of the station
 * (REPORT_GEOFENCE_METERS).
 */
export function reportProofCode(
  report: { photo?: string; photoLat?: number; photoLng?: number },
  station: { lat: number; lng: number },
): ProofCode | null {
  if (!report.photo) return 'no_photo';
  if (!finite(report.photoLat) || !finite(report.photoLng)) return 'photo_no_position';
  if (!finite(station.lat) || !finite(station.lng)) return 'photo_too_far';
  const away = haversineMeters({ lat: report.photoLat, lng: report.photoLng }, station);
  return away > REPORT_GEOFENCE_METERS ? 'photo_too_far' : null;
}

/** The same refusal as a sentence for the driver, or null when the report carries the proof. */
export function reportProofProblem(
  report: { photo?: string; photoLat?: number; photoLng?: number },
  station: { lat: number; lng: number },
): string | null {
  const code = reportProofCode(report, station);
  return code ? PROOF_PROBLEMS[code] : null;
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
