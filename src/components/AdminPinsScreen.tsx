/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { loadGoogleMaps, hasGoogleMapsKey } from '../utils/googleMaps';

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

const NG = { minLat: 4, maxLat: 14, minLng: 2.5, maxLng: 15 };

function haversineM(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/** Pulls lat,lng out of a pasted "9.07, 7.48", a Google Maps URL, or a place link. */
function parseLatLng(raw: string): { lat: number; lng: number } | null {
  const s = raw.trim();
  const pats = [
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/, // .../maps/@9.07,7.48,17z
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // place URL data segment
    /[?&](?:q|ll|center|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/, // bare "lat, lng"
  ];
  for (const p of pats) {
    const m = s.match(p);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (lat >= NG.minLat && lat <= NG.maxLat && lng >= NG.minLng && lng <= NG.maxLng) {
        return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
      }
      return null; // parsed but outside Nigeria
    }
  }
  return null;
}

// Called only after Google Maps has loaded (from the marker effects).
const dot = (color: string, r: number): google.maps.Symbol => ({
  path: window.google.maps.SymbolPath.CIRCLE,
  fillColor: color,
  fillOpacity: 0.9,
  strokeColor: '#fff',
  strokeWeight: 1.5,
  scale: r,
});

export const AdminPinsScreen: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { session, driverProfile, isAuthLoading, sendLoginCode, verifyLoginCode, signOut } = useAuth();

  // sign-in gate
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);

  // editor state
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [tier, setTier] = useState<Tier>('rooftop');
  const [editName, setEditName] = useState('');
  const [pasteVal, setPasteVal] = useState('');
  const [pasteErr, setPasteErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyReview, setOnlyReview] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mapErr, setMapErr] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Record<string, google.maps.Marker>>({});
  const dragListenerRef = useRef<google.maps.MapsEventListener | null>(null);

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

  // Google Maps init
  useEffect(() => {
    if (!session || !isAdmin || !hasGoogleMapsKey || !mapEl.current || mapRef.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapEl.current) return;
        mapRef.current = new maps.Map(mapEl.current, {
          center: { lat: 9.07, lng: 7.49 },
          zoom: 6,
          mapTypeId: 'hybrid',
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
      })
      .catch((e) => setMapErr(e instanceof Error ? e.message : 'Map failed to load.'));
    return () => {
      cancelled = true;
    };
  }, [session, isAdmin]);

  // sync station markers with rows
  useEffect(() => {
    const map = mapRef.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;
    const seen = new Set<string>();
    for (const r of rows) {
      seen.add(r.id);
      let m = markersRef.current[r.id];
      if (!m) {
        m = new maps.Marker({ map, position: { lat: r.lat, lng: r.lng }, title: r.name });
        m.addListener('click', () => setSelId(r.id));
        markersRef.current[r.id] = m;
      } else {
        m.setPosition({ lat: r.lat, lng: r.lng });
      }
    }
    for (const id of Object.keys(markersRef.current)) {
      if (!seen.has(id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    }
  }, [rows]);

  // style/behaviour for the selected vs the rest
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    dragListenerRef.current?.remove();
    dragListenerRef.current = null;

    for (const [id, m] of Object.entries(markersRef.current)) {
      const r = rows.find((x) => x.id === id);
      if (id === selId) {
        m.setIcon(dot('#00b060', 9));
        m.setDraggable(true);
        m.setZIndex(999);
        dragListenerRef.current = m.addListener('dragend', () => {
          const p = m.getPosition();
          if (p) setPending({ lat: Number(p.lat().toFixed(6)), lng: Number(p.lng().toFixed(6)) });
        });
      } else {
        m.setIcon(dot(r?.needs_pin_review ? '#ff6d00' : '#00b060', 4));
        m.setDraggable(false);
        m.setZIndex(1);
      }
    }

    if (sel) {
      map.panTo({ lat: sel.lat, lng: sel.lng });
      if ((map.getZoom() ?? 0) < 15) map.setZoom(16);
    }
  }, [selId, rows]);

  // when a new station is selected, seed the name field + clear pending
  useEffect(() => {
    setPending(null);
    setPasteVal('');
    setPasteErr(null);
    if (sel) {
      setEditName(sel.name);
      setTier(
        TIERS.includes(sel.location_precision as Tier) ? (sel.location_precision as Tier) : 'rooftop'
      );
    }
  }, [selId]);

  // reflect a pending coord onto the selected marker + map
  useEffect(() => {
    const m = selId ? markersRef.current[selId] : null;
    if (!m || !pending) return;
    m.setPosition(pending);
    mapRef.current?.panTo(pending);
    if ((mapRef.current?.getZoom() ?? 0) < 16) mapRef.current?.setZoom(17);
  }, [pending, selId]);

  const applyPaste = () => {
    const parsed = parseLatLng(pasteVal);
    if (!parsed) {
      setPasteErr('Could not read a Nigeria coordinate from that. Try "9.0765, 7.4853".');
      return;
    }
    setPasteErr(null);
    setPending(parsed);
  };

  const save = async () => {
    if (!sel || !supabase) return;
    const lat = pending?.lat ?? sel.lat;
    const lng = pending?.lng ?? sel.lng;
    const nameChanged = editName.trim() && editName.trim() !== sel.name;
    setSaving(true);
    const { error } = await supabase.rpc('admin_set_station_pin', {
      p_station_id: sel.id,
      p_lat: lat,
      p_lng: lng,
      p_precision: tier,
      p_area: null,
      p_name: nameChanged ? editName.trim() : null,
    });
    setSaving(false);
    if (error) {
      flash(`Save failed: ${error.message}`);
      return;
    }
    setRows((rs) =>
      rs.map((r) =>
        r.id === sel.id
          ? {
              ...r,
              lat,
              lng,
              location_precision: tier,
              needs_pin_review: tier === 'city',
              name: nameChanged ? editName.trim() : r.name,
              data_source: 'Admin verified',
            }
          : r
      )
    );
    setPending(null);
    flash(`Saved · ${nameChanged ? editName.trim() : sel.name}`);
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

  // ---------- gates ----------
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

  // ---------- editor ----------
  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="h-12 shrink-0 border-b border-slate-200 flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-extrabold text-slate-900 text-sm whitespace-nowrap">Station Pin Admin</span>
          <span className="text-xs text-orange-600 font-semibold whitespace-nowrap">{reviewCount} need review</span>
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
            {!loading && filtered.length === 0 && <p className="p-3 text-xs text-slate-400">Nothing matches.</p>}
          </div>
        </div>

        {/* map + editor */}
        <div className="flex-1 flex flex-col min-h-0">
          {hasGoogleMapsKey ? (
            <div ref={mapEl} className="flex-1 min-h-0 bg-slate-100">
              {mapErr && <p className="p-3 text-xs text-rose-600">{mapErr}</p>}
            </div>
          ) : (
            <div className="flex-1 min-h-0 grid place-items-center p-6 text-center bg-slate-50">
              <div className="max-w-md text-sm text-slate-600">
                <p className="font-bold text-slate-900 mb-1">Map disabled</p>
                Set <code className="text-xs">VITE_GOOGLE_MAPS_API_KEY</code> (Vercel env + local <code>.env.local</code>)
                and enable <strong>Maps JavaScript API</strong> on that key. You can still fix pins below by pasting
                coordinates.
              </div>
            </div>
          )}

          {sel && (
            <div className="shrink-0 border-t border-slate-200 p-3 flex flex-col gap-2.5 bg-white">
              {/* name */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 w-12 shrink-0">Name</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`flex-1 border rounded-lg px-2.5 py-1.5 text-sm ${
                    editName.trim() && editName.trim() !== sel.name
                      ? 'border-emerald-400 bg-emerald-50/40'
                      : 'border-slate-300'
                  }`}
                />
              </div>
              <p className="text-xs text-slate-500 truncate pl-14 -mt-1">{sel.address || '(no address)'}</p>

              {/* paste coords */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-500 w-12 shrink-0">Coords</label>
                <input
                  value={pasteVal}
                  onChange={(e) => {
                    setPasteVal(e.target.value);
                    setPasteErr(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && applyPaste()}
                  placeholder="Paste from Google Maps — e.g. 9.0765, 7.4853"
                  className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                />
                <button
                  onClick={applyPaste}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-white font-semibold"
                >
                  Apply
                </button>
              </div>
              {pasteErr && <p className="text-xs text-rose-600 -mt-1 pl-14">{pasteErr}</p>}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pl-14">
                <span>
                  now: {sel.lat.toFixed(5)}, {sel.lng.toFixed(5)}
                </span>
                {pending && (
                  <span className="text-emerald-700 font-semibold">
                    new: {pending.lat.toFixed(5)}, {pending.lng.toFixed(5)} · moved {moved}m
                  </span>
                )}
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${sel.name} ${sel.address || ''} ${sel.state || ''} Nigeria`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-emerald-700 hover:underline"
                >
                  find on Google Maps ↗
                </a>
                <span className="text-slate-400">or drag the green pin</span>
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
                {(pending || (editName.trim() && editName.trim() !== sel.name)) && (
                  <button
                    onClick={() => {
                      setPending(null);
                      setEditName(sel.name);
                      const m = markersRef.current[sel.id];
                      m?.setPosition({ lat: sel.lat, lng: sel.lng });
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
                  {saving ? 'Saving…' : 'Save'}
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
