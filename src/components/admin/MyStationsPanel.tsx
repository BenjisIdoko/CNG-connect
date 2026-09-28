import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { useAuth } from '../../context/AuthContext';
import { FullStationEditorModal, FullStationRow } from '../FullStationEditorModal';
import { Icon } from '../common/Icon';

type ManagedStation = FullStationRow & {
  lat: number;
  lng: number;
  needs_pin_review: boolean;
  location_precision: string | null;
  data_source: string | null;
};

/**
 * A driver assigned (by an admin, via the "Station managers" section of the full
 * station editor) to one or more specific stations edits only those stations' details
 * here — the same FullStationEditorModal the admin tool uses, just without pin review,
 * bulk CSV, bulk delete, or visibility into any other station.
 */
export const MyStationsPanel: React.FC<{ flash: (m: string) => void }> = ({ flash }) => {
  const supabase = useSupabaseClient();
  const { driverProfile } = useAuth();

  const [stations, setStations] = useState<ManagedStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setLoadErr(null);
    const { data, error } = await supabase.rpc('my_managed_stations');
    setLoading(false);
    if (error) {
      setLoadErr(error.message);
      return;
    }
    setStations((data || []) as ManagedStation[]);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const editing = stations.find((s) => s.id === editingId) || null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl w-full mx-auto p-4 flex flex-col gap-3">
        {loading && <p className="text-sm text-slate-400">Loading your stations…</p>}
        {loadErr && <p className="text-sm text-rose-600 font-semibold">{loadErr}</p>}
        {!loading && !loadErr && stations.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
            No stations are assigned to you yet. Ask an admin to add your email ({driverProfile.email}) as a manager for
            your station — or, if you're the app admin, run{' '}
            <code className="text-xs">update profiles set is_admin = true where email = '…';</code> in Supabase.
          </div>
        )}
        {stations.map((s) => (
          <button
            key={s.id}
            onClick={() => setEditingId(s.id)}
            className="text-left bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all"
          >
            <p className="font-extrabold text-slate-900 text-sm">{s.name}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{s.address}</p>
            <p className="text-xs text-emerald-700 font-semibold mt-1.5">
              <span className="inline-flex items-center gap-1">
                Edit details <Icon name="arrow_forward" size={12} />
              </span>
            </p>
          </button>
        ))}
      </div>

      {editing && (
        <FullStationEditorModal
          station={editing}
          isAdmin={false}
          onClose={() => setEditingId(null)}
          onSaved={(id, patch) => {
            setStations((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
            flash('Saved station details');
          }}
        />
      )}
    </div>
  );
};
