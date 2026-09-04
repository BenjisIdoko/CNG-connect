import { describe, it, expect } from 'vitest';
import { describeLocationPrecision } from './locationPrecision';

describe('describeLocationPrecision', () => {
  it('returns null for source_exact pins', () => {
    expect(describeLocationPrecision({ locationPrecision: 'source_exact' })).toBeNull();
  });

  it('returns null for community GPS-confirmed pins', () => {
    expect(describeLocationPrecision({ locationPrecision: 'gps_confirmed' })).toBeNull();
  });

  it('treats a missing precision as unverified, not exact (shows a caveat)', () => {
    expect(describeLocationPrecision({})).toBe('Approximate location');
  });

  it('formats sub-km radii in meters', () => {
    expect(describeLocationPrecision({ locationPrecision: 'rooftop', accuracyRadiusM: 30 })).toBe(
      'Approximate location (within 30m)'
    );
  });

  it('formats km-scale radii in kilometers', () => {
    expect(describeLocationPrecision({ locationPrecision: 'city', accuracyRadiusM: 4000 })).toBe(
      'Approximate — pinned to city center (within 4km)'
    );
  });

  it('keeps one decimal for non-round km radii', () => {
    expect(describeLocationPrecision({ locationPrecision: 'area', accuracyRadiusM: 1500 })).toBe(
      'Approximate location — nearby area (within 1.5km)'
    );
  });

  it('labels street-tier pins', () => {
    expect(describeLocationPrecision({ locationPrecision: 'street', accuracyRadiusM: 150 })).toBe(
      'Approximate location — nearest street (within 150m)'
    );
  });

  it('flags unlocated pins distinctly, ignoring any stale radius', () => {
    expect(describeLocationPrecision({ locationPrecision: 'unlocated', accuracyRadiusM: 15000 })).toBe(
      'Location unconfirmed — pin may be inaccurate'
    );
  });

  it('falls back gracefully for the legacy "geocoded" tier without a radius', () => {
    expect(describeLocationPrecision({ locationPrecision: 'geocoded' })).toBe('Approximate location');
  });
});
