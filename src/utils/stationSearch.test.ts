import { describe, expect, it } from 'vitest';
import { normalizeSearch, stationMatchesQuery, stationSearchScore } from './stationSearch';

const nnpcUshafa = { name: 'NNPC Ushafa', address: 'Ushafa Road, Bwari', city: 'Abuja', state: 'FCT', operator: 'NNPC' };
const nipcoLagos = { name: 'NIPCO Gas Limited', address: 'Ikorodu Road', city: 'Lagos', state: 'Lagos', operator: 'NIPCO' };
const ibadan = { name: 'Total CNG - Wuse 2', address: 'Ìbàdàn Expressway', city: 'Ibadan', state: 'Oyo' };

describe('stationSearch', () => {
  it('matches words spread across different fields', () => {
    expect(stationMatchesQuery(nnpcUshafa, 'nnpc abuja')).toBe(true);
    expect(stationMatchesQuery(nnpcUshafa, 'abuja nnpc')).toBe(true);
    expect(stationMatchesQuery(nipcoLagos, 'nnpc abuja')).toBe(false);
  });

  it('needs every word to match', () => {
    expect(stationMatchesQuery(nipcoLagos, 'nipco lagos')).toBe(true);
    expect(stationMatchesQuery(nipcoLagos, 'nipco abuja')).toBe(false);
  });

  it('ignores accents and punctuation', () => {
    expect(normalizeSearch('Ìbàdàn, Oyo!')).toBe('ibadan oyo');
    expect(stationMatchesQuery(ibadan, 'ibadan')).toBe(true);
    expect(stationMatchesQuery(ibadan, 'ÌBÀDÀN')).toBe(true);
  });

  it('ignores filler words like "cng station"', () => {
    expect(stationMatchesQuery(nipcoLagos, 'cng station lagos')).toBe(true);
    expect(stationMatchesQuery(nipcoLagos, 'cng')).toBe(true);
  });

  it('understands FCT and Abuja as the same place', () => {
    const bwari = { ...nnpcUshafa, city: 'Bwari' };
    expect(stationMatchesQuery(bwari, 'abuja')).toBe(true); // state is FCT
    expect(stationMatchesQuery({ ...bwari, state: 'Abuja' }, 'fct')).toBe(true);
    expect(stationMatchesQuery(nipcoLagos, 'abuja')).toBe(false);
  });

  it('short fragments only match the start of a word while typing', () => {
    expect(stationMatchesQuery(nnpcUshafa, 'ab')).toBe(true); // Abuja
    expect(stationMatchesQuery(nipcoLagos, 'ab')).toBe(false); // no word starts with "ab"
    expect(stationMatchesQuery(nnpcUshafa, 'sha')).toBe(false); // mid-word in Ushafa
    expect(stationMatchesQuery(nnpcUshafa, 'ushafa')).toBe(true);
  });

  it('empty query matches everything', () => {
    expect(stationMatchesQuery(nipcoLagos, '   ')).toBe(true);
  });

  it('ranks a name match above an address-only match', () => {
    const byName = stationSearchScore(nnpcUshafa, 'nnpc');
    const byAddressOnly = stationSearchScore({ ...nipcoLagos, address: 'Near NNPC depot', operator: undefined }, 'nnpc');
    expect(byName).toBeGreaterThan(byAddressOnly);
  });
});
