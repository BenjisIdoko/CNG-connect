// Map-position input shared by the admin pin editor and the Add station form.

export type PinTier = 'source_exact' | 'rooftop' | 'street' | 'area' | 'city';

// Display order (best-guess tiers first), not accuracy order.
export const PIN_TIERS: PinTier[] = ['rooftop', 'street', 'area', 'source_exact', 'city'];

export const PIN_TIER_LABEL: Record<PinTier, string> = {
  source_exact: 'Source exact (±15m)',
  rooftop: 'Rooftop (±30m)',
  street: 'Street (±150m)',
  area: 'Area (±700m)',
  city: 'City centroid (±4km)',
};

export const NG_BOUNDS = { minLat: 4, maxLat: 14, minLng: 2.5, maxLng: 15 };

export function isInNigeria(lat: number, lng: number): boolean {
  return lat >= NG_BOUNDS.minLat && lat <= NG_BOUNDS.maxLat && lng >= NG_BOUNDS.minLng && lng <= NG_BOUNDS.maxLng;
}

/** Pulls lat,lng out of a pasted "9.07, 7.48", a Google Maps URL, or a place link. */
export function parseLatLng(raw: string): { lat: number; lng: number } | null {
  const s = raw.trim();
  const pats = [
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|center|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
  ];
  for (const p of pats) {
    const m = s.match(p);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (isInNigeria(lat, lng)) {
        return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
      }
      return null;
    }
  }
  return null;
}
