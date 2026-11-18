import React from 'react';
import { Fuel } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminSidebarLayout, AdminNavItem } from './AdminSidebarLayout';
import { MyStationsPanel } from './MyStationsPanel';
import { useAdminToast } from './useAdminToast';

const NAV: AdminNavItem[] = [{ key: 'mystations', label: 'My stations', icon: Fuel }];

/**
 * The station manager's own entrance (/station-manager): sign in, then see only the stations an
 * admin assigned to you. Who may change what is enforced by the database; this page just never
 * shows anything beyond "My stations".
 */
export const StationManagerEntrance: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { driverProfile, signOut } = useAuth();
  const { flash, toast } = useAdminToast();

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

      {toast}
    </AdminAuthGate>
  );
};
