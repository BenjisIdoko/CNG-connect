import React, { useCallback, useEffect, useState } from 'react';
import { Flag, LayoutDashboard, MapPinned, MapPinPlus, Phone, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminSidebarLayout, AdminNavItem } from './AdminSidebarLayout';
import { OverviewPanel } from './OverviewPanel';
import { StationsPanel } from './StationsPanel';
import { ReportsPanel } from './ReportsPanel';
import { UsersPanel } from './UsersPanel';
import { NotForYou } from './NotForYou';
import { SuggestionsPanel } from './SuggestionsPanel';
import { AirtimePayouts } from '../AirtimePayouts';
import { useAdminToast } from './useAdminToast';
import { AdminRoot } from './AdminRoot';
import { FEATURES } from '../../config/features';

const ADMIN_NAV: AdminNavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'stations', label: 'Stations', icon: MapPinned },
  { key: 'suggestions', label: 'Suggestions', icon: MapPinPlus },
  { key: 'reports', label: 'Report moderation', icon: Flag },
  { key: 'users', label: 'Users', icon: Users },
  ...(FEATURES.ENABLE_REFERRALS ? [{ key: 'payouts', label: 'Airtime payouts', icon: Phone }] : []),
];

/**
 * The super admin's dashboard (/admin): Stations, Suggestions, Report moderation and Users (where the admin
 * marks community managers). Only a profile with `is_admin` may use it; anyone else who signs in here is told
 * it is not for them. The database enforces every action as well, so this screen is the front door, not the lock.
 */
export const AdminScreen: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { driverProfile, isProfileLoaded, signOut } = useAuth();
  const supabase = useSupabaseClient();
  const isAdmin = Boolean(driverProfile.isAdmin);
  // How many driver suggestions are waiting; shown as a badge on the "Suggestions" tab.
  const [pendingSuggestions, setPendingSuggestions] = useState(0);
  // Flagged reports and pin reviews waiting, for the sidebar badges; recounted after every action.
  const [queueCounts, setQueueCounts] = useState<{ flagged: number; pin: number } | null>(null);
  const [recount, setRecount] = useState(0);
  const navItems = ADMIN_NAV.map((n) =>
    n.key === 'suggestions'
      ? { ...n, badge: pendingSuggestions }
      : n.key === 'reports'
        ? { ...n, badge: queueCounts?.flagged ?? 0 }
        : n.key === 'stations'
          ? { ...n, badge: queueCounts?.pin ?? 0 }
          : n,
  );

  const [activeKey, setActiveKey] = useState(navItems[0].key);

  // Load the pending count up front so the badge is right before the tab is opened.
  useEffect(() => {
    if (!isAdmin || !supabase) return;
    let cancelled = false;
    supabase
      .from('station_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => {
        if (!cancelled && count !== null) setPendingSuggestions(count);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, supabase]);
  const { flash: showToast, toast } = useAdminToast();
  // Every panel announces its actions through flash, so a flash is also the cue to recount the badges.
  // Kept stable (useCallback): some panels reload whenever the identity of `flash` changes.
  const flash = useCallback(
    (m: string) => {
      showToast(m);
      setRecount((n) => n + 1);
    },
    [showToast],
  );

  // Recount flagged reports and pin reviews on arrival and after every action.
  useEffect(() => {
    if (!isAdmin || !supabase) return;
    let cancelled = false;
    (async () => {
      const [flagged, pins] = await Promise.all([
        supabase.rpc('admin_moderation_queue', { p_view: 'review' }),
        supabase.from('stations').select('id', { count: 'exact', head: true }).eq('needs_pin_review', true),
      ]);
      if (cancelled || flagged.error || pins.error) return;
      setQueueCounts({ flagged: (flagged.data || []).length, pin: pins.count ?? 0 });
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, supabase, recount]);

  return (
    <AdminAuthGate title="CNG-Connect Admin" onExit={onExit}>
      {!isProfileLoaded ? (
        // The profile (and so `isAdmin`) is still being read: never show "no access" to an admin yet.
        <AdminRoot className="fixed inset-0 z-[200] grid place-items-center text-sm text-adm-mute-text">Loading…</AdminRoot>
      ) : !isAdmin ? (
        <NotForYou
          title="Admin only"
          message="This account is not an admin."
          linkLabel="Back to CNG-Connect"
          linkHref="/"
          onSignOut={signOut}
        />
      ) : (
      <AdminSidebarLayout
        brand="CNG-Connect"
        navItems={navItems}
        activeKey={activeKey}
        onSelect={setActiveKey}
        userEmail={driverProfile.email}
        onSignOut={signOut}
        onExit={onExit}
      >
        {isAdmin && activeKey === 'overview' && <OverviewPanel onNavigate={setActiveKey} />}
        {isAdmin && activeKey === 'stations' && <StationsPanel flash={flash} />}
        {isAdmin && activeKey === 'suggestions' && (
          <SuggestionsPanel flash={flash} onCountChange={setPendingSuggestions} />
        )}
        {isAdmin && activeKey === 'reports' && <ReportsPanel flash={flash} />}
        {isAdmin && activeKey === 'users' && <UsersPanel flash={flash} />}
        {FEATURES.ENABLE_REFERRALS && isAdmin && activeKey === 'payouts' && (
          <div className="h-full overflow-y-auto">
            <div className="max-w-2xl mx-auto p-4 pb-16">
              <AirtimePayouts supabase={supabase} flash={flash} />
            </div>
          </div>
        )}
      </AdminSidebarLayout>
      )}

      {toast}
    </AdminAuthGate>
  );
};
