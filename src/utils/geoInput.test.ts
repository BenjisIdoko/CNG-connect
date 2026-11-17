import { describe, it, expect } from 'vitest';
import { isInNigeria, parseLatLng, PIN_TIERS, PIN_TIER_LABEL, NG_BOUNDS } from './geoInput';

describe('parseLatLng', () => {
  it('reads a pasted "lat, lng" pair', () => {
    expect(parseLatLng('9.07, 7.48')).toEqual({ lat: 9.07, lng: 7.48 });
  });

  it('reads the @lat,lng part of a Google Maps URL', () => {
    expect(parseLatLng('https://www.google.com/maps/place/NIPCO/@9.0765,7.3986,17z')).toEqual({ lat: 9.0765, lng: 7.3986 });
  });

  it('reads the !3d..!4d.. part of a Google place link', () => {
    expect(parseLatLng('https://www.google.com/maps/place/x/data=!3d9.0765!4d7.3986')).toEqual({ lat: 9.0765, lng: 7.3986 });
  });

  it('rounds to 6 decimals', () => {
    expect(parseLatLng('9.07654321, 7.39861234')).toEqual({ lat: 9.076543, lng: 7.398612 });
  });

  it('returns null for a point outside Nigeria', () => {
    expect(parseLatLng('0, 0')).toBeNull();
    expect(parseLatLng('48.8, 2.3')).toBeNull();
  });

  it('returns null when the text has no coordinates', () => {
    expect(parseLatLng('no coordinates here')).toBeNull();
    expect(parseLatLng('')).toBeNull();
    expect(parseLatLng('https://maps.app.goo.gl/abc123')).toBeNull();
  });
});

describe('isInNigeria', () => {
  it('is true on the edge of the box and false just outside it', () => {
    expect(isInNigeria(4, 2.5)).toBe(true);
    expect(isInNigeria(14, 15)).toBe(true);
    expect(isInNigeria(14.01, 7)).toBe(false);
    expect(isInNigeria(9, 15.01)).toBe(false);
    expect(isInNigeria(3.99, 7)).toBe(false);
  });

  it('is false for NaN', () => {
    expect(isInNigeria(Number.NaN, 7)).toBe(false);
  });
});

describe('pin tiers', () => {
  it('lists the five accuracy tiers in display order, each with a label', () => {
    expect(PIN_TIERS).toEqual(['rooftop', 'street', 'area', 'source_exact', 'city']);
    for (const t of PIN_TIERS) expect(PIN_TIER_LABEL[t]).toBeTruthy();
    expect(PIN_TIER_LABEL.rooftop).toBe('Rooftop (±30m)');
  });

  it('exposes the Nigeria box', () => {
    expect(NG_BOUNDS).toEqual({ minLat: 4, maxLat: 14, minLng: 2.5, maxLng: 15 });
  });
});
