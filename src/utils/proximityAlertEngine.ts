/**
 * Proximity Alert & Geofence Engine
 * 
 * Rules:
 * (a) Staleness: Only show nudge if station's lastUpdated is older than ~30-45 minutes.
 * (b) Cooldown: Track per-station per-user cooldown in localStorage (2 hours).
 * (c) Geolocation: Calculate distance to stations using Haversine formula.
 */

export function isStationStale(lastUpdated?: string, thresholdMinutes: number = 30): boolean {
  if (!lastUpdated) return true;
  const str = lastUpdated.toLowerCase().trim();

  if (str === 'just now' || str === '1 min ago' || str === '2 min ago' || str === '3 min ago') {
    return false;
  }

  // Match X min ago or X mins ago
  const minMatch = str.match(/(\d+)\s*min/);
  if (minMatch) {
    const mins = parseInt(minMatch[1], 10);
    return mins >= thresholdMinutes;
  }

  // Match X hour(s) or X day(s)
  if (str.includes('hour') || str.includes('hr') || str.includes('day')) {
    return true;
  }

  return true;
}

export function isStationOnCooldown(
  userKey: string,
  stationId: string,
  cooldownHours: number = 2
): boolean {
  try {
    const key = `cng_nudge_cooldown_${userKey}_${stationId}`;
    const val = localStorage.getItem(key);
    if (!val) return false;

    const lastTimestamp = parseInt(val, 10);
    if (isNaN(lastTimestamp)) return false;

    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    return Date.now() - lastTimestamp < cooldownMs;
  } catch {
    return false;
  }
}

export function setStationCooldown(userKey: string, stationId: string): void {
  try {
    const key = `cng_nudge_cooldown_${userKey}_${stationId}`;
    localStorage.setItem(key, Date.now().toString());
  } catch (e) {
    console.error('Failed to set station nudge cooldown in localStorage', e);
  }
}

export function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
