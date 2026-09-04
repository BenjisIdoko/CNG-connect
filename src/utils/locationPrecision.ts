import { GasStation } from '../types';

/**
 * Map-pin visual confidence bucket, derived from a station's precision tier.
 * Drives how the pin is drawn on the Leaflet map (solid vs. dashed/hollow)
 * and whether an accuracy-radius circle is worth showing at all.
 */
export type PinConfidence = 'confident' | 'moderate' | 'wide';

const MODERATE_TIERS = new Set(['street', 'area']);

export function getPinConfidence(
  precision: GasStation['locationPrecision'] | undefined
): PinConfidence {
  if (precision === 'source_exact' || precision === 'gps_confirmed' || precision === 'rooftop') {
    return 'confident';
  }
  if (precision && MODERATE_TIERS.has(precision)) {
    return 'moderate';
  }
  // 'city', 'unlocated', the legacy 'geocoded' tier, and unset all mean "we
  // genuinely don't know better than a wide area" — treat the same on the map.
  return 'wide';
}

/** Fallback uncertainty radius (meters) for stations missing accuracyRadiusM. */
export const DEFAULT_ACCURACY_RADIUS_M = 3000;

export function getAccuracyRadiusM(
  station: Pick<GasStation, 'locationPrecision' | 'accuracyRadiusM'>
): number {
  if (station.accuracyRadiusM && station.accuracyRadiusM > 0) return station.accuracyRadiusM;
  return getPinConfidence(station.locationPrecision) === 'confident' ? 30 : DEFAULT_ACCURACY_RADIUS_M;
}

/**
 * Human-readable caveat for a station's location pin, driven by the honest
 * precision tier the geocoding pass assigns (see scripts/geocode-stations.ts).
 * Returns null when the pin needs no caveat (source-exact or community
 * GPS-confirmed).
 */
export function describeLocationPrecision(
  station: Pick<GasStation, 'locationPrecision' | 'accuracyRadiusM' | 'needsPinReview'>
): string | null {
  const precision = station.locationPrecision;

  if (precision === 'source_exact' || precision === 'gps_confirmed') {
    return null;
  }

  const radius = formatRadius(station.accuracyRadiusM);

  switch (precision) {
    case 'rooftop':
      return `Approximate location${radius ? ` (within ${radius})` : ''}`;
    case 'street':
      return `Approximate location — nearest street${radius ? ` (within ${radius})` : ''}`;
    case 'area':
      return `Approximate location — nearby area${radius ? ` (within ${radius})` : ''}`;
    case 'city':
      return `Approximate — pinned to city center${radius ? ` (within ${radius})` : ''}`;
    case 'unlocated':
      return 'Location unconfirmed — pin may be inaccurate';
    case 'geocoded': // legacy tier from before the real geocoding pass
    default:
      return `Approximate location${radius ? ` (within ${radius})` : ''}`;
  }
}

function formatRadius(radiusM?: number): string | null {
  if (!radiusM || radiusM <= 0) return null;
  if (radiusM >= 1000) {
    const km = radiusM / 1000;
    return `${km % 1 === 0 ? km.toFixed(0) : km.toFixed(1)}km`;
  }
  return `${radiusM}m`;
}
