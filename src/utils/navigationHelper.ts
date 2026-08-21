import { GasStation } from '../types';

/**
 * Directly opens external Google Maps (or Apple Maps on iOS) with driving directions to the station.
 */
export function openExternalMaps(station: GasStation): void {
  const lat = station.lat || 9.0765;
  const lng = station.lng || 7.4853;
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  const mapsUrl = isIOS
    ? `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  if (typeof window !== 'undefined') {
    window.open(mapsUrl, '_blank');
  }
}
