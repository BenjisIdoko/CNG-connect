import { haversineMeters } from './stationDuplicates';
import type { PingPosition, ReportPositionCheck } from './geofencePresence';

/** Where in the reporting flow the driver was turned away. */
export type ReportBlockStage = 'banner' | 'camera' | 'photo' | 'submit';

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * What to record when a report is refused: which station, at which step, why, and roughly how far away the
 * phone was. The distance is rounded to 50 m and the GPS accuracy to 10 m; coordinates are never recorded.
 */
export function reportBlockedProps(
  stage: ReportBlockStage,
  check: Extract<ReportPositionCheck, { allowed: false }>,
  position: PingPosition | null | undefined,
  station: { id: string; lat: number; lng: number },
): Record<string, string | number> {
  const props: Record<string, string | number> = { station_id: station.id, stage, reason: check.code };
  const hasFix = !!position && Number.isFinite(position.lat) && Number.isFinite(position.lng);
  if (hasFix && Number.isFinite(station.lat) && Number.isFinite(station.lng)) {
    props.distance_m = roundTo(haversineMeters(position, station), 50);
  }
  if (hasFix && position.accuracy !== undefined && Number.isFinite(position.accuracy)) {
    props.accuracy_m = roundTo(position.accuracy, 10);
  }
  return props;
}
