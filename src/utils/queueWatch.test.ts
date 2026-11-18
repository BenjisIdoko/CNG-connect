import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEFT_DISTANCE_METERS,
  WATCH_MAX_AGE_MINUTES,
  clearQueueWatchFor,
  rememberQueueReport,
  takeDueLeftPrompt,
} from './queueWatch';

const store: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  };
});

const T0 = 1_700_000_000_000;
const min = (n: number) => n * 60_000;

// One degree of latitude is about 111,195 m.
const STATION = { id: 's1', name: 'Test Station', lat: 9.0, lng: 7.4 };
const at = (metersNorth: number, accuracy?: number) => ({
  lat: STATION.lat + metersNorth / 111195,
  lng: STATION.lng,
  ...(accuracy === undefined ? {} : { accuracy }),
});

describe('queue watch constants', () => {
  it('asks when the driver is more than 250 m away, for up to 3 hours', () => {
    expect(LEFT_DISTANCE_METERS).toBe(250);
    expect(WATCH_MAX_AGE_MINUTES).toBe(180);
  });
});

describe('takeDueLeftPrompt', () => {
  it('still inside 250 m keeps the watch and returns null', () => {
    rememberQueueReport(STATION, T0);
    expect(takeDueLeftPrompt(at(100), T0 + min(10))).toBeNull();
    // ...and it is still there for when they do leave
    expect(takeDueLeftPrompt(at(400), T0 + min(20))?.stationId).toBe('s1');
  });

  it('a fix 251 m away returns the watch once, then null', () => {
    rememberQueueReport(STATION, T0);
    expect(takeDueLeftPrompt(at(251), T0 + min(10))).toEqual({
      stationId: 's1',
      name: 'Test Station',
      lat: 9.0,
      lng: 7.4,
      reportedAt: T0,
    });
    expect(takeDueLeftPrompt(at(400), T0 + min(11))).toBeNull();
  });

  it('a fix at 249 m is still at the station', () => {
    rememberQueueReport(STATION, T0);
    expect(takeDueLeftPrompt(at(249), T0 + min(10))).toBeNull();
  });

  it('a fix with accuracy 150 m returns null and keeps the watch', () => {
    rememberQueueReport(STATION, T0);
    expect(takeDueLeftPrompt(at(400, 150), T0 + min(10))).toBeNull();
    expect(takeDueLeftPrompt(at(400, 30), T0 + min(11))?.stationId).toBe('s1');
  });

  it('a watch older than 180 minutes returns null and is cleared', () => {
    rememberQueueReport(STATION, T0);
    expect(takeDueLeftPrompt(at(400), T0 + min(181))).toBeNull();
    expect(Object.keys(store)).toHaveLength(0);
    expect(takeDueLeftPrompt(at(400), T0 + min(182))).toBeNull();
  });

  it('at exactly 180 minutes it can still prompt', () => {
    rememberQueueReport(STATION, T0);
    expect(takeDueLeftPrompt(at(400), T0 + min(180))?.stationId).toBe('s1');
  });

  it('returns null when nothing was remembered, or the stored value is garbage', () => {
    expect(takeDueLeftPrompt(at(400), T0)).toBeNull();
    store['cng_queue_watch'] = '{not json';
    expect(takeDueLeftPrompt(at(400), T0)).toBeNull();
  });
});

describe('remembering and clearing', () => {
  it('a newer report at the same station replaces the watch', () => {
    rememberQueueReport(STATION, T0);
    rememberQueueReport(STATION, T0 + min(60));
    expect(takeDueLeftPrompt(at(400), T0 + min(70))?.reportedAt).toBe(T0 + min(60));
  });

  it('clearQueueWatchFor clears only that station', () => {
    rememberQueueReport(STATION, T0);
    clearQueueWatchFor('other');
    expect(takeDueLeftPrompt(at(400), T0 + min(10))?.stationId).toBe('s1');

    rememberQueueReport(STATION, T0);
    clearQueueWatchFor('s1');
    expect(takeDueLeftPrompt(at(400), T0 + min(10))).toBeNull();
  });

  it('unavailable storage never throws', () => {
    (globalThis as any).localStorage = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    expect(() => rememberQueueReport(STATION, T0)).not.toThrow();
    expect(() => clearQueueWatchFor('s1')).not.toThrow();
    expect(takeDueLeftPrompt(at(400), T0 + min(10))).toBeNull();
  });
});
