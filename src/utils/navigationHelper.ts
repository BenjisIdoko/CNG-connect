import { GasStation } from '../types';

/**
 * Returns a direct Google Maps location pin link.
 */
export function getGoogleMapsPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Returns turn-by-turn driving directions link (Google Maps / Apple Maps on iOS).
 */
export function getNavigationDirectionsUrl(lat: number, lng: number): string {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  return isIOS
    ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir//${lat},${lng}`;
}

/**
 * Directly opens external Google Maps (or Apple Maps on iOS) with driving directions to the station.
 */
export function openExternalMaps(station: GasStation): void {
  const lat = station.lat || 9.0765;
  const lng = station.lng || 7.4853;
  const mapsUrl = getNavigationDirectionsUrl(lat, lng);

  if (typeof window !== 'undefined') {
    window.open(mapsUrl, '_blank');
  }
}

/**
 * Directly opens Google Maps location pin for exact coordinates.
 */
export function openGoogleMapsPin(station: GasStation): void {
  const lat = station.lat || 9.101597;
  const lng = station.lng || 7.243265;
  const pinUrl = getGoogleMapsPinUrl(lat, lng);

  if (typeof window !== 'undefined') {
    window.open(pinUrl, '_blank');
  }
}
