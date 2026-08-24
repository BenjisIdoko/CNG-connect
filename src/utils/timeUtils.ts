import { GasStation } from '../types';

/**
 * Returns concise, human-readable age copy for Nigerian drivers.
 * Rules:
 * 1. "No recent report" when status is unknown, statusLabel is "No recent reports", or lastUpdated is missing/stale ("Seeded from PCI").
 * 2. "Updated Just now" when lastUpdated is "Just now" or < 1 min.
 * 3. "Updated X min ago" / "Updated X hrs ago" when relative time is available.
 */
export function formatStationAge(station?: GasStation | null): string {
  if (!station) return 'No recent report';

  const { status, statusLabel, lastUpdated, reports } = station;

  if (status === 'unknown' || statusLabel === 'No recent reports') {
    return 'No recent report';
  }

  // Check top report timestamp if available
  const topReport = reports && reports.length > 0 ? reports[0] : null;
  const rawTime = (topReport?.timestamp || lastUpdated || '').trim();

  if (!rawTime || rawTime === 'Seeded from PCI' || rawTime === 'Unknown' || rawTime === 'No recent reports') {
    return 'No recent report';
  }

  const lower = rawTime.toLowerCase();

  if (lower === 'just now') {
    return 'Updated Just now';
  }

  if (lower.startsWith('updated ')) {
    return rawTime;
  }

  if (lower.includes('ago') || lower.includes('min') || lower.includes('hr')) {
    return `Updated ${rawTime}`;
  }

  // Try parsing ISO date or timestamp string
  const parsedDate = new Date(rawTime);
  if (!isNaN(parsedDate.getTime())) {
    const diffMs = Math.max(0, Date.now() - parsedDate.getTime());
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Updated Just now';
    if (diffMins < 60) return `Updated ${diffMins} min ago`;
    if (diffHours < 24) return `Updated ${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays >= 1) return 'No recent report';
  }

  return 'No recent report';
}
