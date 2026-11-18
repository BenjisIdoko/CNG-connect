import React, { useMemo, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { NIGERIAN_STATES } from '../../data/nigerianStates';
import { createStation, validateNewStation, type NewStationInput } from '../../services/stationAdminService';
import { findSimilarStations, isExactNameDuplicate, type DuplicateHit, type StationRef } from '../../utils/stationDuplicates';
import type { PinTier } from '../../utils/geoInput';
import { PositionPicker } from './PositionPicker';
import { ModalFrame } from './ModalFrame';

interface Props {
  /** Existing stations, for the duplicate and nearby warnings. */
  stations: StationRef[];
  /** Starting values (used when approving a driver's suggestion). */
  prefill?: Partial<NewStationInput> & { suggestionId?: string };
  onClose: () => void;
  onCreated: (id: string) => void;
  flash: (m: string) => void;
}

const REASON_LABEL: Record<DuplicateHit['reason'], string> = {
  same_name: 'same name',
  nearby: 'nearby',
  similar_name: 'similar name',
};

const inputCls =
  'w-full border border-adm-line rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-adm-note';
const labelCls = 'text-xs font-semibold text-adm-mute-text mb-1 block';

/** Short form for adding one station: basics plus a required map position. */
export const AddStationModal: React.FC<Props> = ({ stations, prefill, onClose, onCreated, flash }) => {
  const supabase = useSupabaseClient();

  const [name, setName] = useState(prefill?.name ?? '');
  const [operator, setOperator] = useState(prefill?.operator ?? '');
  const [address, setAddress] = useState(prefill?.address ?? '');
  const [city, setCity] = useState(prefill?.city ?? '');
  const [state, setState] = useState(prefill?.state ?? 'Lagos');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    prefill?.lat != null && prefill?.lng != null ? { lat: prefill.lat, lng: prefill.lng } : null,
  );
  const [tier, setTier] = useState<PinTier>(prefill?.precision ?? 'rooftop');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input: NewStationInput = {
    name,
    operator,
    address,
    city,
    state,
    stationType: 'cng',
    lat: position?.lat ?? null,
    lng: position?.lng ?? null,
    precision: tier,
    suggestionId: prefill?.suggestionId,
  };

  const hits = useMemo(
    () => findSimilarStations({ name, lat: position?.lat ?? null, lng: position?.lng ?? null }, stations),
    [name, position, stations],
  );
  const exactDuplicate = isExactNameDuplicate(name, stations);
  const problem = validateNewStation(input);
  const warnings = hits.filter((h) => h.reason !== 'same_name');
  const blockedReason = exactDuplicate ? 'A station with this name already exists.' : problem;

  const submit = async () => {
    if (!supabase || saving || blockedReason) return;
    setSaving(true);
    setError(null);
    const result = await createStation(supabase, input);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    flash(`Station added · ${name.trim()}`);
    onCreated(result.id);
  };

  return (
    <ModalFrame onClose={onClose} title="Add station" className="max-w-xl">
        <div className="p-4 border-b border-adm-line shrink-0">
          <h2 className="font-bold text-adm-ink text-sm">Add station</h2>
          <p className="text-xs text-adm-mute-text">
            Basics and a map position. Price, hours and photos can be added right after in the full editor.
          </p>
        </div>

        <div className="p-4 overflow-y-auto flex flex-col gap-3">
          <div>
            <label className={labelCls} htmlFor="add-station-name">Name *</label>
            <input id="add-station-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. NIPCO CNG - Ikeja" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="add-station-operator">Operator</label>
              <input id="add-station-operator" className={inputCls} value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="e.g. NIPCO" />
            </div>
            <div>
              <span className={labelCls}>Type</span>
              <div className="px-2.5 py-1.5 text-sm text-adm-ink bg-adm-paper border border-adm-line rounded-lg">CNG</div>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="add-station-address">Address *</label>
            <input id="add-station-address" className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, landmark" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="add-station-city">City *</label>
              <input id="add-station-city" className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Ikeja" />
            </div>
            <div>
              <label className={labelCls} htmlFor="add-station-state">State *</label>
              <select id="add-station-state" className={inputCls} value={state} onChange={(e) => setState(e.target.value)}>
                {NIGERIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className={labelCls}>Position *</span>
            <PositionPicker
              value={position}
              onChange={setPosition}
              tier={tier}
              onTierChange={setTier}
              searchText={`${name} ${address} ${city} ${state} Nigeria`.trim()}
            />
          </div>

          {exactDuplicate && (
            <p role="alert" className="text-xs text-adm-danger bg-adm-danger-soft border border-adm-danger/30 rounded-lg px-3 py-2">
              A station with this name already exists, so it can't be added. The app hides stations whose names match once case and punctuation are ignored. Use a more specific name.
            </p>
          )}

          {warnings.length > 0 && (
            <div role="status" className="text-xs text-adm-warn bg-adm-warn-soft border border-adm-warn/30 rounded-lg px-3 py-2">
              <p className="font-semibold">Check before adding. Similar stations:</p>
              <ul className="mt-1 list-disc pl-4">
                {warnings.map((h) => (
                  <li key={h.id}>
                    {h.name} · {REASON_LABEL[h.reason]}
                    {h.distanceM !== null ? ` · ${h.distanceM} m away` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs text-adm-danger font-semibold">{error}</p>
          )}
        </div>

        <div className="p-4 border-t border-adm-line flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-adm-mute-text min-w-0">{blockedReason && !exactDuplicate ? blockedReason : ''}</p>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onClose} className="text-xs px-4 py-1.5 rounded-lg bg-adm-muted hover:bg-adm-line">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || !supabase || Boolean(blockedReason)}
              className="text-xs px-4 py-1.5 rounded-lg bg-adm-foil text-adm-ink font-bold disabled:opacity-50"
            >
              {saving ? 'Adding…' : warnings.length > 0 ? 'Add anyway' : 'Add station'}
            </button>
          </div>
        </div>
    </ModalFrame>
  );
};
