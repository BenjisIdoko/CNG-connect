import React, { useState } from 'react';
import { GasStation } from '../types';
import { Modal } from './common/Modal';

interface EditStationLocationModalProps {
  station: GasStation;
  onClose: () => void;
  onSaveLocation: (stationId: string, lat: number, lng: number) => void;
}

export const EditStationLocationModal: React.FC<EditStationLocationModalProps> = ({
  station,
  onClose,
  onSaveLocation,
}) => {
  const [mapsUrlInput, setMapsUrlInput] = useState('');
  const [latInput, setLatInput] = useState(station.lat ? station.lat.toString() : '');
  const [lngInput, setLngInput] = useState(station.lng ? station.lng.toString() : '');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Helper to parse Google Maps URL or string coordinates like "9.101597, 7.243265"
  const parseGoogleMapsLinkOrCoords = (input: string): { lat: number; lng: number } | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Direct "lat, lng" format
    const simpleCoordsRegex = /^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/;
    const simpleMatch = trimmed.match(simpleCoordsRegex);
    if (simpleMatch) {
      const lat = parseFloat(simpleMatch[1]);
      const lng = parseFloat(simpleMatch[3]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }

    // URL format: ?q=9.101597,7.243265 or @9.101597,7.243265
    const urlCoordsRegex = /(?:q=|@|=)(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
    const urlMatch = trimmed.match(urlCoordsRegex);
    if (urlMatch) {
      const lat = parseFloat(urlMatch[1]);
      const lng = parseFloat(urlMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }

    return null;
  };

  const handleUrlInputChange = (val: string) => {
    setMapsUrlInput(val);
    setErrorMsg(null);
    const parsed = parseGoogleMapsLinkOrCoords(val);
    if (parsed) {
      setLatInput(parsed.lat.toString());
      setLngInput(parsed.lng.toString());
    }
  };

  const handleGetDeviceGps = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        setLatInput(pos.coords.latitude.toFixed(6));
        setLngInput(pos.coords.longitude.toFixed(6));
      },
      (err) => {
        setGpsLoading(false);
        setErrorMsg('Unable to retrieve GPS position. Please enter manually or paste Google Maps link.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setErrorMsg('Please enter valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }

    onSaveLocation(station.id, lat, lng);
    onClose();
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Update Station Location Pin">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-1">
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-900 border border-emerald-200 p-3 rounded-2xl text-[13px]">
          <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0">edit_location</span>
          <span>Help the driver community by setting the exact GPS pin for <strong>{station.name}</strong>.</span>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-xl text-caption font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Option A: Paste Google Maps Link */}
        <div className="flex flex-col gap-1.5">
          <label className="text-caption font-bold text-slate-700">Paste Google Maps Link or Coords</label>
          <input
            type="text"
            value={mapsUrlInput}
            onChange={(e) => handleUrlInputChange(e.target.value)}
            placeholder="e.g. https://www.google.com/maps?q=9.101597,7.243265"
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-body text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <span className="text-micro text-slate-500 font-medium">Extracts exact latitude & longitude automatically.</span>
        </div>

        <div className="flex items-center gap-3 my-1">
          <div className="h-px bg-slate-200 flex-1" />
          <span className="text-micro font-bold uppercase text-slate-400">OR</span>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

        {/* Option B: Use Current Device GPS */}
        <button
          type="button"
          onClick={handleGetDeviceGps}
          disabled={gpsLoading}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-caption rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <span className="material-symbols-outlined text-[18px] text-primary">my_location</span>
          <span>{gpsLoading ? 'Acquiring Device GPS...' : 'Use My Current Location Pin'}</span>
        </button>

        {/* Manual Lat & Lng Inputs */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="flex flex-col gap-1">
            <label className="text-micro font-bold uppercase text-slate-600">Latitude</label>
            <input
              type="text"
              value={latInput}
              onChange={(e) => {
                setLatInput(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="e.g. 9.101597"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-body font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-micro font-bold uppercase text-slate-600">Longitude</label>
            <input
              type="text"
              value={lngInput}
              onChange={(e) => {
                setLngInput(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="e.g. 7.243265"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-body font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-4 border-t border-slate-200 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-body rounded-full transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-primary hover:bg-deep-teal text-white font-extrabold text-body rounded-full shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Confirm GPS Location</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
