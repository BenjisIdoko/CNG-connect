import React, { useEffect, useState } from 'react';
import { Fuel, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminSidebarLayout, AdminNavItem } from './AdminSidebarLayout';
import { MyStationsPanel } from './MyStationsPanel';
import { useAdminToast } from './useAdminToast';
import { claimManagerInvites } from '../../services/managerAccessService';
import { SetPasswordCard } from './SetPasswordCard';
import { ManagerProfilePanel } from './ManagerProfilePanel';
import { clearSetPasswordPrompt, shouldPromptSetPassword } from '../../utils/passwordPrompt';
import type { RpcClient } from '../../services/stationManagerService';

const NAV: AdminNavItem[] = [
  { key: 'mystations', label: 'My stations', icon: Fuel },
  { key: 'profile', label: 'My profile', icon: UserRound },
];

/**
 * Shown once a manager is signed in: first it turns any invite for their verified email into station
 * assignments, then it lists their stations. A failed check is announced but does not block the list.
 */
const ManagerBody: React.FC<{ flash: (m: string) => void; active: boolean }> = ({ flash, active }) => {
  const supabase = useSupabaseClient();
  const { updatePassword } = useAuth();
  const [checked, setChecked] = useState(false);
  // Right after an emailed-code sign-in the manager is asked to choose a password (the code flow set the flag).
  const [askPassword, setAskPassword] = useState(() => shouldPromptSetPassword());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (supabase) {
        const result = await claimManagerInvites(supabase as unknown as RpcClient);
        if (cancelled) return;
        if (!result.ok) flash(result.error);
        else if (result.claimed > 0) flash(`You now manage ${result.claimed} station${result.claimed === 1 ? '' : 's'}`);
      }
      if (!cancelled) setChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, flash]);

  if (!checked) {
    return <p className="p-6 text-sm text-adm-mute-text">Checking for your stations…</p>;
  }
  // The card sits inside the panel's own scrolling area, so on a short (landscape) phone it scrolls away
  // instead of filling the screen and hiding "Not now" and the stations.
  return (
    <MyStationsPanel
      flash={flash}
      active={active}
      topSlot={
        askPassword ? (
          <SetPasswordCard
            onSave={async (password) => {
              const result = await updatePassword(password);
              if (result.success) flash('Password saved. Next time, sign in with it');
              return result;
            }}
            onDone={() => {
              clearSetPasswordPrompt();
              setAskPassword(false);
            }}
          />
        ) : null
      }
    />
  );
};

/**
 * The station manager's own entrance (/station-manager). Managers sign in with an email and a password
 * (an emailed code the first time, or if they forget it; no driver sign-up); the admin's invite for their
 * email decides which stations they get.
 * Who may change what is enforced by the database; this page never shows anything beyond "My stations".
 */
export const StationManagerEntrance: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { session, driverProfile, isProfileLoaded, signOut, saveContactDetails, updatePassword } = useAuth();
  const { flash, toast } = useAdminToast();
  const [activeKey, setActiveKey] = useState('mystations');

  return (
    <AdminAuthGate title="Station manager" onExit={onExit} mode="manager">
      <AdminSidebarLayout
        brand="CNG-Connect"
        navItems={NAV}
        activeKey={activeKey}
        onSelect={setActiveKey}
        userEmail={driverProfile.email}
        onSignOut={signOut}
        onExit={onExit}
      >
        {/* Both pages stay mounted and one is hidden, so going to "My profile" and back does not reload the
            stations or reopen the station editor. */}
        <div className={activeKey === 'mystations' ? 'h-full' : 'hidden'}>
          <ManagerBody flash={flash} active={activeKey === 'mystations'} />
        </div>
        <div className={activeKey === 'profile' ? 'h-full' : 'hidden'}>
          <ManagerProfilePanel
            // The form copies the profile when it first appears; start it again once the profile has loaded, or if
            // another tab signs in as a different person.
            key={`${session?.user.id ?? 'none'}:${isProfileLoaded ? 'loaded' : 'loading'}`}
            name={driverProfile.name}
            phone={driverProfile.phone}
            email={driverProfile.email}
            onSaveDetails={saveContactDetails}
            onChangePassword={updatePassword}
            flash={flash}
          />
        </div>
      </AdminSidebarLayout>

      {toast}
    </AdminAuthGate>
  );
};
