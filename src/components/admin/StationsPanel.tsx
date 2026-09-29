import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { parseCsv, toCsv } from '../../utils/csv';
import { FullStationEditorModal } from '../FullStationEditorModal';
import { PinReviewModal } from './PinReviewModal';
import { Icon } from '../common/Icon';

type Tier = 'source_exact' | 'rooftop' | 'street' | 'area' | 'city';
const TIERS: Tier[] = ['rooftop', 'street', 'area', 'source_exact', 'city'];
const TIER_SHORT: Record<Tier, string> = {
  source_exact: 'Exact',
  rooftop: 'Rooftop',
  street: 'Street',
  area: 'Area',
  city: 'City — review',
};

interface Row {
  id: string;
  name: string;
  address: string | null;
  operator: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  location_precision: string | null;
  needs_pin_review: boolean;
  station_type: string | null;
  area: string | null;
  data_source: string | null;
  phone: string | null;
  cng_price: number | null;
  pump_pressure: number | null;
  is_picng_accredited: boolean | null;
  images: string[] | null;
  opens_at: string | null;
  closes_at: string | null;
  is_24_hours: boolean | null;
  hours_note: string | null;
  connector_types: string[] | null;
  charging_speed_kw: number | null;
  price_per_kwh: number | null;
  total_ports: number | null;
  network: string | null;
}

// Text fields the CSV bulk-update can touch, in export column order.
const CSV_TEXT_FIELDS = ['name', 'address', 'operator', 'city', 'state', 'station_type', 'area'] as const;
type CsvTextField = (typeof CSV_TEXT_FIELDS)[number];
const CSV_COLUMNS = [...CSV_TEXT_FIELDS, 'lat', 'lng', 'location_precision'] as const;

interface CsvDiffRow {
  id: string;
  current: Row | undefined;
  label: string;
  changes: Partial<Record<(typeof CSV_COLUMNS)[number], { from: string; to: string }>>;
  error?: string;
}

/** Compares an uploaded CSV against the currently-loaded rows. Blank cells mean
 * "leave this field alone" so a spreadsheet only needs to fill in what changed. */
function buildCsvDiff(parsed: string[][], rows: Row[]): { diffs: CsvDiffRow[]; headerErr?: string } {
  if (parsed.length === 0) return { diffs: [], headerErr: 'That file is empty.' };
  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const idIdx = header.indexOf('id');
  if (idIdx === -1) {
    return { diffs: [], headerErr: 'CSV needs an "id" column — use Export CSV to get a starter file.' };
  }
  const colIdx: Partial<Record<(typeof CSV_COLUMNS)[number], number>> = {};
  for (const f of CSV_COLUMNS) {
    const i = header.indexOf(f);
    if (i !== -1) colIdx[f] = i;
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const diffs: CsvDiffRow[] = [];
  for (let i = 1; i < parsed.length; i++) {
    const line = parsed[i];
    const id = (line[idIdx] || '').trim();
    if (!id) continue;
    const current = byId.get(id);
    if (!current) {
      diffs.push({ id, current: undefined, label: id, changes: {}, error: 'Unknown station id — skipped.' });
      continue;
    }

    const changes: CsvDiffRow['changes'] = {};
    let rowErr: string | undefined;
    for (const f of CSV_TEXT_FIELDS) {
      const idx = colIdx[f];
      if (idx === undefined) continue;
      const raw = (line[idx] ?? '').trim();
      if (!raw) continue;
      const cur = (current[f as CsvTextField] as string | null) || '';
      if (raw !== cur) changes[f] = { from: cur, to: raw };
    }
    for (const f of ['lat', 'lng'] as const) {
      const idx = colIdx[f];
      if (idx === undefined) continue;
      const raw = (line[idx] ?? '').trim();
      if (!raw) continue;
      const num = Number(raw);
      if (Number.isNaN(num)) {
        rowErr = `bad ${f}: "${raw}"`;
        continue;
      }
      const cur = current[f];
      if (Math.abs(num - cur) > 0.000001) changes[f] = { from: cur.toFixed(6), to: num.toFixed(6) };
    }
    const pIdx = colIdx.location_precision;
    if (pIdx !== undefined) {
      const raw = (line[pIdx] ?? '').trim();
      if (raw) {
        if (!TIERS.includes(raw as Tier)) {
          rowErr = `bad location_precision: "${raw}"`;
        } else if (raw !== (current.location_precision || '')) {
          changes.location_precision = { from: current.location_precision || '', to: raw };
        }
      }
    }

    // A moved pin with no explicit precision column is no longer "city centroid"
    // accuracy — without this, admin_update_station leaves needs_pin_review
    // untouched (it only reacts to an explicit p_precision), so a coordinate fix
    // would silently fail to clear the review flag.
    if ((changes.lat || changes.lng) && !changes.location_precision && current.location_precision === 'city') {
      changes.location_precision = { from: 'city', to: 'rooftop' };
    }

    if (rowErr || Object.keys(changes).length > 0) {
      diffs.push({ id, current, label: current.name, changes, error: rowErr });
    }
  }
  return { diffs };
}

/** A table cell that's plain text until clicked, then becomes an input; commits on blur/Enter. */
const EditableCell: React.FC<{
  value: string;
  placeholder?: string;
  align?: 'left' | 'right';
  onCommit: (next: string) => void;
}> = ({ value, placeholder, align = 'left', onCommit }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onCommit(trimmed);
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`w-full border border-emerald-400 rounded px-1.5 py-1 text-xs bg-emerald-50/50 outline-none ${
          align === 'right' ? 'text-right' : ''
        }`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to edit"
      className={`block w-full truncate rounded px-1.5 py-1 text-xs hover:bg-slate-100 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${value ? 'text-slate-800' : 'text-slate-400 italic'}`}
    >
      {value || placeholder || '—'}
    </button>
  );
};

/**
 * Full admin toolset for the `stations` table: a data grid where the common
 * fields are editable inline, plus CSV bulk update, bulk delete, pin-location
 * review (its own modal — see PinReviewModal), and the full details editor
 * for everything else (hours, photos, connector types, managers). Only ever
 * rendered for an admin.
 */
export const StationsPanel: React.FC<{ flash: (m: string) => void }> = ({ flash }) => {
  const supabase = useSupabaseClient();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyReview, setOnlyReview] = useState(false);

  // bulk CSV import
  const [csvDiffs, setCsvDiffs] = useState<CsvDiffRow[] | null>(null);
  const [applyingCsv, setApplyingCsv] = useState(false);

  // full station details editor
  const [fullEditorId, setFullEditorId] = useState<string | null>(null);
  // pin-location review
  const [pinReviewId, setPinReviewId] = useState<string | null>(null);

  // bulk delete
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('stations')
      .select(
        'id,name,address,operator,city,state,lat,lng,location_precision,needs_pin_review,station_type,area,data_source,phone,cng_price,pump_pressure,is_picng_accredited,images,opens_at,closes_at,is_24_hours,hours_note,connector_types,charging_speed_kw,price_per_kwh,total_ports,network'
      )
      .order('needs_pin_review', { ascending: false })
      .order('name');
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveField = async (row: Row, patch: Partial<Pick<Row, 'name' | 'operator' | 'city' | 'state'>>) => {
    if (!supabase) return;
    const params: Record<string, unknown> = { p_station_id: row.id };
    if (patch.name !== undefined) params.p_name = patch.name;
    if (patch.operator !== undefined) params.p_operator = patch.operator;
    if (patch.city !== undefined) params.p_city = patch.city;
    if (patch.state !== undefined) params.p_state = patch.state;
    const { error } = await supabase.rpc('admin_update_station', params);
    if (error) {
      flash(`Save failed: ${error.message}`);
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    flash(`Saved · ${patch.name ?? row.name}`);
  };

  const saveNumericField = async (row: Row, field: 'cng_price' | 'pump_pressure', raw: string) => {
    if (!supabase) return;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) {
      flash('Enter a valid number.');
      return;
    }
    const value = field === 'pump_pressure' ? Math.round(num) : num;
    const params: Record<string, unknown> =
      field === 'cng_price' ? { p_station_id: row.id, p_cng_price: value } : { p_station_id: row.id, p_pump_pressure: value };
    const { error } = await supabase.rpc('admin_update_station', params);
    if (error) {
      flash(`Save failed: ${error.message}`);
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [field]: value } : r)));
    flash(`Saved · ${row.name}`);
  };

  const exportCsv = () => {
    const headers = ['id', ...CSV_COLUMNS, 'needs_pin_review', 'data_source'];
    const data = rows.map((r) => [
      r.id,
      r.name,
      r.address ?? '',
      r.operator ?? '',
      r.city ?? '',
      r.state ?? '',
      r.station_type ?? '',
      r.area ?? '',
      r.lat,
      r.lng,
      r.location_precision ?? '',
      r.needs_pin_review ? 'true' : 'false',
      r.data_source ?? '',
    ]);
    const blob = new Blob([toCsv(headers, data)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onCsvFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const { diffs, headerErr } = buildCsvDiff(parseCsv(text), rows);
    if (headerErr) {
      flash(headerErr);
      return;
    }
    if (diffs.length === 0) {
      flash('No changes found in that file.');
      return;
    }
    setCsvDiffs(diffs);
  };

  const applyCsv = async () => {
    if (!supabase || !csvDiffs) return;
    const toApply = csvDiffs.filter((d) => d.current && !d.error && Object.keys(d.changes).length > 0);
    setApplyingCsv(true);
    let ok = 0;
    const failures: string[] = [];
    for (const d of toApply) {
      const params: Record<string, unknown> = { p_station_id: d.id };
      if (d.changes.name) params.p_name = d.changes.name.to;
      if (d.changes.address) params.p_address = d.changes.address.to;
      if (d.changes.operator) params.p_operator = d.changes.operator.to;
      if (d.changes.city) params.p_city = d.changes.city.to;
      if (d.changes.state) params.p_state = d.changes.state.to;
      if (d.changes.station_type) params.p_station_type = d.changes.station_type.to;
      if (d.changes.area) params.p_area = d.changes.area.to;
      if (d.changes.lat) params.p_lat = Number(d.changes.lat.to);
      if (d.changes.lng) params.p_lng = Number(d.changes.lng.to);
      if (d.changes.location_precision) params.p_precision = d.changes.location_precision.to;
      const { error } = await supabase.rpc('admin_update_station', params);
      if (error) failures.push(`${d.label}: ${error.message}`);
      else ok++;
    }
    setApplyingCsv(false);
    setCsvDiffs(null);
    await load();
    flash(`Bulk update: ${ok} saved${failures.length ? `, ${failures.length} failed` : ''}`);
    if (failures.length) console.error('Bulk update failures:\n' + failures.join('\n'));
  };

  const toggleDeleteSelect = (id: string) => {
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    if (!supabase || selectedForDelete.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selectedForDelete);
    const { error } = await supabase.rpc('admin_delete_stations', { p_station_ids: ids });
    setDeleting(false);
    setConfirmingDelete(false);
    if (error) {
      flash(`Delete failed: ${error.message}`);
      return;
    }
    setRows((rs) => rs.filter((r) => !selectedForDelete.has(r.id)));
    if (fullEditorId && selectedForDelete.has(fullEditorId)) setFullEditorId(null);
    if (pinReviewId && selectedForDelete.has(pinReviewId)) setPinReviewId(null);
    flash(`Deleted ${ids.length} station${ids.length === 1 ? '' : 's'}`);
    setSelectedForDelete(new Set());
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyReview && !r.needs_pin_review) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.address || '').toLowerCase().includes(q) ||
        (r.state || '').toLowerCase().includes(q) ||
        (r.operator || '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, onlyReview]);

  const reviewCount = rows.filter((r) => r.needs_pin_review).length;
  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selectedForDelete.has(r.id));
  const toggleSelectAllVisible = () => {
    setSelectedForDelete((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });
  };

  const pinReviewRow = pinReviewId ? rows.find((r) => r.id === pinReviewId) || null : null;
  const fullEditorRow = fullEditorId ? rows.find((r) => r.id === fullEditorId) || null : null;

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* toolbar */}
      <div className="h-auto min-h-11 shrink-0 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
          <span className="text-xs text-orange-600 font-semibold whitespace-nowrap">{reviewCount} need review</span>
          <input
            placeholder="Search name / address / state / operator"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-64"
          />
          <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
            <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
            Only needs-review
          </label>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={exportCsv} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200">
            Export CSV
          </button>
          <label className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 cursor-pointer">
            Upload CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onCsvFileSelected} />
          </label>
        </div>
      </div>

      {selectedForDelete.size > 0 && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-2 bg-rose-50 border-b border-rose-200">
          <span className="text-xs font-semibold text-rose-700">{selectedForDelete.size} selected</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedForDelete(new Set())}
              className="text-xs px-2.5 py-1 rounded-full bg-white text-slate-600 hover:bg-slate-100"
            >
              Clear
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-xs px-2.5 py-1 rounded-full bg-rose-600 text-white font-semibold hover:bg-rose-700"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* data table */}
      <div className="flex-1 overflow-auto">
        {loading && <p className="p-4 text-xs text-slate-400">Loading stations…</p>}
        {!loading && filtered.length > 0 && (
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 text-left">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 w-8">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} aria-label="Select all" />
                </th>
                <th className="px-2 py-2 w-4" />
                <th className="px-2 py-2 min-w-[180px]">Name</th>
                <th className="px-2 py-2 min-w-[120px]">City</th>
                <th className="px-2 py-2 min-w-[80px]">State</th>
                <th className="px-2 py-2 min-w-[140px]">Operator</th>
                <th className="px-2 py-2 min-w-[90px] text-right">Price (₦)</th>
                <th className="px-2 py-2 min-w-[90px] text-right">Pressure</th>
                <th className="px-2 py-2 min-w-[130px]">Pin</th>
                <th className="px-2 py-2 w-28" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={`border-b border-slate-100 ${r.needs_pin_review ? 'bg-orange-50/50' : 'hover:bg-slate-50/70'}`}>
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={selectedForDelete.has(r.id)}
                      onChange={() => toggleDeleteSelect(r.id)}
                      aria-label={`Select ${r.name}`}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${r.needs_pin_review ? 'bg-orange-500' : 'bg-emerald-500'}`} />
                  </td>
                  <td className="px-1 py-1">
                    <EditableCell value={r.name} onCommit={(v) => void saveField(r, { name: v })} />
                  </td>
                  <td className="px-1 py-1">
                    <EditableCell value={r.city || ''} onCommit={(v) => void saveField(r, { city: v })} />
                  </td>
                  <td className="px-1 py-1">
                    <EditableCell value={r.state || ''} onCommit={(v) => void saveField(r, { state: v })} />
                  </td>
                  <td className="px-1 py-1">
                    <EditableCell value={r.operator || ''} onCommit={(v) => void saveField(r, { operator: v })} />
                  </td>
                  <td className="px-1 py-1">
                    <EditableCell
                      align="right"
                      value={r.cng_price != null ? String(r.cng_price) : ''}
                      onCommit={(v) => void saveNumericField(r, 'cng_price', v)}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <EditableCell
                      align="right"
                      value={r.pump_pressure != null ? String(r.pump_pressure) : ''}
                      onCommit={(v) => void saveNumericField(r, 'pump_pressure', v)}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <button
                      onClick={() => setPinReviewId(r.id)}
                      className={`text-[0.6875rem] px-2 py-1 rounded-full font-semibold whitespace-nowrap ${
                        r.needs_pin_review ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {TIER_SHORT[(r.location_precision as Tier) || 'city']}
                    </button>
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    <button
                      onClick={() => setFullEditorId(r.id)}
                      className="text-[0.6875rem] px-2.5 py-1 rounded-lg bg-slate-800 text-white font-semibold"
                    >
                      Full details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <p className="p-4 text-xs text-slate-400">Nothing matches.</p>}
      </div>

      {confirmingDelete && (
        <div className="fixed inset-0 z-[225] bg-black/40 grid place-items-center p-6">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 flex flex-col gap-3">
            <h2 className="font-extrabold text-slate-900 text-sm">
              Delete {selectedForDelete.size} station{selectedForDelete.size === 1 ? '' : 's'}?
            </h2>
            <div className="max-h-40 overflow-y-auto text-xs text-slate-600 flex flex-col gap-1 border border-slate-200 rounded-lg p-2.5">
              {rows
                .filter((r) => selectedForDelete.has(r.id))
                .map((r) => (
                  <span key={r.id} className="truncate">
                    {r.name}
                  </span>
                ))}
            </div>
            <p className="text-xs text-rose-600 font-semibold">
              This permanently deletes each station and its reports, photos, and comments. This can't be undone.
            </p>
            <div className="flex justify-end gap-2 mt-1">
              <button onClick={() => setConfirmingDelete(false)} className="text-xs px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
                Cancel
              </button>
              <button
                onClick={deleteSelected}
                disabled={deleting}
                className="text-xs px-4 py-1.5 rounded-lg bg-rose-600 text-white font-bold disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {csvDiffs && (
        <div className="fixed inset-0 z-[220] bg-black/40 grid place-items-center p-6">
          <div className="w-full max-w-2xl max-h-[80vh] bg-white rounded-2xl shadow-xl flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h2 className="font-extrabold text-slate-900 text-sm">
                Review bulk update — {csvDiffs.filter((d) => d.current && !d.error).length} station(s) to change
                {csvDiffs.some((d) => d.error || !d.current) ? `, ${csvDiffs.filter((d) => d.error || !d.current).length} problem row(s)` : ''}
              </h2>
              <button onClick={() => setCsvDiffs(null)} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 shrink-0">
                Cancel
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
              {csvDiffs.map((d) => (
                <div key={d.id} className={`border rounded-lg p-2.5 text-xs ${d.error || !d.current ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}>
                  <p className="font-semibold text-slate-900">{d.label}</p>
                  {d.error && <p className="text-rose-600 mt-0.5">{d.error}</p>}
                  {!d.current && <p className="text-rose-600 mt-0.5">Unknown station id "{d.id}" — will be skipped.</p>}
                  {Object.entries(d.changes).map(([k, v]) => (
                    <p key={k} className="text-slate-600 mt-0.5">
                      <span className="font-mono text-[0.75rem] text-slate-400">{k}</span>: {v.from || '(empty)'}{' '}
                      <Icon name="arrow_forward" size={12} className="inline" /> <span className="font-semibold text-emerald-700">{v.to}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button onClick={() => setCsvDiffs(null)} className="text-xs px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
                Cancel
              </button>
              <button
                onClick={applyCsv}
                disabled={applyingCsv || csvDiffs.every((d) => d.error || !d.current)}
                className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50"
              >
                {applyingCsv
                  ? 'Applying…'
                  : `Apply ${csvDiffs.filter((d) => d.current && !d.error && Object.keys(d.changes).length > 0).length} change(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {pinReviewRow && (
        <PinReviewModal
          station={pinReviewRow}
          flash={flash}
          onClose={() => setPinReviewId(null)}
          onSaved={(id, patch) => {
            setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
          }}
        />
      )}

      {fullEditorRow && (
        <FullStationEditorModal
          station={fullEditorRow}
          isAdmin
          onClose={() => setFullEditorId(null)}
          onSaved={(id, patch) => {
            setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
            flash('Saved station details');
          }}
        />
      )}
    </div>
  );
};
