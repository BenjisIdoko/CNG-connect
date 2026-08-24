import { GasStation } from '../types';

export function buildStationShareUrl(stationId: string): string {
  return `https://cng-connect.vercel.app?station=${encodeURIComponent(stationId)}`;
}

export function buildStationShareMessage(station: GasStation): string {
  const status = station.statusLabel || 'Unknown status';
  const latestReport = station.reports?.[0];
  const waitMinutes = latestReport?.waitMinutes;

  const waitPart = waitMinutes && waitMinutes > 0 ? `, ${waitMinutes}min wait` : '';
  const pressurePart = station.pumpPressure && station.pumpPressure > 0 ? `, ${station.pumpPressure} bar` : '';
  const shareUrl = buildStationShareUrl(station.id);

  return `⛽ ${station.name} (${station.city}) — ${status}${waitPart}${pressurePart} via CNG-Connect. Check live status: ${shareUrl}`;
}

export function openWhatsAppShare(station: GasStation): void {
  const message = buildStationShareMessage(station);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  if (typeof window !== 'undefined') {
    window.open(waUrl, '_blank');
  }
}
