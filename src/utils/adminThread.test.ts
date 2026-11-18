import { describe, expect, it } from 'vitest';
import { buildThread, isThreadClosed, totalPending } from './adminThread';

describe('adminThread', () => {
  it('a closed thread has no segments and isThreadClosed is true', () => {
    const c = { flagged: 0, suggestion: 0, pin: 0 };
    expect(buildThread(c)).toEqual([]);
    expect(isThreadClosed(c)).toBe(true);
    expect(totalPending(c)).toBe(0);
  });

  it('notches equal counts when the total fits', () => {
    const segments = buildThread({ flagged: 3, suggestion: 2, pin: 1 });
    expect(segments).toEqual([
      { kind: 'flagged', count: 3, notches: 3 },
      { kind: 'suggestion', count: 2, notches: 2 },
      { kind: 'pin', count: 1, notches: 1 },
    ]);
    expect(isThreadClosed({ flagged: 3, suggestion: 2, pin: 1 })).toBe(false);
  });

  it('large counts scale down to at most 48 notches and keep a notch for every non-zero kind', () => {
    const segments = buildThread({ flagged: 500, suggestion: 3, pin: 1 });
    const total = segments.reduce((n, s) => n + s.notches, 0);
    expect(total).toBeLessThanOrEqual(48);
    expect(segments.every((s) => s.notches >= 1)).toBe(true);
    expect(segments[0].notches).toBeGreaterThan(segments[1].notches);
    expect(segments[0].count).toBe(500);
  });

  it('order is flagged, suggestion, pin and zero kinds are omitted', () => {
    const segments = buildThread({ flagged: 0, suggestion: 4, pin: 2 });
    expect(segments.map((s) => s.kind)).toEqual(['suggestion', 'pin']);
  });

  it('negative or NaN counts are treated as 0', () => {
    const c = { flagged: -5, suggestion: Number.NaN, pin: 2 };
    expect(totalPending(c)).toBe(2);
    expect(buildThread(c)).toEqual([{ kind: 'pin', count: 2, notches: 2 }]);
  });

  it('respects a custom maxNotches', () => {
    const segments = buildThread({ flagged: 30, suggestion: 30, pin: 30 }, 12);
    expect(segments.reduce((n, s) => n + s.notches, 0)).toBeLessThanOrEqual(12);
  });
});
