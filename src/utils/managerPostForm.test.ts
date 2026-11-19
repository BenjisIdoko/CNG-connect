import { describe, expect, it } from 'vitest';
import { buildPostDetails } from './managerPostForm';

// 12:00 UTC is 13:00 in Lagos.
const NOW = Date.parse('2026-11-19T12:00:00Z');
const none = { reason: null, inHours: null, clock: '' } as const;

describe('buildPostDetails', () => {
  it('needs something chosen', () => {
    expect(buildPostDetails(none, NOW)).toEqual({ ok: false, error: 'Choose a reason or an expected time first' });
  });

  it('a reason alone is enough', () => {
    expect(buildPostDetails({ ...none, reason: 'power' }, NOW)).toEqual({ ok: true, details: { reason: 'power' } });
  });

  it('an hours chip becomes a time that many hours ahead', () => {
    expect(buildPostDetails({ ...none, inHours: 2 }, NOW)).toEqual({ ok: true, details: { untilIso: '2026-11-19T14:00:00.000Z' } });
  });

  it('a typed clock time is read on the Lagos clock', () => {
    expect(buildPostDetails({ reason: 'supply', inHours: null, clock: '14:00' }, NOW)).toEqual({
      ok: true,
      details: { reason: 'supply', untilIso: '2026-11-19T13:00:00.000Z' },
    });
  });

  it('a typed time wins over a chip', () => {
    const result = buildPostDetails({ ...none, inHours: 4, clock: '14:00' }, NOW);
    expect(result).toEqual({ ok: true, details: { untilIso: '2026-11-19T13:00:00.000Z' } });
  });

  it('a typed time that is not a clock time is an error, not silently dropped', () => {
    expect(buildPostDetails({ ...none, reason: 'fault', clock: '99:99' }, NOW)).toEqual({ ok: false, error: 'Enter the time like 14:00' });
  });

  describe('keeping the time the post already has', () => {
    const STORED = '2026-11-19T14:00:00.000Z'; // still ahead of NOW

    it('changing only the reason resends the stored expected time instead of wiping it', () => {
      expect(buildPostDetails({ ...none, reason: 'power' }, NOW, STORED)).toEqual({
        ok: true,
        details: { reason: 'power', untilIso: STORED },
      });
    });

    it('a stored time that has already passed is not resent', () => {
      expect(buildPostDetails({ ...none, reason: 'power' }, NOW, '2026-11-19T11:00:00.000Z')).toEqual({
        ok: true,
        details: { reason: 'power' },
      });
    });

    it('a chip or a typed time the manager picks replaces the stored one', () => {
      expect(buildPostDetails({ ...none, inHours: 1 }, NOW, STORED)).toEqual({ ok: true, details: { untilIso: '2026-11-19T13:00:00.000Z' } });
      expect(buildPostDetails({ ...none, reason: 'fault', clock: '15:00' }, NOW, STORED)).toEqual({
        ok: true,
        details: { reason: 'fault', untilIso: '2026-11-19T14:00:00.000Z' },
      });
    });

    it('with nothing newly chosen there is still nothing to save, even if a time is stored', () => {
      expect(buildPostDetails(none, NOW, STORED)).toEqual({ ok: false, error: 'Choose a reason or an expected time first' });
    });

    it('an unreadable stored time is ignored', () => {
      expect(buildPostDetails({ ...none, reason: 'power' }, NOW, 'soon')).toEqual({ ok: true, details: { reason: 'power' } });
    });
  });
});

