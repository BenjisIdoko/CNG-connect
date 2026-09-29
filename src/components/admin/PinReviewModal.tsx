/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { loadGoogleMaps, hasGoogleMapsKey } from '../../utils/googleMaps';
import { Icon } from '../common/Icon';

type Tier = 'source_exact' | 'rooftop' | 'street' | 'area' | 'city';
const TIERS: Tier[] = ['rooftop', 'street', 'area', 'source_exact', 'city'];
const TIER_LABEL: Record<Tier, string> = {
  source_exact: 'Source exact (±15m)',
  rooftop: 'Rooftop (±30m)',
  street: 'Street (±150m)',
  area: 'Area (±700m)',
  city: 'City centroid (±4km)',
};

const NG = { minLat: 4, maxLat: 14, minLng: 2.5, maxLng: 15 };

/** Pulls lat,lng out of a pasted "9.07, 7.48", a Google Maps URL, or a place link. */
function parseLatLng(raw: string): { lat: number; lng: number } | null {
  const s = raw.trim();
  const pats = [
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|center|destination)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
  ];
  for (const p of pats) {
    const m = s.match(p);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (lat >= NG.minLat && lat <= NG.maxLat && lng >= NG.minLng && lng <= NG.maxLng) {
        return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
      }
      return null;
    }
  }
  return null;
}

function haversineM(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

export interface PinReviewStation {
  id: string;
  name: string;
  address: string | null;
  state: string | null;
  lat: number;
  lng: number;
  location_precision: string | null;
}

interface Props {
  station: PinReviewStation;
  onClose: () => void;
  onSaved: (id: string, patch: { lat: number; lng: number; location_precision: string; needs_pin_review: boolean }) => void;
  flash: (m: string) => void;
}

/**
 * Focused single-station pin-location review — the map/drag/paste-coordinate
 * workflow that used to sit permanently split-screen with the stations list.
 * Pulled out into its own modal so the main table can stay a plain data grid;
 * opened per-row only when a pin actually needs checking or moving.
 */
export const PinReviewModal: React.FC<Props> = ({ station, onClose, onSaved, flash }) => {
  const supabase = useSupabaseClient();
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [tier, setTier] = useState<Tier>(TIERS.includes(station.location_precision as Tier) ? (station.location_precision as Tier) : 'rooftop');
  const [pasteVal, setPasteVal] = useState('');
  const [pasteErr, setPasteErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mapErr, setMapErr] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!hasGoogleMapsKey || !mapEl.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapEl.current) return;
        mapRef.current = new maps.Map(mapEl.current, {
          center: { lat: station.lat, lng: station.lng },
          zoom: 16,
          mapTypeId: 'hybrid',
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        markerRef.current = new maps.Marker({
          map: mapRef.current,
          position: { lat: station.lat, lng: station.lng },
          title: station.name,
          draggable: true,
        });
        markerRef.current.addListener('dragend', () => {
          const p = markerRef.current?.getPosition();
          if (p) setPending({ lat: Number(p.lat().toFixed(6)), lng: Number(p.lng().toFixed(6)) });
        });
      })
      .catch((e) => setMapErr(e instanceof Error ? e.message : 'Map failed to load.'));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    markerRef.current?.setPosition(pending);
    mapRef.current?.panTo(pending);
    if ((mapRef.current?.getZoom() ?? 0) < 16) mapRef.current?.setZoom(17);
  }, [pending]);

  useEffect(() => {
    if (pending && tier === 'city') setTier('rooftop');
  }, [pending]);

  const applyPaste = () => {
    const parsed = parseLatLng(pasteVal);
    if (!parsed) {
      setPasteErr('Could not read a Nigeria coordinate from that. Try "9.0765, 7.4853".');
      return;
    }
    setPasteErr(null);
    setPending(parsed);
  };

  const moved = pending ? haversineM([station.lat, station.lng], [pending.lat, pending.lng]) : 0;

  const save = async () => {
    if (!supabase) return;
    const lat = pending?.lat ?? station.lat;
    const lng = pending?.lng ?? station.lng;
    setSaving(true);
    const { error } = await supabase.rpc('admin_set_station_pin', {
      p_station_id: station.id,
      p_lat: lat,
      p_lng: lng,
      p_precision: tier,
      p_area: null,
      p_name: null,
    });
    setSaving(false);
    if (error) {
      flash(`Save failed: ${error.message}`);
      return;
    }
    onSaved(station.id, { lat, lng, location_precision: tier, needs_pin_review: tier === 'city' });
    flash(`Pin saved · ${station.name}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[230] bg-black/40 grid place-items-center p-6">
      <div className="w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-xl flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="font-extrabold text-slate-900 text-sm truncate">Review pin · {station.name}</h2>
            <p className="text-xs text-slate-500 truncate">{station.address || '(no address)'}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 shrink-0">
            <Icon name="close" size={20} />
          </button>
        </div>

        {hasGoogleMapsKey ? (
          <div ref={mapEl} className="h-72 shrink-0 bg-slate-100">
            {mapErr && <p className="p-3 text-xs text-rose-600">{mapErr}</p>}
          </div>
        ) : (
          <div className="h-40 shrink-0 grid place-items-center p-4 text-center bg-slate-50 text-xs text-slate-600">
            Map disabled — set <code className="mx-1">VITE_GOOGLE_MAPS_API_KEY</code> to see it here. You can still fix
            the pin below by pasting coordinates.
          </div>
        )}

        <div className="p-4 flex flex-col gap-2.5 overflow-y-auto">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 w-14 shrink-0">Coords</label>
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
            <button onClick={applyPaste} className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-white font-semibold">
              Apply
            </button>
          </div>
          {pasteErr && <p className="text-xs text-rose-600 pl-16">{pasteErr}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pl-16">
            <span>
              now: {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
            </span>
            {pending && (
              <span className="text-emerald-700 font-semibold">
                new: {pending.lat.toFixed(5)}, {pending.lng.toFixed(5)} · moved {moved}m
              </span>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${station.name} ${station.address || ''} ${station.state || ''} Nigeria`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-emerald-700 hover:underline"
            >
              find on Google Maps <Icon name="north_east" size={12} className="inline" />
            </a>
            {hasGoogleMapsKey && <span className="text-slate-400">or drag the pin above</span>}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <select
              aria-label="Pin precision tier"
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
            <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
