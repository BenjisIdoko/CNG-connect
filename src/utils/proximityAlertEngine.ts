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

export function normalizeStateName(s?: string): string {
  if (!s) return '';
  const lower = s.toLowerCase().trim();
  if (lower.includes('abuja') || lower.includes('fct')) return 'abuja';
  if (lower.includes('lagos')) return 'lagos';
  if (lower.includes('edo') || lower.includes('benin')) return 'edo';
  if (lower.includes('oyo') || lower.includes('ibadan')) return 'oyo';
  if (lower.includes('rivers') || lower.includes('ph') || lower.includes('port harcourt')) return 'rivers';
  if (lower.includes('kano')) return 'kano';
  if (lower.includes('ogun') || lower.includes('abeokuta')) return 'ogun';
  if (lower.includes('delta') || lower.includes('warri')) return 'delta';
  if (lower.includes('kaduna')) return 'kaduna';
  if (lower.includes('katsina')) return 'katsina';
  if (lower.includes('enugu')) return 'enugu';
  if (lower.includes('imo')) return 'imo';
  if (lower.includes('ondo')) return 'ondo';
  if (lower.includes('osun')) return 'osun';
  if (lower.includes('ekiti')) return 'ekiti';
  return lower.replace(/\s*(state|\(.*\))/gi, '').trim();
}

export function isSameState(stState?: string, uState?: string): boolean {
  if (!stState || !uState) return true;
  const normA = normalizeStateName(stState);
  const normB = normalizeStateName(uState);
  if (!normA || !normB) return true;
  if (normA === normB) return true;
  return normA.includes(normB) || normB.includes(normA);
}
