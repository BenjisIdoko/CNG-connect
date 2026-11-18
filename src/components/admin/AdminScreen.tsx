import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminSidebarLayout, AdminNavItem } from './AdminSidebarLayout';
import { StationsPanel } from './StationsPanel';
import { ReportsPanel } from './ReportsPanel';
import { UsersPanel } from './UsersPanel';
import { NotForYou } from './NotForYou';
import { MANAGER_PATH } from '../../utils/adminRoutes';
import { SuggestionsPanel } from './SuggestionsPanel';
import { AirtimePayouts } from '../AirtimePayouts';
import { FEATURES } from '../../config/features';

const ADMIN_NAV: AdminNavItem[] = [
  { key: 'stations', label: 'Stations', icon: 'pin_drop' },
  { key: 'suggestions', label: 'Suggestions', icon: 'add_location_alt' },
  { key: 'reports', label: 'Report moderation', icon: 'flag' },
  { key: 'users', label: 'Users', icon: 'groups' },
  ...(FEATURES.ENABLE_REFERRALS ? [{ key: 'payouts', label: 'Airtime payouts', icon: 'call' }] : []),
];

/**
 * The super admin's dashboard (/admin): Stations, Suggestions, Report moderation, Users and the
 * Station managers list. Only a profile with `is_admin` may use it; anyone else who signs in here
 * (a station manager, say) is told it is not for them and pointed at /station-manager. The database
 * enforces every action as well, so this screen is the front door, not the lock.
 */
export const AdminScreen: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { driverProfile, isProfileLoaded, signOut } = useAuth();
  const supabase = useSupabaseClient();
  const isAdmin = Boolean(driverProfile.isAdmin);
  // How many driver suggestions are waiting; shown as a badge on the "Suggestions" tab.
  const [pendingSuggestions, setPendingSuggestions] = useState(0);
  const navItems = ADMIN_NAV.map((n) => (n.key === 'suggestions' ? { ...n, badge: pendingSuggestions } : n));

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
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  return (
    <AdminAuthGate title="CNG-Connect Admin" onExit={onExit}>
      {!isProfileLoaded ? (
        // The profile (and so `isAdmin`) is still being read: never show "no access" to an admin yet.
        <div data-theme="light" className="fixed inset-0 z-[200] grid place-items-center bg-white text-sm text-slate-500">
          Loading…
        </div>
      ) : !isAdmin ? (
        <NotForYou
          title="This page is for the app admin"
          message="You're signed in, but this dashboard is only for the app admin. If you manage a station, your page is the station manager page."
          linkLabel="Go to the station manager page"
          linkHref={MANAGER_PATH}
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

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </AdminAuthGate>
  );
};
