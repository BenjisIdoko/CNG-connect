import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { ManagerLink, groupManagers } from '../../utils/stationManagerGroups';

interface StationOption {
  id: string;
  name: string;
}

/**
 * Super-admin view of every station manager: who manages which stations, with an "add by email"
 * form and a remove button per station. The database checks the caller is the admin on every
 * change (admin_assign_station_manager / admin_remove_station_manager).
 */
export const StationManagersPanel: React.FC<{ flash: (m: string) => void }> = ({ flash }) => {
  const supabase = useSupabaseClient();
  const [links, setLinks] = useState<ManagerLink[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [stationId, setStationId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setLoadErr(null);
    const [{ data: rows, error: rowsErr }, { data: stationRows, error: stationsErr }] = await Promise.all([
      supabase.from('station_managers').select('station_id,user_id'),
      supabase.from('stations').select('id,name').order('name', { ascending: true }),
    ]);
    if (rowsErr || stationsErr) {
      setLoading(false);
      setLoadErr((rowsErr || stationsErr)?.message || 'Could not load station managers');
      return;
    }
    const options = (stationRows || []).map((s) => ({ id: s.id as string, name: (s.name as string) || (s.id as string) }));
    setStations(options);
    const userIds = [...new Set((rows || []).map((r) => r.user_id as string))];
    let profiles: { id: string; email: string; name: string }[] = [];
    if (userIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id,email,name').in('id', userIds);
      profiles = (data || []).map((p) => ({
        id: p.id as string,
        email: (p.email as string) || '',
        name: (p.name as string) || '',
      }));
    }
    const nameOf = new Map(options.map((o) => [o.id, o.name]));
    const profileOf = new Map(profiles.map((p) => [p.id, p]));
    setLinks(
      (rows || []).map((r) => {
        const profile = profileOf.get(r.user_id as string);
        return {
          stationId: r.station_id as string,
          stationName: nameOf.get(r.station_id as string) || (r.station_id as string),
          userId: r.user_id as string,
          email: profile?.email || '(unknown email)',
          name: profile?.name || '',
        };
      }),
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupManagers(links), [links]);

  const add = async () => {
    if (!supabase || busy || !email.trim() || !stationId) return;
    setBusy('add');
    setFormErr(null);
    const { error } = await supabase.rpc('admin_assign_station_manager', {
      p_station_id: stationId,
      p_manager_email: email.trim(),
    });
    setBusy(null);
    if (error) {
      setFormErr(`Could not add: ${error.message}`);
      return;
    }
    setEmail('');
    flash('Manager added');
    void load();
  };

  const remove = async (g: { email: string }, station: { id: string; name: string }) => {
    if (!supabase || busy) return;
    if (!window.confirm(`Remove ${g.email} as manager of ${station.name}?`)) return;
    setBusy(`${g.email}|${station.id}`);
    setFormErr(null);
    const { error } = await supabase.rpc('admin_remove_station_manager', {
      p_station_id: station.id,
      p_manager_email: g.email,
    });
    setBusy(null);
    if (error) {
      setFormErr(`Could not remove: ${error.message}`);
      return;
    }
    flash('Manager removed');
    void load();
  };

  const inputCls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto p-4 pb-16 flex flex-col gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col gap-3">
          <h2 className="font-extrabold text-slate-900 text-sm">Add a station manager</h2>
          <p className="text-xs text-slate-500">
            The person must already have a CNG-Connect account. They sign in at <code>/station-manager</code> and see only
            the stations you assign.
          </p>
          <input
            type="email"
            aria-label="Manager email"
            placeholder="manager@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          <select aria-label="Station" value={stationId} onChange={(e) => setStationId(e.target.value)} className={inputCls}>
            <option value="">Choose a station…</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy !== null || !email.trim() || !stationId}
            className="min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === 'add' ? 'Adding…' : 'Add manager'}
          </button>
          {formErr && (
            <p role="alert" className="text-xs font-semibold text-rose-600">
              {formErr}
            </p>
          )}
        </div>

        {loading && <p className="text-sm text-slate-400">Loading station managers…</p>}
        {loadErr && <p className="text-sm text-rose-600 font-semibold">{loadErr}</p>}
        {!loading && !loadErr && groups.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
            No station managers yet. Add one above.
          </div>
        )}

        {groups.map((g) => (
          <div key={g.userId} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <p className="font-extrabold text-slate-900 text-sm">{g.name || g.email}</p>
            {g.name && <p className="text-xs text-slate-500">{g.email}</p>}
            <ul className="mt-2 flex flex-col gap-1.5">
              {g.stations.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                  <span className="truncate">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => void remove(g, s)}
                    disabled={busy !== null}
                    className="shrink-0 text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                  >
                    {busy === `${g.email}|${s.id}` ? 'Removing…' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
