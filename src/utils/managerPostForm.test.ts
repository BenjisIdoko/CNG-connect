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
});
