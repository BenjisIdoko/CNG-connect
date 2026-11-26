import React, { useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const CNG_KIT_PRESETS = [
  '',
  '12kg cylinder, installed',
  '15kg cylinder, installed',
  '20kg cylinder, installed',
  '60L Twin Tank, installed',
  'Planning to convert soon',
  'Interested in Pi-CNG conversion grant',
];

export interface EditableUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  vehicle: string | null;
  cng_kit: string | null;
  is_admin: boolean | null;
}

interface Props {
  user: EditableUser;
  onClose: () => void;
  onSaved: (id: string, patch: Partial<EditableUser>) => void;
  flash: (m: string) => void;
  /** Whether the account has the community manager role now, and how to tell the page it changed. */
  isCommunityManager?: boolean;
  onCommunityManagerChanged?: (id: string, value: boolean) => void;
}

const selectCls =
  'h-9 max-md:h-11 w-full rounded-md border border-adm-line bg-adm-card px-3 text-sm max-md:text-base text-adm-ink outline-none transition-colors focus-visible:border-adm-note focus-visible:ring-2 focus-visible:ring-adm-note';

/**
 * Full edit for one driver's profile: name, phone, state, vehicle and CNG kit. The admin flag is
 * shown read-only: nobody can change it from the app, only SQL can. Email isn't editable here:
 * it's the Supabase Auth identity itself, not just a profile field, so changing it needs Auth's
 * own email-change flow, not a plain profile patch.
 */
export const UserEditorModal: React.FC<Props> = ({ user, onClose, onSaved, flash, isCommunityManager = false, onCommunityManagerChanged }) => {
  const supabase = useSupabaseClient();
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [state, setState] = useState(user.state || '');
  const [vehicle, setVehicle] = useState(user.vehicle || '');
  const [cngKit, setCngKit] = useState(user.cng_kit || '');
  const [communityManager, setCommunityManager] = useState(isCommunityManager);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.rpc('admin_update_profile', {
      p_user_id: user.id,
      p_name: name,
      p_phone: phone,
      p_state: state,
      p_vehicle: vehicle,
      p_cng_kit: cngKit,
    });
    setSaving(false);
    if (error) {
      flash(
        /admin_update_profile|schema cache/i.test(error.message)
          ? 'Not set up yet — run supabase/admin-users-crud.sql in the Supabase SQL editor.'
          : `Save failed: ${error.message}`
      );
      return;
    }
    // The community manager role is a separate admin-only function; only call it when the switch changed.
    if (communityManager !== isCommunityManager) {
      const { error: roleError } = await supabase.rpc('admin_set_community_manager', { p_user_id: user.id, p_value: communityManager });
      if (roleError) {
        onSaved(user.id, { name, phone, state, vehicle, cng_kit: cngKit });
        flash(
          /admin_set_community_manager|schema cache/i.test(roleError.message)
            ? 'Details saved, but the community manager role is not set up yet: run supabase/community-managers.sql.'
            : `Details saved, but the community manager role failed: ${roleError.message}`,
        );
        onClose();
        return;
      }
      onCommunityManagerChanged?.(user.id, communityManager);
    }
    onSaved(user.id, { name, phone, state, vehicle, cng_kit: cngKit });
    flash(`Saved · ${name || user.email}`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription className="truncate">{user.email}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-name">Name</Label>
            <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-phone">Phone</Label>
            <Input id="user-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-state">State</Label>
            <Input id="user-state" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-vehicle">Vehicle</Label>
            <Input id="user-vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="user-kit">CNG kit</Label>
            <select id="user-kit" value={cngKit} onChange={(e) => setCngKit(e.target.value)} className={selectCls}>
              {CNG_KIT_PRESETS.map((v) => (
                <option key={v} value={v}>
                  {v || 'Not installed yet'}
                </option>
              ))}
              {cngKit && !CNG_KIT_PRESETS.includes(cngKit) && <option value={cngKit}>{cngKit}</option>}
            </select>
          </div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-adm-line p-3">
            <input
              type="checkbox"
              checked={communityManager}
              onChange={(e) => setCommunityManager(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--adm-note)]"
            />
            <span>
              <span className="block text-sm font-semibold text-adm-ink">Community manager</span>
              <span className="block text-xs text-adm-mute-text">
                Can post gas status for any station, from anywhere.
              </span>
            </span>
          </label>
          {user.is_admin && (
            <p className="text-sm font-semibold text-adm-mute-text">App admin. The admin flag can only be changed in the database.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
