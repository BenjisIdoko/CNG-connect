import { describe, expect, it } from 'vitest';
import { QueueItem, isNewSince, rankQueue } from './adminQueue';

const item = (id: string, kind: QueueItem['kind'], createdAt: string | null): QueueItem => ({
  id,
  kind,
  title: id,
  detail: '',
  createdAt,
});

describe('rankQueue', () => {
  it('puts the oldest first, undated last, and breaks ties flagged before suggestion before pin', () => {
    const ranked = rankQueue([
      item('undated', 'flagged', null),
      item('new-pin', 'pin', '2026-11-18T10:00:00Z'),
      item('old-suggestion', 'suggestion', '2026-11-10T10:00:00Z'),
      item('tie-pin', 'pin', '2026-11-12T10:00:00Z'),
      item('tie-flag', 'flagged', '2026-11-12T10:00:00Z'),
      item('tie-suggestion', 'suggestion', '2026-11-12T10:00:00Z'),
    ]);
    expect(ranked.map((i) => i.id)).toEqual([
      'old-suggestion',
      'tie-flag',
      'tie-suggestion',
      'tie-pin',
      'new-pin',
      'undated',
    ]);
  });

  it('does not mutate its input', () => {
    const input = [item('b', 'pin', '2026-11-18T10:00:00Z'), item('a', 'flagged', '2026-11-01T10:00:00Z')];
    const copy = [...input];
    rankQueue(input);
    expect(input).toEqual(copy);
  });

  it('treats an unreadable date like no date', () => {
    const ranked = rankQueue([item('bad', 'flagged', 'not a date'), item('ok', 'pin', '2026-11-18T10:00:00Z')]);
    expect(ranked.map((i) => i.id)).toEqual(['ok', 'bad']);
  });

  it('returns an empty list for no items', () => {
    expect(rankQueue([])).toEqual([]);
  });
});

describe('isNewSince', () => {
  const lastVisit = Date.parse('2026-11-18T08:00:00Z');

  it('is false without a last visit, with no date, or with a bad date', () => {
    expect(isNewSince('2026-11-18T09:00:00Z', null)).toBe(false);
    expect(isNewSince(null, lastVisit)).toBe(false);
    expect(isNewSince('garbage', lastVisit)).toBe(false);
  });

  it('is false when the item is older than the last visit, or exactly at it', () => {
    expect(isNewSince('2026-11-18T07:59:59Z', lastVisit)).toBe(false);
    expect(isNewSince('2026-11-18T08:00:00Z', lastVisit)).toBe(false);
  });

  it('is true for an item created after the last visit', () => {
    expect(isNewSince('2026-11-18T08:00:01Z', lastVisit)).toBe(true);
  });
});
