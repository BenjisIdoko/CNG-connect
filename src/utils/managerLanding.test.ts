import { describe, expect, it } from 'vitest';
import { holdsAutoOpen, stationToOpenOnArrival } from './managerLanding';

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

  it('waits while something else needs the manager first, such as the set-password card, then opens', () => {
    expect(stationToOpenOnArrival([{ id: 'pci-station-65' }], false, true)).toBeNull();
    expect(stationToOpenOnArrival([{ id: 'pci-station-65' }], false, false)).toBe('pci-station-65');
  });
});

describe('holdsAutoOpen', () => {
  it('holds while the set-password card is pending', () => {
    expect(holdsAutoOpen({ promptPending: true, pageActive: true })).toBe(true);
  });

  it('holds while the manager is on another page, so the editor cannot open over "My profile"', () => {
    expect(holdsAutoOpen({ promptPending: false, pageActive: false })).toBe(true);
  });

  it('lets the editor open only on My stations with nothing pending', () => {
    expect(holdsAutoOpen({ promptPending: false, pageActive: true })).toBe(false);
  });
});
