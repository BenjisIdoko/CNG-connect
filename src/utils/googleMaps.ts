/// <reference types="google.maps" />

/**
 * Loads the Google Maps JavaScript API once and resolves when `google.maps`
 * is ready. Used only by the admin pin editor (?admin=1) — the driver-facing
 * map stays on free Leaflet/OSM tiles.
 *
 * Needs VITE_GOOGLE_MAPS_API_KEY set, and "Maps JavaScript API" enabled on
 * that key in Google Cloud (the Places enrichment key works once you add it).
 */
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export const hasGoogleMapsKey = Boolean(API_KEY);

let loader: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!API_KEY) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set.'));
  if (typeof window !== 'undefined' && window.google?.maps) return Promise.resolve(window.google.maps);
  if (loader) return loader;

  loader = new Promise<typeof google.maps>((resolve, reject) => {
    const cbName = '__cngGmapsReady';
    (window as unknown as Record<string, unknown>)[cbName] = () => resolve(window.google.maps);
    const s = document.createElement('script');
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}` +
      `&callback=${cbName}&loading=async`;
    s.async = true;
    s.onerror = () => {
      loader = null;
      reject(new Error('Failed to load Google Maps. Check the API key and that "Maps JavaScript API" is enabled.'));
    };
    document.head.appendChild(s);
  });
  return loader;
}
