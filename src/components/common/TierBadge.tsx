import React from 'react';
import { Icon } from './Icon';

// Tier badges are stored as emoji in reputationEngine (tests + data); the UI
// renders these glyph equivalents instead so they match the rest of the app.
const TIER_ICONS: Record<string, { name: string; color: string }> = {
  rookie: { name: 'military_tech', color: '#B4622D' },
  contributor: { name: 'military_tech', color: '#666F67' },
  verified_reporter: { name: 'military_tech', color: '#F5A623' },
  station_scout: { name: 'star', color: '#F5A623' },
  gas_finder_legend: { name: 'workspace_premium', color: '#E5A100' },
};

export const TierBadge: React.FC<{ tierId: string; size?: number }> = ({ tierId, size = 24 }) => {
  const entry = TIER_ICONS[tierId] ?? TIER_ICONS.rookie;
  return <Icon name={entry.name} size={size} fill style={{ color: entry.color }} />;
};
