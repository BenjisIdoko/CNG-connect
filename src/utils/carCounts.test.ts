import { describe, it, expect } from 'vitest';
import { carCountsToMap } from './carCounts';

describe('carCountsToMap', () => {
  it('maps rows to counts by station id', () => {
    expect(
      carCountsToMap([
        { station_id: 'a', cars: 2 },
        { station_id: 'b', cars: 1 },
      ]),
    ).toEqual({ a: 2, b: 1 });
  });

  it('ignores a row with no station id', () => {
    expect(carCountsToMap([{ cars: 2 }, { station_id: '', cars: 3 }, { station_id: 'a', cars: 1 }])).toEqual({ a: 1 });
  });

  it('ignores zero, negative, fractional and non-numeric counts', () => {
    expect(
      carCountsToMap([
        { station_id: 'zero', cars: 0 },
        { station_id: 'neg', cars: -1 },
        { station_id: 'frac', cars: 1.5 },
        { station_id: 'text', cars: '2' },
        { station_id: 'nan', cars: Number.NaN },
        { station_id: 'ok', cars: 4 },
      ]),
    ).toEqual({ ok: 4 });
  });

  it('returns an empty map for anything that is not a list of rows', () => {
    expect(carCountsToMap(null)).toEqual({});
    expect(carCountsToMap(undefined)).toEqual({});
    expect(carCountsToMap('rows')).toEqual({});
    expect(carCountsToMap({ station_id: 'a', cars: 1 })).toEqual({});
  });

  it('skips non-object entries without throwing', () => {
    expect(carCountsToMap([null, 5, 'x', { station_id: 'a', cars: 1 }])).toEqual({ a: 1 });
  });
});
