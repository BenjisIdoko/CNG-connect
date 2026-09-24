/**
 * "Did you fill up?" follow-up. When a driver taps Directions we remember the
 * station; when they come back to the app a few minutes later we offer a one-tap
 * report. High-intent moments like this are what keep station data fresh.
 */
const PENDING_KEY = 'cng_followup_pending';
const SEEN_KEY = 'cng_followup_seen';

export const FOLLOW_UP_MIN_MINUTES = 4; // they need time to actually get there
export const FOLLOW_UP_MAX_MINUTES = 240; // after 4 h the moment has passed
export const FOLLOW_UP_COOLDOWN_HOURS = 6; // never nag about the same station twice in a row

type Pending = { id: string; name: string; ts: number };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function rememberFollowUp(station: { id: string; name: string }, now = Date.now()): void {
  write(PENDING_KEY, { id: station.id, name: station.name, ts: now } satisfies Pending);
}

/** Returns the station to ask about (once), or null if nothing is due. */
export function takeDueFollowUp(now = Date.now()): { id: string; name: string } | null {
  const pending = read<Pending | null>(PENDING_KEY, null);
  if (!pending) return null;

  const minutes = (now - pending.ts) / 60000;
  if (minutes < FOLLOW_UP_MIN_MINUTES) return null; // keep waiting
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
  if (minutes > FOLLOW_UP_MAX_MINUTES) return null;

  const seen = read<Record<string, number>>(SEEN_KEY, {});
  const last = seen[pending.id];
  if (last && now - last < FOLLOW_UP_COOLDOWN_HOURS * 3600_000) return null;

  seen[pending.id] = now;
  write(SEEN_KEY, seen);
  return { id: pending.id, name: pending.name };
}
