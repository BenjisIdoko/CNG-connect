import { GasStation } from '../types';
import { track } from '../services/analytics';
import { describeStatus, getFreshness } from './stationFreshness';

// Share links point at whatever origin the app is actually served from
// (cngconnect.com.ng in prod, a preview URL, or localhost in dev). The
// literal fallback only applies where there's no `window` (tests, SSR).
const APP_ORIGIN =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://cngconnect.com.ng';

export function buildStationShareUrl(stationId: string): string {
  return `${APP_ORIGIN}?station=${encodeURIComponent(stationId)}`;
}

export function buildStationShareMessage(station: GasStation): string {
  // The station row's own status text ("Full stock") never ages, so a weeks-old report would be
  // shared as if it were live. Use the age-aware line ("Available · 5 min ago", "Last: ... 5 wks ago").
  const status = describeStatus(station);
  const freshness = getFreshness(station);
  const isCurrent = freshness.tier === 'fresh' || freshness.tier === 'recent';
  const latestReport = station.reports?.[0];
  // A wait time only means something while the report it came from is current.
  const waitMinutes = isCurrent ? latestReport?.waitMinutes : undefined;
  const shareUrl = buildStationShareUrl(station.id);

  const lines: string[] = [
    `⛽ *CNG Station Alert*`,
    `📍 *${station.name}* (${station.city})`,
    `📊 Status: *${status}*`,
  ];

  if (waitMinutes && waitMinutes > 0) {
    lines.push(`⏱️ Est. Wait: *${waitMinutes} mins*`);
  } else if (station.busyEstimate) {
    lines.push(`⏱️ Queue: *${station.busyEstimate}*`);
  }

  if (station.pumpPressure && station.pumpPressure > 0) {
    lines.push(`⚡ Pump Pressure: *${station.pumpPressure} bar*`);
  }

  lines.push(`\n📲 Check live driver updates on CNG-Connect:\n${shareUrl}`);

  return lines.join('\n');
}

export function openWhatsAppShare(station: GasStation): void {
  track('share_clicked', { station_id: station.id });
  const message = buildStationShareMessage(station);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }
}
