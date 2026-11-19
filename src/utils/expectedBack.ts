/**
 * "Expected back" choices on a manager's Closed / waiting post, turned into a timestamp the database
 * accepts: after now and at most 24 hours ahead. Clock times are read on the Lagos clock (WAT, UTC+1,
 * no daylight saving), so a manager's "2 pm" is 2 pm in Nigeria whatever the phone's time zone says.
 */
export type ExpectedBack = { inHours: 1 | 2 | 4 } | { clock: string };

const HOUR_MS = 3600000;
const DAY_MS = 24 * HOUR_MS;
const CLOCK = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function resolveExpectedBack(choice: ExpectedBack, now = Date.now()): string | null {
  if ('inHours' in choice) return new Date(now + choice.inHours * HOUR_MS).toISOString();

  const match = CLOCK.exec(choice.clock);
  if (!match) return null;
  const minutesIntoDay = Number(match[1]) * 60 + Number(match[2]);

  // Midnight (Lagos) of the Lagos date it is now, as UTC milliseconds.
  const lagosMidnight = Math.floor((now + HOUR_MS) / DAY_MS) * DAY_MS - HOUR_MS;
  let target = lagosMidnight + minutesIntoDay * 60000;
  if (target <= now) target += DAY_MS;
  return new Date(target).toISOString();
}
