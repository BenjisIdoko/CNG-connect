import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminSidebarLayout, AdminNavItem } from './AdminSidebarLayout';
import { StationsPanel } from './StationsPanel';
import { ReportsPanel } from './ReportsPanel';
import { MyStationsPanel } from './MyStationsPanel';
import { AirtimePayouts } from '../AirtimePayouts';

const ADMIN_NAV: AdminNavItem[] = [
  { key: 'stations', label: 'Stations', icon: 'pin_drop' },
  { key: 'reports', label: 'Report moderation', icon: 'flag' },
  { key: 'payouts', label: 'Airtime payouts', icon: 'call' },
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
  const navItems = isAdmin ? ADMIN_NAV : MANAGER_NAV;

  const [activeKey, setActiveKey] = useState(navItems[0].key);
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
        {isAdmin && activeKey === 'reports' && <ReportsPanel flash={flash} />}
        {isAdmin && activeKey === 'payouts' && (
          <div className="h-full overflow-y-auto">
            <div className="max-w-2xl mx-auto p-4 pb-16">
              <AirtimePayouts supabase={supabase} flash={flash} />
            </div>
          </div>
        )}
        {!isAdmin && activeKey === 'mystations' && <MyStationsPanel flash={flash} />}
      </AdminSidebarLayout>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </AdminAuthGate>
  );
};
