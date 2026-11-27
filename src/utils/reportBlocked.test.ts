import { describe, expect, it } from 'vitest';
import { reportBlockedProps } from './reportBlocked';

const station = { id: 'pci-station-81', lat: 9.0, lng: 7.4 };
// One degree of latitude is about 111,195 m.
const metersNorthOf = (m: number) => ({ lat: station.lat + m / 111195, lng: station.lng });

describe('reportBlockedProps (what the app records when it refuses a report, so a complaint can be answered from the data)', () => {
  it('records the station, where in the flow it was refused, why, and the distance rounded to 50 m', () => {
    const position = { ...metersNorthOf(1337), accuracy: 18 };
    expect(reportBlockedProps('submit', { allowed: false, reason: 'x', code: 'too_far' }, position, station)).toEqual({
      station_id: 'pci-station-81',
      stage: 'submit',
      reason: 'too_far',
      distance_m: 1350,
      accuracy_m: 20,
    });
  });

  it('leaves the distance out when there is no fix, and the accuracy out when the fix has none', () => {
    expect(reportBlockedProps('banner', { allowed: false, reason: 'x', code: 'no_location' }, null, station)).toEqual({
      station_id: 'pci-station-81',
      stage: 'banner',
      reason: 'no_location',
    });
    expect(
      reportBlockedProps('camera', { allowed: false, reason: 'x', code: 'too_far' }, metersNorthOf(2000), station),
    ).toEqual({ station_id: 'pci-station-81', stage: 'camera', reason: 'too_far', distance_m: 2000 });
  });

  it('never records coordinates, the position itself or the driver', () => {
    const props = reportBlockedProps('photo', { allowed: false, reason: 'x', code: 'low_accuracy' }, { ...metersNorthOf(40), accuracy: 240 }, station);
    expect(Object.keys(props).sort()).toEqual(['accuracy_m', 'distance_m', 'reason', 'stage', 'station_id']);
    expect(props.accuracy_m).toBe(240);
    expect(props.distance_m).toBe(50);
  });

  it('leaves the distance out when the station has no map position', () => {
    const props = reportBlockedProps(
      'banner',
      { allowed: false, reason: 'x', code: 'station_has_no_position' },
      metersNorthOf(10),
      { id: 's', lat: Number.NaN, lng: Number.NaN },
    );
    expect(props).not.toHaveProperty('distance_m');
  });

  it('takes a proof problem (the photo, not the live fix, was the issue) as its own reason', () => {
    expect(
      reportBlockedProps('submit', { allowed: false, reason: 'The photo was taken too far from the station.', code: 'photo_too_far' }, metersNorthOf(100), station).reason,
    ).toBe('photo_too_far');
  });
});
