import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { NIGERIAN_STATES } from '../../data/nigerianStates';
import { rejectSuggestion } from '../../services/stationAdminService';
import { findSimilarStations, type StationRef } from '../../utils/stationDuplicates';
import { AddStationModal } from './AddStationModal';

interface SuggestionRow {
  id: string;
  name: string;
  address: string;
  station_type: string;
  city: string | null;
  state: string | null;
  operator: string | null;
  notes: string | null;
  photo: string | null;
  created_at: string;
}

interface Props {
  flash: (m: string) => void;
  /** Tells the sidebar how many suggestions are still pending. */
  onCountChange: (n: number) => void;
}

/**
 * Driver-submitted "Suggest station" forms waiting for a decision. Approve opens the Add station
 * form filled in with what the driver sent (the admin sets the map position there); saving
 * creates the station and marks the suggestion approved in one database step. Reject closes it.
 */
export const SuggestionsPanel: React.FC<Props> = ({ flash, onCountChange }) => {
  const supabase = useSupabaseClient();

  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [stations, setStations] = useState<StationRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setLoadErr(null);
    const [sug, st] = await Promise.all([
      supabase
        .from('station_suggestions')
        .select('id,name,address,station_type,city,state,operator,notes,photo,created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase.from('stations').select('id,name,lat,lng'),
    ]);
    setLoading(false);
    if (sug.error || !sug.data) {
      setLoadErr(sug.error?.message ?? 'Could not load suggestions.');
      return;
    }
    const rows = sug.data as SuggestionRow[];
    setSuggestions(rows);
    onCountChange(rows.length);
    if (st.data) setStations(st.data as StationRef[]);
  }, [supabase, onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const removeFromList = (id: string) => {
    setSuggestions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      onCountChange(next.length);
      return next;
    });
  };

  const reject = async (id: string) => {
    if (!supabase) return;
    setBusyId(id);
    setActionErr(null);
    const result = await rejectSuggestion(supabase, id);
    setBusyId(null);
    setConfirmRejectId(null);
    if (!result.ok) {
      setActionErr(result.error);
      return;
    }
    removeFromList(id);
    flash('Suggestion rejected');
  };

  const approving = suggestions.find((s) => s.id === approvingId) || null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl w-full mx-auto p-4 flex flex-col gap-3">
        {loading && <p className="text-sm text-slate-400">Loading suggestions…</p>}
        {loadErr && <p className="text-sm text-rose-600 font-semibold">{loadErr}</p>}
        {actionErr && (
          <p role="alert" className="text-sm text-rose-700 font-semibold">
            {actionErr}
          </p>
        )}
        {!loading && !loadErr && suggestions.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
            No pending suggestions. When a driver taps "Suggest station" it shows up here.
          </div>
        )}

        {suggestions.map((s) => {
          const similar = findSimilarStations({ name: s.name, lat: null, lng: null }, stations);
          const isEv = s.station_type === 'ev_charging';
          return (
            <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-slate-900 text-sm">{s.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isEv ? 'EV charging' : 'CNG'} · {[s.city, s.state].filter(Boolean).join(', ') || 'No city or state'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">{s.address}</p>
                  {s.operator && <p className="text-xs text-slate-500 mt-0.5">Operator: {s.operator}</p>}
                  {s.notes && <p className="text-xs text-slate-500 mt-1 italic">"{s.notes}"</p>}
                  <p className="text-xs text-slate-400 mt-1">
                    Sent {new Date(s.created_at).toLocaleString()}
                  </p>
                </div>
                {s.photo && (
                  <img src={s.photo} alt="" loading="lazy" className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100" />
                )}
              </div>

              {similar.length > 0 ? (
                <div className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <p className="font-semibold">Possibly already on the map:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {similar.map((h) => (
                      <li key={h.id}>{h.name}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-400">No similar station found by name.</p>
              )}

              {isEv && (
                <p className="mt-2 text-xs text-slate-500">
                  EV stations aren't shown in the app right now, so this one can only be rejected.
                </p>
              )}

              <div className="mt-3 flex items-center justify-end gap-2">
                {confirmRejectId === s.id ? (
                  <>
                    <span className="text-xs font-semibold text-rose-700">Reject this suggestion?</span>
                    <button
                      type="button"
                      onClick={() => setConfirmRejectId(null)}
                      className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => reject(s.id)}
                      disabled={busyId === s.id}
                      className="text-xs px-3 py-1.5 rounded-full bg-rose-600 text-white font-bold disabled:opacity-50"
                    >
                      {busyId === s.id ? 'Rejecting…' : 'Yes, reject'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setActionErr(null);
                        setConfirmRejectId(s.id);
                      }}
                      className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionErr(null);
                        setApprovingId(s.id);
                      }}
                      disabled={isEv}
                      className="text-xs px-3 py-1.5 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-40"
                    >
                      Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {approving && (
        <AddStationModal
          stations={stations}
          prefill={{
            name: approving.name,
            address: approving.address,
            city: approving.city ?? '',
            state: approving.state && NIGERIAN_STATES.includes(approving.state) ? approving.state : undefined,
            operator: approving.operator ?? '',
            suggestionId: approving.id,
          }}
          flash={flash}
          onClose={() => setApprovingId(null)}
          onCreated={() => {
            const id = approving.id;
            setApprovingId(null);
            removeFromList(id);
            // Pick up the new station so later suggestions are checked against it too.
            void load();
          }}
        />
      )}
    </div>
  );
};
