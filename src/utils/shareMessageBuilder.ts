import { GasStation } from '../types';

export function buildStationShareUrl(stationId: string): string {
  return `https://cng-connect.vercel.app?station=${encodeURIComponent(stationId)}`;
}

export function buildStationShareMessage(station: GasStation): string {
  const status = station.statusLabel || 'Unknown status';
  const latestReport = station.reports?.[0];
  const waitMinutes = latestReport?.waitMinutes;
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
  const message = buildStationShareMessage(station);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }
}
