import React, { useCallback, useEffect, useRef, useState } from 'react';
import { holdsAutoOpen, stationToOpenOnArrival } from '../../utils/managerLanding';
import type { ManagerStateReason } from '../../utils/managerState';
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
  manager_state: 'closed' | 'open' | 'selling' | 'out' | null;
  manager_state_at: string | null;
  manager_state_reason: ManagerStateReason | null;
  manager_state_until: string | null;
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
export const MyStationsPanel: React.FC<{
  flash: (m: string) => void;
  topSlot?: React.ReactNode;
  /** False while another page is showing; the editor then does not open by itself. */
  active?: boolean;
}> = ({ flash, topSlot, active = true }) => {
  const supabase = useSupabaseClient();
  const { driverProfile } = useAuth();

  const [stations, setStations] = useState<ManagedStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // A manager with one station lands on it once; closing the editor must not reopen it on reload.
  const autoOpened = useRef(false);

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

  // A manager with one station lands on its editor, but not while the set-password card is waiting:
  // the editor is full-screen and would hide it. Once the card is answered the editor opens.
  const holdAutoOpen = holdsAutoOpen({ promptPending: Boolean(topSlot), pageActive: active });
  useEffect(() => {
    const toOpen = stationToOpenOnArrival(stations, autoOpened.current, holdAutoOpen);
    if (toOpen) {
      autoOpened.current = true;
      setEditingId(toOpen);
    }
  }, [stations, holdAutoOpen]);

  const editing = stations.find((s) => s.id === editingId) || null;

  // The Closed / Open / Open with gas buttons and the pressure stepper. They sit on each station's
  // card and again at the top of the details editor, so a manager who lands in the editor can post
  // a status without closing it first.
  const statusCard = (s: ManagedStation) => (
    <StationQuickUpdate
      stationId={s.id}
      stationName={s.name}
      city={s.city ?? ''}
      managerState={s.manager_state ?? null}
      managerStateAt={s.manager_state_at ?? null}
      managerStateReason={s.manager_state_reason ?? null}
      managerStateUntil={s.manager_state_until ?? null}
      managerSelling={s.manager_selling}
      managerSellingAt={s.manager_selling_at}
      livePressureBar={s.live_pressure_bar}
      livePressureAt={s.live_pressure_at}
      pumpPressure={s.pump_pressure}
      flash={flash}
      onPosted={() => void load(true)}
    />
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl w-full mx-auto p-4 flex flex-col gap-3">
        {topSlot}
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
            {statusCard(s)}
            <button
              type="button"
              onClick={() => setEditingId(s.id)}
              className="mt-1 min-h-11 text-xs text-adm-note font-semibold inline-flex items-center gap-1 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-adm-note rounded-sm"
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
          statusCard={statusCard(editing)}
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
