import { describe, expect, it } from 'vitest';
import { describeClosedHours } from './stationHours';

// Lagos (WAT) is UTC+1, so 12:00 Lagos is 11:00 UTC.
const wat = (hhmm: string) => Date.parse(`2026-11-19T${hhmm}:00+01:00`);
const day = { opensAt: '06:00:00', closesAt: '22:00:00' };
const night = { opensAt: '22:00:00', closesAt: '06:00:00' };

describe('describeClosedHours', () => {
  it('before opening, says when it opens today', () => {
    expect(describeClosedHours(day, wat('05:00'))).toBe('Closed · opens 6 am');
    expect(describeClosedHours(day, wat('00:00'))).toBe('Closed · opens 6 am');
  });

  it('while open, says nothing, including the minute it opens', () => {
    expect(describeClosedHours(day, wat('06:00'))).toBeNull();
    expect(describeClosedHours(day, wat('12:00'))).toBeNull();
    expect(describeClosedHours(day, wat('21:59'))).toBeNull();
  });

  it('from closing time, says it opens tomorrow', () => {
    expect(describeClosedHours(day, wat('22:00'))).toBe('Closed · opens tomorrow 6 am');
    expect(describeClosedHours(day, wat('23:30'))).toBe('Closed · opens tomorrow 6 am');
  });

  it('shows minutes only when they are not zero', () => {
    expect(describeClosedHours({ opensAt: '06:30:00', closesAt: '20:00:00' }, wat('05:00'))).toBe('Closed · opens 6:30 am');
  });

  it('handles hours that cross midnight', () => {
    expect(describeClosedHours(night, wat('23:00'))).toBeNull();
    expect(describeClosedHours(night, wat('03:00'))).toBeNull();
    expect(describeClosedHours(night, wat('22:00'))).toBeNull();
    expect(describeClosedHours(night, wat('12:00'))).toBe('Closed · opens 10 pm');
    expect(describeClosedHours(night, wat('06:00'))).toBe('Closed · opens 10 pm');
  });

  it('says nothing for 24-hour stations or unusable hours', () => {
    expect(describeClosedHours({ ...day, is24Hours: true }, wat('03:00'))).toBeNull();
    expect(describeClosedHours({ opensAt: null, closesAt: null }, wat('03:00'))).toBeNull();
    expect(describeClosedHours({ opensAt: '06:00:00', closesAt: null }, wat('03:00'))).toBeNull();
    expect(describeClosedHours({}, wat('03:00'))).toBeNull();
    expect(describeClosedHours({ opensAt: '06:00:00', closesAt: '06:00:00' }, wat('03:00'))).toBeNull();
    expect(describeClosedHours({ opensAt: 'abc', closesAt: '22:00:00' }, wat('03:00'))).toBeNull();
    expect(describeClosedHours({ opensAt: '25:00:00', closesAt: '22:00:00' }, wat('03:00'))).toBeNull();
  });

  it('reads the Lagos clock, not the UTC clock', () => {
    // 23:30 UTC is 00:30 in Lagos, before a 6 am opening.
    expect(describeClosedHours(day, Date.parse('2026-11-19T23:30:00Z'))).toBe('Closed · opens 6 am');
  });
});
