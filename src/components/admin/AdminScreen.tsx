import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminSidebarLayout, AdminNavItem } from './AdminSidebarLayout';
import { StationsPanel } from './StationsPanel';
import { ReportsPanel } from './ReportsPanel';
import { UsersPanel } from './UsersPanel';
import { MyStationsPanel } from './MyStationsPanel';
import { SuggestionsPanel } from './SuggestionsPanel';
import { AirtimePayouts } from '../AirtimePayouts';
import { FEATURES } from '../../config/features';

const ADMIN_NAV: AdminNavItem[] = [
  { key: 'stations', label: 'Stations', icon: 'pin_drop' },
  { key: 'suggestions', label: 'Suggestions', icon: 'add_location_alt' },
  { key: 'reports', label: 'Report moderation', icon: 'flag' },
  { key: 'users', label: 'Users', icon: 'groups' },
  // An admin who is also assigned to a station (they can assign themselves in the station editor)
  // posts its selling status and pressure here, the same page a station manager gets.
  { key: 'mystations', label: 'My stations', icon: 'local_gas_station' },
  ...(FEATURES.ENABLE_REFERRALS ? [{ key: 'payouts', label: 'Airtime payouts', icon: 'call' }] : []),
];
const MANAGER_NAV: AdminNavItem[] = [{ key: 'mystations', label: 'My stations', icon: 'local_gas_station' }];

/**
 * One dashboard for everyone with any admin-side access — previously three separate
 * hidden routes (?admin=1 pin editor, ?moderation=1 report queue + payouts, ?manager=1
 * station-manager editor), each with its own sign-in screen and full-screen layout.
 * A full admin (profiles.is_admin) gets Stations / Report moderation / Airtime payouts
 * in the sidebar; anyone else signed in gets just "My stations" — the same stations a
 * `station_managers` row assigns them, or an empty state if none.
 */
export const AdminScreen: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { driverProfile, signOut } = useAuth();
  const supabase = useSupabaseClient();
  const isAdmin = Boolean(driverProfile.isAdmin);
  // How many driver suggestions are waiting; shown as a badge on the "Suggestions" tab.
  const [pendingSuggestions, setPendingSuggestions] = useState(0);
  const navItems = isAdmin
    ? ADMIN_NAV.map((n) => (n.key === 'suggestions' ? { ...n, badge: pendingSuggestions } : n))
    : MANAGER_NAV;

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
  // The profile (and so `isAdmin`) can still be loading when this first renders; once it
  // settles, make sure the selected tab is one this driver actually has in their sidebar.
  useEffect(() => {
    if (!navItems.some((n) => n.key === activeKey)) setActiveKey(navItems[0].key);
  }, [isAdmin]);

  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  return (
    <AdminAuthGate title="CNG-Connect Admin" onExit={onExit}>
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
        {activeKey === 'mystations' && <MyStationsPanel flash={flash} />}
      </AdminSidebarLayout>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </AdminAuthGate>
  );
};
