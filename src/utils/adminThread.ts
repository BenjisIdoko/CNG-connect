/**
 * The "security thread" on the admin Overview: one notch for each pending item (a flagged report,
 * a driver's station suggestion, a station pin that needs review). When nothing is pending the
 * thread is closed. These helpers turn the three counts into the notches to draw.
 */

export type ThreadKind = 'flagged' | 'suggestion' | 'pin';

export interface ThreadCounts {
  flagged: number;
  suggestion: number;
  pin: number;
}

export interface ThreadSegment {
  kind: ThreadKind;
  count: number;
  notches: number;
}

/** Notches drawn at most; more pending items than this share the notches in proportion. */
export const DEFAULT_MAX_NOTCHES = 48;

const ORDER: ThreadKind[] = ['flagged', 'suggestion', 'pin'];

const clean = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function totalPending(c: ThreadCounts): number {
  return clean(c.flagged) + clean(c.suggestion) + clean(c.pin);
}

export function isThreadClosed(c: ThreadCounts): boolean {
  return totalPending(c) === 0;
}

/**
 * Segments in a fixed order (flagged, suggestion, pin), omitting kinds with nothing pending. While the
 * total fits in `maxNotches` every item is its own notch. Beyond that each kind keeps at least one
 * notch and the rest are shared in proportion to the counts, so the total never exceeds `maxNotches`.
 */
export function buildThread(c: ThreadCounts, maxNotches: number = DEFAULT_MAX_NOTCHES): ThreadSegment[] {
  const present = ORDER.map((kind) => ({ kind, count: clean(c[kind]) })).filter((s) => s.count > 0);
  const total = present.reduce((n, s) => n + s.count, 0);
  if (total <= maxNotches) {
    return present.map((s) => ({ ...s, notches: s.count }));
  }
  const spare = Math.max(0, maxNotches - present.length);
  return present.map((s) => ({ ...s, notches: 1 + Math.floor((spare * s.count) / total) }));
}
