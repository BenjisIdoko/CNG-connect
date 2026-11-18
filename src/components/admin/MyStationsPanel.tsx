import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { useAuth } from '../../context/AuthContext';
import { FullStationEditorModal, FullStationRow } from '../FullStationEditorModal';
import { Icon } from '../common/Icon';
import { StationQuickUpdate } from './StationQuickUpdate';

type ManagedStation = FullStationRow & {
  lat: number;
  lng: number;
  needs_pin_review: boolean;
  location_precision: string | null;
  data_source: string | null;
  manager_selling: boolean | null;
  manager_selling_at: string | null;
  live_pressure_bar: number | null;
  live_pressure_at: string | null;
};

/**
 * A driver assigned (by an admin, via the "Station managers" section of the full
 * station editor) to one or more specific stations manages only those stations here:
 * a quick card to post "Selling now / Not selling" and the pump pressure, and the same
 * FullStationEditorModal the admin tool uses for details, just without pin review,
 * bulk CSV, bulk delete, or visibility into any other station.
 */
export const MyStationsPanel: React.FC<{ flash: (m: string) => void }> = ({ flash }) => {
  const supabase = useSupabaseClient();
  const { driverProfile } = useAuth();

  const [stations, setStations] = useState<ManagedStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // `quiet` reloads after a post without the "Loading…" line, so the card the manager is on
  // does not jump; the stations are replaced with what the database now holds (server times).
  const load = useCallback(
    async (quiet = false) => {
      if (!supabase) return;
      if (!quiet) setLoading(true);
      setLoadErr(null);
      const { data, error } = await supabase.rpc('my_managed_stations');
      setLoading(false);
      if (error) {
        setLoadErr(error.message);
        return;
      }
      setStations((data || []) as ManagedStation[]);
    },
    [supabase],
  );

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
            No stations are assigned to you yet. Ask the app admin to add your email ({driverProfile.email}) as the
            manager of your station.
            {driverProfile.isAdmin && (
              <>
                {' '}
                You're the app admin: your dashboard is at <a className="underline font-semibold" href="/admin">/admin</a>.
              </>
            )}
          </div>
        )}
        {stations.map((s) => (
          <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <p className="font-extrabold text-slate-900 text-sm">{s.name}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{s.address}</p>
            <StationQuickUpdate
              stationId={s.id}
              managerSelling={s.manager_selling}
              managerSellingAt={s.manager_selling_at}
              livePressureBar={s.live_pressure_bar}
              livePressureAt={s.live_pressure_at}
              pumpPressure={s.pump_pressure}
              flash={flash}
              onPosted={() => void load(true)}
            />
            <button
              type="button"
              onClick={() => setEditingId(s.id)}
              className="mt-3 text-xs text-emerald-700 font-semibold inline-flex items-center gap-1 hover:underline"
            >
              Edit details <Icon name="arrow_forward" size={12} />
            </button>
          </div>
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
