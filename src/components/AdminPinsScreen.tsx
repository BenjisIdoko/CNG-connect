import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';

type Tier = 'source_exact' | 'rooftop' | 'street' | 'area' | 'city';
const TIERS: Tier[] = ['rooftop', 'street', 'area', 'source_exact', 'city'];
const TIER_LABEL: Record<Tier, string> = {
  source_exact: 'Source exact (±15m)',
  rooftop: 'Rooftop (±30m)',
  street: 'Street (±150m)',
  area: 'Area (±700m)',
  city: 'City centroid (±4km)',
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
}

function haversineM(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:#00b060;border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 20],
});

export const AdminPinsScreen: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { session, driverProfile, isAuthLoading, sendLoginCode, verifyLoginCode, signOut } = useAuth();

  // --- gate: sign-in ---
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);

  // --- editor state ---
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [tier, setTier] = useState<Tier>('rooftop');
  const [search, setSearch] = useState('');
  const [onlyReview, setOnlyReview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dotsRef = useRef<L.LayerGroup | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const isAdmin = Boolean(driverProfile.isAdmin);
  const sel = rows.find((r) => r.id === selId) || null;

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('stations')
      .select(
        'id,name,address,operator,city,state,lat,lng,location_precision,needs_pin_review,station_type,area,data_source'
      )
      .order('needs_pin_review', { ascending: false })
      .order('name');
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session && isAdmin) void load();
  }, [session, isAdmin, load]);

  // --- map init ---
  useEffect(() => {
    if (!session || !isAdmin || !mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true }).setView([9.07, 7.49], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    dotsRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [session, isAdmin]);

  // --- render all-station dots ---
  useEffect(() => {
    const layer = dotsRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const r of rows) {
      if (r.id === selId) continue;
      L.circleMarker([r.lat, r.lng], {
        radius: 4,
        weight: 1,
        color: r.needs_pin_review ? '#ff6d00' : '#00b060',
        fillOpacity: 0.7,
      })
        .bindTooltip(r.name, { direction: 'top' })
        .on('click', () => setSelId(r.id))
        .addTo(layer);
    }
  }, [rows, selId]);

  // --- selected draggable marker ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (!sel) return;
    setPending(null);
    setTier((sel.location_precision as Tier) && TIERS.includes(sel.location_precision as Tier)
      ? (sel.location_precision as Tier)
      : 'rooftop');
    const m = L.marker([sel.lat, sel.lng], { draggable: true, icon: pinIcon }).addTo(map);
    m.on('dragend', () => {
      const ll = m.getLatLng();
      setPending({ lat: Number(ll.lat.toFixed(6)), lng: Number(ll.lng.toFixed(6)) });
    });
    markerRef.current = m;
    map.flyTo([sel.lat, sel.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [selId, rows]);

  const save = async () => {
    if (!sel || !supabase) return;
    const lat = pending?.lat ?? sel.lat;
    const lng = pending?.lng ?? sel.lng;
    setSaving(true);
    const { error } = await supabase.rpc('admin_set_station_pin', {
      p_station_id: sel.id,
      p_lat: lat,
      p_lng: lng,
      p_precision: tier,
      p_area: null,
    });
    setSaving(false);
    if (error) {
      flash(`Save failed: ${error.message}`);
      return;
    }
    setRows((rs) =>
      rs.map((r) =>
        r.id === sel.id
          ? { ...r, lat, lng, location_precision: tier, needs_pin_review: tier === 'city', data_source: 'Admin verified' }
          : r
      )
    );
    setPending(null);
    flash(`Saved · ${sel.name}`);
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
  const moved = sel && pending ? haversineM([sel.lat, sel.lng], [pending.lat, pending.lng]) : 0;

  // ---------- render ----------
  if (isAuthLoading) {
    return <div className="fixed inset-0 z-[200] bg-white grid place-items-center text-slate-500">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-50 grid place-items-center p-6 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-3">
          <h1 className="text-lg font-extrabold text-slate-900">Station Pin Admin</h1>
          <p className="text-sm text-slate-500">Sign in with an admin email.</p>
          {!codeSent ? (
            <>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                disabled={authBusy || !email}
                onClick={async () => {
                  setAuthBusy(true);
                  setAuthErr(null);
                  const r = await sendLoginCode(email.trim());
                  setAuthBusy(false);
                  if (r.success) setCodeSent(true);
                  else setAuthErr(r.error || 'Could not send code.');
                }}
                className="bg-emerald-600 text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50"
              >
                {authBusy ? 'Sending…' : 'Send code'}
              </button>
            </>
          ) : (
            <>
              <input
                inputMode="numeric"
                placeholder="Verification code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm tracking-widest"
              />
              <button
                disabled={authBusy || code.length < 6}
                onClick={async () => {
                  setAuthBusy(true);
                  setAuthErr(null);
                  const r = await verifyLoginCode(email.trim(), code);
                  setAuthBusy(false);
                  if (!r.success) setAuthErr(r.error || 'Invalid code.');
                }}
                className="bg-emerald-600 text-white rounded-lg py-2 text-sm font-bold disabled:opacity-50"
              >
                {authBusy ? 'Verifying…' : 'Verify'}
              </button>
            </>
          )}
          {authErr && <p className="text-xs text-rose-600 font-semibold">{authErr}</p>}
          <button onClick={onExit} className="text-xs text-slate-400 hover:text-slate-600 mt-1">
            ← Back to app
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-50 grid place-items-center p-6 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center flex flex-col gap-3">
          <h1 className="text-lg font-extrabold text-slate-900">Not authorized</h1>
          <p className="text-sm text-slate-500">
            <span className="font-mono text-slate-700">{driverProfile.email}</span> isn't an admin. Run in
            Supabase: <code className="text-xs">update profiles set is_admin = true where email = '…';</code>
          </p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => signOut()} className="text-xs px-3 py-1.5 rounded-full bg-slate-100">
              Sign out
            </button>
            <button onClick={onExit} className="text-xs px-3 py-1.5 rounded-full bg-slate-100">
              Back to app
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* top bar */}
      <div className="h-12 shrink-0 border-b border-slate-200 flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-extrabold text-slate-900 text-sm whitespace-nowrap">Station Pin Admin</span>
          <span className="text-xs text-orange-600 font-semibold whitespace-nowrap">
            {reviewCount} need review
          </span>
        </div>
        <button onClick={onExit} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 shrink-0">
          Exit
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* list */}
        <div className="w-72 shrink-0 border-r border-slate-200 flex flex-col min-h-0">
          <div className="p-2 border-b border-slate-100 flex flex-col gap-2">
            <input
              placeholder="Search name / address / state"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />
              Only needs-review ({reviewCount})
            </label>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <p className="p-3 text-xs text-slate-400">Loading stations…</p>}
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelId(r.id)}
                className={`w-full text-left px-3 py-2 border-b border-slate-100 ${
                  r.id === selId ? 'bg-emerald-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      r.needs_pin_review ? 'bg-orange-500' : 'bg-emerald-500'
                    }`}
                  />
                  <span className="text-xs font-semibold text-slate-900 truncate">{r.name}</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {r.location_precision || '—'} · {r.city}, {r.state}
                </p>
              </button>
            ))}
            {!loading && filtered.length === 0 && (
              <p className="p-3 text-xs text-slate-400">Nothing matches.</p>
            )}
          </div>
        </div>

        {/* map + editor */}
        <div className="flex-1 flex flex-col min-h-0">
          <div ref={mapEl} className="flex-1 min-h-0" />
          {sel && (
            <div className="shrink-0 border-t border-slate-200 p-3 flex flex-col gap-2 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{sel.name}</p>
                  <p className="text-xs text-slate-500 truncate">{sel.address || '(no address)'}</p>
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${sel.name} ${sel.address || ''} ${sel.state || ''} Nigeria`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap shrink-0"
                >
                  Open in Google Maps ↗
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span>
                  now: {sel.lat.toFixed(5)}, {sel.lng.toFixed(5)}
                </span>
                {pending && (
                  <span className="text-emerald-700 font-semibold">
                    new: {pending.lat.toFixed(5)}, {pending.lng.toFixed(5)} · moved {moved}m
                  </span>
                )}
                <span className="text-slate-400">drag the green pin to reposition</span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as Tier)}
                  className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs flex-1"
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {TIER_LABEL[t]}
                    </option>
                  ))}
                </select>
                {pending && (
                  <button
                    onClick={() => {
                      setPending(null);
                      const m = markerRef.current;
                      if (m && sel) m.setLatLng([sel.lat, sel.lng]);
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={saving}
                  className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save pin'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[210] bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};
