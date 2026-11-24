import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { parseCsv, toCsv } from '../../utils/csv';
import { FullStationEditorModal } from '../FullStationEditorModal';
import { PinReviewModal } from './PinReviewModal';
import { AddStationModal } from './AddStationModal';
import { ModalFrame } from './ModalFrame';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

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
        className={`block w-full border border-adm-note rounded-md px-3 py-2.5 text-sm bg-adm-card outline-none ring-2 ring-adm-note ${
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
      className={`block w-full truncate px-3 py-2.5 text-sm outline-none hover:bg-adm-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-adm-note ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${value ? 'text-adm-ink' : 'text-adm-mute-text italic'}`}
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
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [applyingCsv, setApplyingCsv] = useState(false);

  // full station details editor
  const [fullEditorId, setFullEditorId] = useState<string | null>(null);
  // pin-location review
  const [pinReviewId, setPinReviewId] = useState<string | null>(null);
  // add a new station
  const [adding, setAdding] = useState(false);

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
  const verifiedCount = Math.max(0, rows.length - reviewCount);
  const verifiedPct = rows.length > 0 ? Math.round((verifiedCount / rows.length) * 100) : 100;
  const reviewPct = rows.length > 0 ? Math.max(0, 100 - verifiedPct) : 0;
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
    <div className="flex h-full min-h-0 flex-col overflow-x-hidden">
      <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-adm-line bg-adm-card px-4 py-2.5 md:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <Badge variant={reviewCount > 0 ? 'warning' : 'secondary'}>{reviewCount} need review</Badge>
          <Input
            type="search"
            aria-label="Search stations"
            placeholder="Search name, address, state or operator"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 sm:max-w-xs"
          />
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium whitespace-nowrap text-adm-ink">
            <input
              type="checkbox"
              className="size-4 accent-adm-note"
              checked={onlyReview}
              onChange={(e) => setOnlyReview(e.target.checked)}
            />
            Only needs review
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setAdding(true)}>Add station</Button>
          <Button variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => csvInputRef.current?.click()}>
            Upload CSV
          </Button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-label="Upload a CSV file of station changes"
            onChange={onCsvFileSelected}
          />
        </div>
      </div>

      {selectedForDelete.size > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-adm-danger/30 bg-adm-danger-soft px-4 py-2 md:px-6">
          <span className="text-sm font-semibold text-adm-danger">{selectedForDelete.size} selected</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedForDelete(new Set())}>
              Clear
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
          {!loading && rows.length > 0 && (
            <div className="flex flex-col justify-between gap-3 rounded-xl border border-adm-line bg-adm-card p-4 shadow-[0_1px_2px_rgba(17,24,20,0.03)]">
              <div className="grid grid-cols-3 divide-x divide-adm-line">
                <div className="pr-3 sm:pr-4">
                  <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-adm-mute-text">
                    Total Stations
                  </span>
                  <span className="mt-1 block font-geist text-xl font-bold tracking-tight text-adm-ink tabular-nums sm:text-2xl">
                    {rows.length}
                  </span>
                </div>
                <div className="px-3 sm:px-4">
                  <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-adm-mute-text">
                    Verified Pin Precision
                  </span>
                  <span className="mt-1 flex flex-wrap items-baseline gap-1.5 font-geist text-xl font-bold tracking-tight text-adm-ink tabular-nums sm:text-2xl">
                    {verifiedCount}
                    <span className="text-xs font-semibold text-[#16a34a]">{verifiedPct}%</span>
                  </span>
                </div>
                <div className="pl-3 sm:pl-4">
                  <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-adm-mute-text">
                    Needs Pin Review
                  </span>
                  <span className="mt-1 flex flex-wrap items-baseline gap-1.5 font-geist text-xl font-bold tracking-tight text-adm-ink tabular-nums sm:text-2xl">
                    {reviewCount}
                    <span className="text-xs font-semibold text-adm-warn">{reviewPct}%</span>
                  </span>
                </div>
              </div>
              <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-full bg-adm-muted gap-0.5">
                {verifiedCount > 0 && (
                  <div className="h-full bg-[#16a34a]" style={{ width: `${Math.max(4, verifiedPct)}%` }} />
                )}
                {reviewCount > 0 && (
                  <div className="h-full bg-[#84cc16]" style={{ width: `${Math.max(4, reviewPct)}%` }} />
                )}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col gap-3" aria-label="Loading stations">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-adm-line bg-adm-card shadow-[0_1px_2px_rgba(17,24,20,0.03)]">
              <Table className="table-fixed max-md:block">
                <TableHeader className="max-md:hidden">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        className="size-4 accent-adm-note"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="w-[27%] lg:w-[24%]">Name</TableHead>
                    <TableHead className="w-[24%] lg:w-[20%]">Location</TableHead>
                    <TableHead className="hidden lg:table-cell lg:w-[15%]">Operator</TableHead>
                    <TableHead className="w-[12%] lg:w-[10%] text-right">Price (₦)</TableHead>
                    <TableHead className="hidden xl:table-cell xl:w-[9%] text-right">Pressure</TableHead>
                    <TableHead className="w-[14%] lg:w-[11%]">Pin</TableHead>
                    <TableHead className="w-[108px] text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="max-md:block max-md:divide-y max-md:divide-adm-line">
                  {filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className={`${r.needs_pin_review ? 'bg-adm-warn-soft/50' : ''} max-md:flex max-md:flex-col max-md:gap-2 max-md:p-3.5`}
                    >
                      <TableCell className="max-md:p-0">
                        <input
                          type="checkbox"
                          className="size-4 accent-adm-note"
                          checked={selectedForDelete.has(r.id)}
                          onChange={() => toggleDeleteSelect(r.id)}
                          aria-label={`Select ${r.name}`}
                        />
                      </TableCell>
                      <TableCell className="p-0">
                        <div className="flex min-w-0 items-center gap-2 pl-3 max-md:pl-0">
                          <span
                            aria-hidden="true"
                            className={`inline-block size-2 shrink-0 rounded-sm ${r.needs_pin_review ? 'bg-adm-warn' : 'bg-adm-note'}`}
                          />
                          <div className="min-w-0 flex-1">
                            <EditableCell value={r.name} onCommit={(v) => void saveField(r, { name: v })} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="p-0">
                        <div className="flex min-w-0 items-center gap-1 pl-2 max-md:pl-0">
                          <div className="min-w-0 flex-1">
                            <EditableCell value={r.city || ''} placeholder="City" onCommit={(v) => void saveField(r, { city: v })} />
                          </div>
                          <span aria-hidden="true" className="shrink-0 text-adm-mute-text">
                            ,
                          </span>
                          <div className="w-16 shrink-0">
                            <EditableCell value={r.state || ''} placeholder="State" onCommit={(v) => void saveField(r, { state: v })} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden p-0 lg:table-cell">
                        <EditableCell value={r.operator || ''} onCommit={(v) => void saveField(r, { operator: v })} />
                      </TableCell>
                      <TableCell className="p-0">
                        <EditableCell
                          align="right"
                          value={r.cng_price != null ? String(r.cng_price) : ''}
                          onCommit={(v) => void saveNumericField(r, 'cng_price', v)}
                        />
                      </TableCell>
                      <TableCell className="hidden p-0 xl:table-cell">
                        <EditableCell
                          align="right"
                          value={r.pump_pressure != null ? String(r.pump_pressure) : ''}
                          onCommit={(v) => void saveNumericField(r, 'pump_pressure', v)}
                        />
                      </TableCell>
                      <TableCell className="max-md:p-0">
                        <Button
                          variant={r.needs_pin_review ? 'outline' : 'ghost'}
                          size="sm"
                          className={r.needs_pin_review ? 'max-w-full truncate border-adm-warn/40 text-adm-warn' : 'max-w-full truncate'}
                          onClick={() => setPinReviewId(r.id)}
                        >
                          {TIER_SHORT[(r.location_precision as Tier) || 'city']}
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right max-md:p-0 max-md:text-left">
                        <Button variant="secondary" size="sm" onClick={() => setFullEditorId(r.id)}>
                          Full details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="rounded-xl border border-adm-line bg-adm-card p-8 text-center shadow-[0_1px_2px_rgba(17,24,20,0.03)]">
              <p className="text-sm text-adm-mute-text">Nothing matches that search.</p>
            </div>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <ModalFrame onClose={() => setConfirmingDelete(false)} title="Delete stations" className="max-w-sm">
          <div className="flex flex-col gap-3 p-5">
            <h2 className="font-bold text-adm-ink text-sm">
              Delete {selectedForDelete.size} station{selectedForDelete.size === 1 ? '' : 's'}?
            </h2>
            <div className="max-h-40 overflow-y-auto text-xs text-adm-ink flex flex-col gap-1 border border-adm-line rounded-lg p-2.5">
              {rows
                .filter((r) => selectedForDelete.has(r.id))
                .map((r) => (
                  <span key={r.id} className="truncate">
                    {r.name}
                  </span>
                ))}
            </div>
            <p className="text-xs text-adm-danger font-semibold">
              This permanently deletes each station and its reports, photos, and comments. This can't be undone.
            </p>
            <div className="flex justify-end gap-2 mt-1">
              <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={deleteSelected} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </Button>
            </div>
          </div>
        </ModalFrame>
      )}

      {csvDiffs && (
        <ModalFrame onClose={() => setCsvDiffs(null)} title="Review bulk update" className="max-w-2xl">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="p-4 border-b border-adm-line flex items-center justify-between shrink-0">
              <h2 className="font-bold text-adm-ink text-sm">
                Review bulk update — {csvDiffs.filter((d) => d.current && !d.error).length} station(s) to change
                {csvDiffs.some((d) => d.error || !d.current) ? `, ${csvDiffs.filter((d) => d.error || !d.current).length} problem row(s)` : ''}
              </h2>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => setCsvDiffs(null)}>
                Cancel
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
              {csvDiffs.map((d) => (
                <div key={d.id} className={`border rounded-lg p-2.5 text-xs ${d.error || !d.current ? 'border-adm-danger/30 bg-adm-danger-soft' : 'border-adm-line'}`}>
                  <p className="font-semibold text-adm-ink">{d.label}</p>
                  {d.error && <p className="text-adm-danger mt-0.5">{d.error}</p>}
                  {!d.current && <p className="text-adm-danger mt-0.5">Unknown station id "{d.id}" — will be skipped.</p>}
                  {Object.entries(d.changes).map(([k, v]) => (
                    <p key={k} className="text-adm-ink mt-0.5">
                      <span className="font-mono text-[0.75rem] text-adm-mute-text">{k}</span>: {v.from || '(empty)'}{' '}
                      <ArrowRight className="inline size-3" aria-hidden="true" /> <span className="font-semibold text-adm-note">{v.to}</span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-adm-line flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => setCsvDiffs(null)}>
                Cancel
              </Button>
              <Button onClick={applyCsv} disabled={applyingCsv || csvDiffs.every((d) => d.error || !d.current)}>
                {applyingCsv
                  ? 'Applying…'
                  : `Apply ${csvDiffs.filter((d) => d.current && !d.error && Object.keys(d.changes).length > 0).length} change(s)`}
              </Button>
            </div>
          </div>
        </ModalFrame>
      )}

      {adding && (
        <AddStationModal
          stations={rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng }))}
          flash={flash}
          onClose={() => setAdding(false)}
          onCreated={async (id) => {
            await load();
            setAdding(false);
            // Straight into the full editor for price, hours, photos and phone.
            setFullEditorId(id);
          }}
        />
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
