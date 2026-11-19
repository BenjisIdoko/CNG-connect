import { describe, expect, it } from 'vitest';
import { stationToOpenOnArrival } from './managerLanding';

describe('stationToOpenOnArrival', () => {
  it('opens the one station a manager has', () => {
    expect(stationToOpenOnArrival([{ id: 'pci-station-65' }], false)).toBe('pci-station-65');
  });

  it('opens nothing for no stations or for several (they pick from the list)', () => {
    expect(stationToOpenOnArrival([], false)).toBeNull();
    expect(stationToOpenOnArrival([{ id: 'a' }, { id: 'b' }], false)).toBeNull();
  });

  it('opens nothing again once it has already opened, so closing the editor sticks', () => {
    expect(stationToOpenOnArrival([{ id: 'pci-station-65' }], true)).toBeNull();
  });
});
