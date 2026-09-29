import React, { useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { Icon } from '../common/Icon';

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
}

const inputCls = 'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const labelCls = 'text-xs font-semibold text-slate-500 mb-1 block';

/**
 * Full edit for one driver's profile — name/phone/state/vehicle/CNG kit plus
 * the admin flag. Email isn't editable here: it's the Supabase Auth identity
 * itself, not just a profile field, so changing it needs Auth's own
 * email-change flow, not a plain profile patch.
 */
export const UserEditorModal: React.FC<Props> = ({ user, onClose, onSaved, flash }) => {
  const supabase = useSupabaseClient();
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [state, setState] = useState(user.state || '');
  const [vehicle, setVehicle] = useState(user.vehicle || '');
  const [cngKit, setCngKit] = useState(user.cng_kit || '');
  const [isAdmin, setIsAdmin] = useState(Boolean(user.is_admin));
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
      p_is_admin: isAdmin,
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
    onSaved(user.id, { name, phone, state, vehicle, cng_kit: cngKit, is_admin: isAdmin });
    flash(`Saved · ${name || user.email}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[230] bg-black/40 grid place-items-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="font-extrabold text-slate-900 text-sm truncate">Edit user</h2>
            <p className="text-xs text-slate-500 truncate">{user.email}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 shrink-0">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3 overflow-y-auto">
          <div>
            <label className={labelCls}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <input value={state} onChange={(e) => setState(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Vehicle</label>
            <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>CNG kit</label>
            <select value={cngKit} onChange={(e) => setCngKit(e.target.value)} className={inputCls}>
              {CNG_KIT_PRESETS.map((v) => (
                <option key={v} value={v}>
                  {v || 'Not installed yet'}
                </option>
              ))}
              {cngKit && !CNG_KIT_PRESETS.includes(cngKit) && <option value={cngKit}>{cngKit}</option>}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
            Admin access
          </label>
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="text-xs px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
