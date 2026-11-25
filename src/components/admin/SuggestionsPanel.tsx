import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { NIGERIAN_STATES } from '../../data/nigerianStates';
import { rejectSuggestion } from '../../services/stationAdminService';
import { findSimilarStations, type StationRef } from '../../utils/stationDuplicates';
import { AddStationModal } from './AddStationModal';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

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
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 pb-16 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="font-geist text-xl font-bold tracking-tight text-adm-ink">Driver station suggestions</h2>
              <Badge variant="secondary">{suggestions.length} pending</Badge>
            </div>
            <p className="mt-0.5 text-xs text-adm-mute-text">
              Review driver-submitted stations, verify duplicates against the live directory, and place approved pins on the map.
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col gap-3" aria-label="Loading suggestions">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}
        {loadErr && (
          <p role="alert" className="rounded-xl border border-adm-danger/30 bg-adm-danger-soft px-4 py-3 text-sm font-semibold text-adm-danger">
            {loadErr}
          </p>
        )}
        {actionErr && (
          <p role="alert" className="rounded-xl border border-adm-danger/30 bg-adm-danger-soft px-4 py-3 text-sm font-semibold text-adm-danger">
            {actionErr}
          </p>
        )}
        {!loading && !loadErr && suggestions.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-geist text-base font-bold text-adm-ink">No pending suggestions</p>
              <p className="mt-1 text-sm text-adm-mute-text">When a driver taps "Suggest station" it shows up here.</p>
            </CardContent>
          </Card>
        )}

        {suggestions.map((s) => {
          const similar = findSimilarStations({ name: s.name, lat: null, lng: null }, stations);
          const isEv = s.station_type === 'ev_charging';
          return (
            <Card key={s.id}>
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-geist text-base font-bold text-adm-ink">{s.name}</p>
                      <Badge variant="secondary">{isEv ? 'EV charging' : 'CNG'}</Badge>
                      <span className="text-xs text-adm-mute-text">
                        {[s.city, s.state].filter(Boolean).join(', ') || 'No city or state'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-adm-ink">{s.address}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-adm-mute-text">
                      {s.operator && <span>Operator: <strong className="font-semibold text-adm-ink">{s.operator}</strong></span>}
                      <span>Sent {new Date(s.created_at).toLocaleString()}</span>
                    </div>
                    {s.notes && (
                      <p className="mt-2 rounded-lg border border-adm-line/80 bg-adm-muted/40 px-3 py-2 text-xs italic text-adm-mute-text">
                        &ldquo;{s.notes}&rdquo;
                      </p>
                    )}
                  </div>
                  {s.photo && (
                    <img src={s.photo} alt="" loading="lazy" className="size-16 shrink-0 rounded-lg border border-adm-line bg-adm-muted object-cover" />
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-adm-line/70 pt-3">
                  <div className="min-w-0 flex-1">
                    {similar.length > 0 ? (
                      <div className="rounded-lg border border-adm-warn/30 bg-adm-warn-soft px-3 py-2 text-xs text-adm-warn">
                        <p className="font-semibold">Possibly already on the map:</p>
                        <ul className="mt-1 list-disc pl-5">
                          {similar.map((h) => (
                            <li key={h.id}>{h.name}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="flex items-center gap-1.5 text-xs text-adm-mute-text">
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-adm-emerald" />
                        No similar station found by name.
                      </p>
                    )}
                    {isEv && (
                      <p className="mt-1 text-xs text-adm-mute-text">
                        EV stations aren't shown in the app right now, so this one can only be rejected.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {confirmRejectId === s.id ? (
                      <>
                        <span className="text-xs font-semibold text-adm-danger">Reject this suggestion?</span>
                        <Button variant="outline" size="sm" onClick={() => setConfirmRejectId(null)}>
                          Keep
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => reject(s.id)} disabled={busyId === s.id}>
                          {busyId === s.id ? 'Rejecting…' : 'Yes, reject'}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setActionErr(null);
                            setConfirmRejectId(s.id);
                          }}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setActionErr(null);
                            setApprovingId(s.id);
                          }}
                          disabled={isEv}
                        >
                          Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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
