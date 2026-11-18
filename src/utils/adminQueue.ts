import type { ThreadKind } from './adminThread';

/** One thing waiting for the admin on the Overview: a flagged report, a suggestion or a pin review. */
export interface QueueItem {
  id: string;
  kind: ThreadKind;
  title: string;
  detail: string;
  /** ISO time the item was created or flagged; null when unknown. */
  createdAt: string | null;
}

const KIND_ORDER: Record<ThreadKind, number> = { flagged: 0, suggestion: 1, pin: 2 };

const timeOf = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

/**
 * The work queue order: oldest first, so nothing waits forever; undated items last; ties broken
 * flagged, then suggestion, then pin. Returns a new array and leaves the input alone.
 */
export function rankQueue(items: QueueItem[]): QueueItem[] {
  return items
    .map((item, index) => ({ item, index, time: timeOf(item.createdAt) }))
    .sort((a, b) => {
      if (a.time === null && b.time !== null) return 1;
      if (a.time !== null && b.time === null) return -1;
      if (a.time !== null && b.time !== null && a.time !== b.time) return a.time - b.time;
      const kind = KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind];
      return kind !== 0 ? kind : a.index - b.index;
    })
    .map((x) => x.item);
}

/** True when the item appeared after the admin's last visit (both times must be readable). */
export function isNewSince(createdAt: string | null, lastVisitMs: number | null): boolean {
  const t = timeOf(createdAt);
  return t !== null && lastVisitMs !== null && Number.isFinite(lastVisitMs) && t > lastVisitMs;
}
