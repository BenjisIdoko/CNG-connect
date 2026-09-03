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

export const MOCK_LEADERBOARD_DRIVERS: LeaderboardDriver[] = [
  {
    id: 'lb-1',
    rank: 1,
    name: 'Musa Abdullahi',
    state: 'Abuja FCT',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    points: 1840,
    reportsCount: 42,
    tier: DRIVER_TIERS[4], // Gas Finder Legend
    vehicle: 'Toyota Corolla 1.8L (Dual Fuel CNG)',
  },
  {
    id: 'lb-2',
    rank: 2,
    name: 'Emeka Okonkwo',
    state: 'Lagos',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    points: 1320,
    reportsCount: 31,
    tier: DRIVER_TIERS[3], // Station Scout
    vehicle: 'Hyundai Elantra (CNG Converted)',
  },
  {
    id: 'lb-3',
    rank: 3,
    name: 'Ibrahim Katsina',
    state: 'Kano',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    points: 980,
    reportsCount: 26,
    tier: DRIVER_TIERS[3], // Station Scout
    vehicle: 'Toyota Camry 2.4L (Pi-CNG Kit)',
  },
  {
    id: 'lb-4',
    rank: 4,
    name: 'Femi Adebayo',
    state: 'Ogun',
    avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    points: 620,
    reportsCount: 18,
    tier: DRIVER_TIERS[2], // Verified Reporter
    vehicle: 'Honda Accord 2.4L (Dual Fuel)',
  },
  {
    id: 'lb-5',
    rank: 5,
    name: 'Blessing Igbinovia',
    state: 'Edo',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    points: 450,
    reportsCount: 14,
    tier: DRIVER_TIERS[2], // Verified Reporter
    vehicle: 'Kia Rio 1.4L (Pi-CNG Grant)',
  },
];
