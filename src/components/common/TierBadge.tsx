import React from 'react';
import { Crown, Medal, Star } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

// Tier badges are stored as emoji in reputationEngine (tests + data); the UI
// renders these vector equivalents instead so they match the rest of the app.
const TIER_ICONS: Record<string, { Icon: Icon; color: string }> = {
  rookie: { Icon: Medal, color: '#B4622D' },
  contributor: { Icon: Medal, color: '#8B9389' },
  verified_reporter: { Icon: Medal, color: '#F5A623' },
  station_scout: { Icon: Star, color: '#F5A623' },
  gas_finder_legend: { Icon: Crown, color: '#E5A100' },
};

export const TierBadge: React.FC<{ tierId: string; size?: number }> = ({ tierId, size = 24 }) => {
  const entry = TIER_ICONS[tierId] ?? TIER_ICONS.rookie;
  return <entry.Icon size={size} weight="fill" color={entry.color} aria-hidden />;
};
