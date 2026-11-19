import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { useAuth } from '../../context/AuthContext';
import { FullStationEditorModal, FullStationRow } from '../FullStationEditorModal';
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
        {loading && <p className="text-sm text-adm-mute-text">Loading your stations…</p>}
        {loadErr && <p className="text-sm text-adm-danger font-semibold">{loadErr}</p>}
        {!loading && !loadErr && stations.length === 0 && (
          <div className="bg-adm-paper border border-adm-line rounded-lg p-6 text-center text-sm text-adm-mute-text">
            No stations are assigned to you yet. Ask the app admin to invite your email ({driverProfile.email}) as the
            manager of your station, then sign in again.
            {driverProfile.isAdmin && (
              <>
                {' '}
                You're the app admin: your dashboard is at <a className="underline font-semibold" href="/admin">/admin</a>.
              </>
            )}
          </div>
        )}
        {stations.map((s) => (
          <div key={s.id} className="bg-adm-card border border-adm-line rounded-lg p-4">
            <p className="font-bold text-adm-ink text-sm">{s.name}</p>
            <p className="text-xs text-adm-mute-text mt-0.5 truncate">{s.address}</p>
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
              className="mt-3 text-xs text-adm-note font-semibold inline-flex items-center gap-1 hover:underline"
            >
              Edit details <ArrowRight className="size-3" aria-hidden="true" />
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
