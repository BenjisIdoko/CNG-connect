import { GasStation } from '../types';
import { describeManagerBadge, getManagerStatement } from './managerState';
import { describeStatus, getFreshness } from './stationFreshness';

/**
 * The one-line status for the nearest-station card, map pin labels and list sub-lines. It is
 * describeStatus ("Available · 5 min ago", "No report yet"), except that a station with no recent driver
 * report but a current post from its own staff says what the station says ("Station: closed · back ~2 pm")
 * instead of "No report yet".
 */
export function describeStatusOrStation(station: GasStation, now = Date.now()): string {
  if (getFreshness(station, now).tier === 'none') {
    const statement = getManagerStatement(station, now);
    if (statement) return describeManagerBadge(statement);
  }
  return describeStatus(station, now);
}
