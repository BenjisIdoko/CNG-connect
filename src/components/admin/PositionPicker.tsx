/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, hasGoogleMapsKey } from '../../utils/googleMaps';
import { parseLatLng, PIN_TIERS, PIN_TIER_LABEL, type PinTier } from '../../utils/geoInput';
import { Icon } from '../common/Icon';

type LatLng = { lat: number; lng: number };

interface Props {
  value: LatLng | null;
  onChange: (p: LatLng | null) => void;
  tier: PinTier;
  onTierChange: (t: PinTier) => void;
  /** Where the map opens when there is no pin yet. Defaults to Abuja. */
  center?: LatLng;
  /** Used for the "find on Google Maps" link, e.g. the station's name and address. */
  searchText?: string;
}

const ABUJA: LatLng = { lat: 9.0765, lng: 7.4853 };
const round6 = (n: number) => Number(n.toFixed(6));

/**
 * Chooses a station's map position: click or drag a pin on the Google map when a key is
 * configured, and always paste coordinates or a Google Maps link. Also picks the accuracy tier.
 */
export const PositionPicker: React.FC<Props> = ({ value, onChange, tier, onTierChange, center, searchText }) => {
  const [pasteVal, setPasteVal] = useState('');
  const [pasteErr, setPasteErr] = useState<string | null>(null);
  const [mapErr, setMapErr] = useState<string | null>(null);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<typeof google.maps | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  // The map listeners are created once, so they read the latest callback through a ref.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const placeMarker = (pos: LatLng) => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    if (!markerRef.current) {
      markerRef.current = new maps.Marker({ map, position: pos, draggable: true });
      markerRef.current.addListener('dragend', () => {
        const p = markerRef.current?.getPosition();
        if (p) onChangeRef.current({ lat: round6(p.lat()), lng: round6(p.lng()) });
      });
    } else {
      markerRef.current.setPosition(pos);
    }
  };

  useEffect(() => {
    if (!hasGoogleMapsKey || !mapEl.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapEl.current) return;
        mapsRef.current = maps;
        const start = value ?? center ?? ABUJA;
        mapRef.current = new maps.Map(mapEl.current, {
          center: start,
          zoom: value ? 17 : 7,
          mapTypeId: 'hybrid',
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) onChangeRef.current({ lat: round6(e.latLng.lat()), lng: round6(e.latLng.lng()) });
        });
        if (value) placeMarker(value);
      })
      .catch((e) => setMapErr(e instanceof Error ? e.message : 'Map failed to load.'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin and the view in step with the chosen position.
  useEffect(() => {
    if (!value) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }
    placeMarker(value);
    mapRef.current?.panTo(value);
    if ((mapRef.current?.getZoom() ?? 0) < 16) mapRef.current?.setZoom(17);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  const applyPaste = () => {
    const parsed = parseLatLng(pasteVal);
    if (!parsed) {
      setPasteErr('Could not read a Nigeria coordinate from that. Try "9.0765, 7.4853".');
      return;
    }
    setPasteErr(null);
    onChange(parsed);
  };

  return (
    <div className="flex flex-col gap-2">
      {hasGoogleMapsKey ? (
        <div>
          <div ref={mapEl} className="w-full h-56 rounded-md border border-adm-line bg-adm-muted" />
          {mapErr && <p className="text-xs text-adm-danger mt-1">{mapErr}</p>}
        </div>
      ) : (
        <p className="text-xs text-adm-mute-text">
          No Google Maps key is set here, so paste the coordinates or a Google Maps link instead.
        </p>
      )}

      <div className="flex items-center gap-2">
        <input
          aria-label="Paste coordinates or a Google Maps link"
          value={pasteVal}
          onChange={(e) => {
            setPasteVal(e.target.value);
            setPasteErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyPaste();
            }
          }}
          placeholder="Paste from Google Maps, e.g. 9.0765, 7.4853"
          className="flex-1 border border-adm-line rounded-lg px-2.5 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={applyPaste}
          className="text-xs px-3 py-1.5 rounded-lg bg-adm-note text-white font-semibold"
        >
          Apply
        </button>
      </div>
      {pasteErr && <p className="text-xs text-adm-danger">{pasteErr}</p>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-adm-ink">
        {value ? (
          <span className="text-adm-note font-semibold">
            Position: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        ) : (
          <span className="text-adm-warn font-semibold">No position yet</span>
        )}
        {searchText && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchText)}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-adm-note hover:underline"
          >
            find on Google Maps <Icon name="north_east" size={12} className="inline" />
          </a>
        )}
        {hasGoogleMapsKey && <span className="text-adm-mute-text">click or drag the pin on the map</span>}
      </div>

      <select
        aria-label="Position accuracy"
        value={tier}
        onChange={(e) => onTierChange(e.target.value as PinTier)}
        className="border border-adm-line rounded-lg px-2 py-1.5 text-xs"
      >
        {PIN_TIERS.map((t) => (
          <option key={t} value={t}>
            {PIN_TIER_LABEL[t]}
          </option>
        ))}
      </select>
    </div>
  );
};
