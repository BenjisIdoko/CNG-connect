import { GasStation } from '../types';
import { formatClockMinutes } from './managerState';

type HoursSource = Pick<GasStation, 'opensAt' | 'closesAt' | 'is24Hours'>;

const DAY_MINUTES = 24 * 60;
const WAT_OFFSET_MS = 60 * 60000;
const DAY_MS = DAY_MINUTES * 60000;

/** "06:00:00" (or "06:00") to minutes after midnight, or null when it is not a time of day. */
function toMinutes(raw: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((raw || '').trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours > 23 || minutes > 59 ? null : hours * 60 + minutes;
}

/**
 * "Closed · opens 6 am" when the station's listed hours say it is shut right now, otherwise null.
 * Hours are read on the Lagos clock (WAT) and handle a closing time after midnight. A 24-hour station,
 * missing or unreadable times, or identical opening and closing times say nothing: this is a hint from
 * listed hours, so it only speaks when the hours are clear.
 */
export function describeClosedHours(station: HoursSource, now = Date.now()): string | null {
  if (station.is24Hours) return null;
  const opens = toMinutes(station.opensAt);
  const closes = toMinutes(station.closesAt);
  if (opens === null || closes === null || opens === closes) return null;

  const t = Math.floor(((now + WAT_OFFSET_MS) % DAY_MS) / 60000);
  const opensText = formatClockMinutes(opens);

  if (opens < closes) {
    if (t >= opens && t < closes) return null;
    return t < opens ? `Closed · opens ${opensText}` : `Closed · opens tomorrow ${opensText}`;
  }
  // Closes after midnight (for example 22:00 to 06:00): shut only between closing and opening.
  if (t >= opens || t < closes) return null;
  return `Closed · opens ${opensText}`;
}
