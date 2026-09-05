export type DriverTierId =
  | 'rookie'
  | 'contributor'
  | 'verified_reporter'
  | 'station_scout'
  | 'gas_finder_legend';

export interface DriverTier {
  id: DriverTierId;
  title: string;
  badgeIcon: string;
  minPoints: number;
  maxPoints: number | null;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  perk: string;
}

export const DRIVER_TIERS: DriverTier[] = [
  {
    id: 'rookie',
    title: 'Rookie Driver',
    badgeIcon: '🥉',
    minPoints: 0,
    maxPoints: 99,
    badgeColor: 'text-amber-800',
    badgeBg: 'bg-amber-100',
    badgeBorder: 'border-amber-300',
    perk: 'Basic status reporting & community access',
  },
  {
    id: 'contributor',
    title: 'Active Contributor',
    badgeIcon: '🥈',
    minPoints: 100,
    maxPoints: 299,
    badgeColor: 'text-slate-800',
    badgeBg: 'bg-slate-100',
    badgeBorder: 'border-slate-300',
    perk: 'Unlocked custom driver profile badge',
  },
  {
    id: 'verified_reporter',
    title: 'Verified Reporter',
    badgeIcon: '🥇',
    minPoints: 300,
    maxPoints: 749,
    badgeColor: 'text-emerald-800',
    badgeBg: 'bg-emerald-100',
    badgeBorder: 'border-emerald-300',
    perk: '2x community vote weight & instant report verification',
  },
  {
    id: 'station_scout',
    title: 'Station Scout',
    badgeIcon: '🌟',
    minPoints: 750,
    maxPoints: 1499,
    badgeColor: 'text-sky-800',
    badgeBg: 'bg-sky-100',
    badgeBorder: 'border-sky-300',
    perk: 'Direct station coordinate editing & suggestion approval priority',
  },
  {
    id: 'gas_finder_legend',
    title: 'Gas Finder Legend',
    badgeIcon: '👑',
    minPoints: 1500,
    maxPoints: null,
    badgeColor: 'text-amber-900',
    badgeBg: 'bg-amber-100',
    badgeBorder: 'border-amber-400',
    perk: 'Legendary status badge & monthly fuel rebate drawing entry',
  },
];

export interface TierProgress {
  currentTier: DriverTier;
  nextTier: DriverTier | null;
  points: number;
  pointsInCurrentTier: number;
  pointsForNextTier: number;
  progressPercent: number;
}

/**
 * Calculates current tier, next tier, and percentage progress for a given points total.
 */
export function getDriverTier(points: number = 0): TierProgress {
  const safePoints = Math.max(0, points);

  let currentTier = DRIVER_TIERS[0];
  for (const tier of DRIVER_TIERS) {
    if (safePoints >= tier.minPoints) {
      currentTier = tier;
    }
  }

  const currentIndex = DRIVER_TIERS.findIndex((t) => t.id === currentTier.id);
  const nextTier = currentIndex < DRIVER_TIERS.length - 1 ? DRIVER_TIERS[currentIndex + 1] : null;

  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      points: safePoints,
      pointsInCurrentTier: safePoints - currentTier.minPoints,
      pointsForNextTier: 0,
      progressPercent: 100,
    };
  }

  const tierSpan = nextTier.minPoints - currentTier.minPoints;
  const pointsInTier = safePoints - currentTier.minPoints;
  const progressPercent = Math.min(100, Math.max(0, Math.round((pointsInTier / tierSpan) * 100)));

  return {
    currentTier,
    nextTier,
    points: safePoints,
    pointsInCurrentTier: pointsInTier,
    pointsForNextTier: nextTier.minPoints - safePoints,
    progressPercent,
  };
}

export interface LeaderboardDriver {
  id: string;
  rank: number;
  name: string;
  state: string;
  avatar: string;
  points: number;
  reportsCount: number;
  tier: DriverTier;
  vehicle: string;
}

export interface LeaderboardProfileRow {
  id: string;
  name?: string | null;
  state?: string | null;
  avatar?: string | null;
  community_points?: number | null;
  reports_count?: number | null;
  vehicle?: string | null;
}

/**
 * Builds the ranked leaderboard from real `profiles` rows (highest
 * community_points first). No seed/mock entries — an empty list means no
 * drivers have earned points yet.
 */
export function buildLeaderboard(rows: LeaderboardProfileRow[]): LeaderboardDriver[] {
  return [...rows]
    .filter((r) => (r.name || '').trim().length > 0)
    .sort((a, b) => (b.community_points || 0) - (a.community_points || 0))
    .map((r, i) => ({
      id: r.id,
      rank: i + 1,
      name: r.name || 'Driver',
      state: r.state || '',
      avatar: r.avatar || '',
      points: r.community_points || 0,
      reportsCount: r.reports_count || 0,
      tier: getDriverTier(r.community_points || 0).currentTier,
      vehicle: r.vehicle || '',
    }));
}
