import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminSidebarLayout, AdminNavItem } from './AdminSidebarLayout';
import { MyStationsPanel } from './MyStationsPanel';

const NAV: AdminNavItem[] = [{ key: 'mystations', label: 'My stations', icon: 'local_gas_station' }];

/**
 * The station manager's own entrance (/station-manager): sign in, then see only the stations an
 * admin assigned to you. Who may change what is enforced by the database; this page just never
 * shows anything beyond "My stations".
 */
export const StationManagerEntrance: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { driverProfile, signOut } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  return (
    <AdminAuthGate title="Station manager" onExit={onExit}>
      <AdminSidebarLayout
        brand="CNG-Connect"
        navItems={NAV}
        activeKey="mystations"
        onSelect={() => undefined}
        userEmail={driverProfile.email}
        onSignOut={signOut}
        onExit={onExit}
      >
        <MyStationsPanel flash={flash} />
      </AdminSidebarLayout>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[210] bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </AdminAuthGate>
  );
};
