import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';

export interface FullStationRow {
  id: string;
  name: string;
  address: string | null;
  operator: string | null;
  city: string | null;
  state: string | null;
  station_type: string | null;
  area: string | null;
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

interface Props {
  station: FullStationRow;
  onClose: () => void;
  onSaved: (id: string, patch: Partial<FullStationRow>) => void;
  /** Shows the manager-assignment section — only admins may assign/remove managers. */
  isAdmin?: boolean;
}

interface ManagerInfo {
  userId: string;
  email: string;
  name: string;
}

// HH:MM:SS (from the DB) -> HH:MM (what <input type="time"> wants).
const toTimeInput = (v: string | null) => (v ? v.slice(0, 5) : '');

const inputCls =
  'w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30';
const labelCls = 'text-xs font-semibold text-slate-500 mb-1 block';

export const FullStationEditorModal: React.FC<Props> = ({ station, onClose, onSaved, isAdmin = false }) => {
  const isEv = station.station_type === 'ev_charging';

  const [name, setName] = useState(station.name);
  const [operator, setOperator] = useState(station.operator || '');
  const [phone, setPhone] = useState(station.phone || '');
  const [stationType, setStationType] = useState(station.station_type || 'cng');
  const [isAccredited, setIsAccredited] = useState(Boolean(station.is_picng_accredited));
  const [address, setAddress] = useState(station.address || '');
  const [city, setCity] = useState(station.city || '');
  const [state, setState] = useState(station.state || '');
  const [area, setArea] = useState(station.area || '');

  const [cngPrice, setCngPrice] = useState(station.cng_price != null ? String(station.cng_price) : '');
  const [pumpPressure, setPumpPressure] = useState(
    station.pump_pressure != null ? String(station.pump_pressure) : ''
  );
  const [connectorTypes, setConnectorTypes] = useState((station.connector_types || []).join(', '));
  const [chargingSpeed, setChargingSpeed] = useState(
    station.charging_speed_kw != null ? String(station.charging_speed_kw) : ''
  );
  const [pricePerKwh, setPricePerKwh] = useState(
    station.price_per_kwh != null ? String(station.price_per_kwh) : ''
  );
  const [totalPorts, setTotalPorts] = useState(station.total_ports != null ? String(station.total_ports) : '');
  const [network, setNetwork] = useState(station.network || '');

  const [is24Hours, setIs24Hours] = useState(Boolean(station.is_24_hours));
  const [opensAt, setOpensAt] = useState(toTimeInput(station.opens_at));
  const [closesAt, setClosesAt] = useState(toTimeInput(station.closes_at));
  const [hoursNote, setHoursNote] = useState(station.hours_note || '');

  const [images, setImages] = useState<string[]>(station.images || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [managers, setManagers] = useState<ManagerInfo[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [managerBusy, setManagerBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin || !supabase) return;
    let cancelled = false;
    setLoadingManagers(true);
    (async () => {
      const { data: links } = await supabase!
        .from('station_managers')
        .select('user_id')
        .eq('station_id', station.id);
      const userIds = (links || []).map((l) => l.user_id as string);
      if (userIds.length === 0) {
        if (!cancelled) setManagers([]);
      } else {
        const { data: profs } = await supabase!
          .from('profiles')
          .select('id,email,name')
          .in('id', userIds);
        if (!cancelled) {
          setManagers(
            (profs || []).map((p) => ({ userId: p.id as string, email: p.email as string, name: (p.name as string) || '' }))
          );
        }
      }
      if (!cancelled) setLoadingManagers(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, station.id]);

  const addManager = async () => {
    if (!supabase || !newManagerEmail.trim()) return;
    setManagerBusy(true);
    setErr(null);
    const { error } = await supabase.rpc('admin_assign_station_manager', {
      p_station_id: station.id,
      p_manager_email: newManagerEmail.trim(),
    });
    setManagerBusy(false);
    if (error) {
      setErr(`Add manager failed: ${error.message}`);
      return;
    }
    setNewManagerEmail('');
    const { data: profs } = await supabase.from('profiles').select('id,email,name').eq('email', newManagerEmail.trim());
    if (profs && profs[0]) {
      setManagers((prev) => [
        ...prev.filter((m) => m.userId !== profs[0].id),
        { userId: profs[0].id as string, email: profs[0].email as string, name: (profs[0].name as string) || '' },
      ]);
    }
  };

  const removeManager = async (email: string) => {
    if (!supabase) return;
    setManagerBusy(true);
    const { error } = await supabase.rpc('admin_remove_station_manager', {
      p_station_id: station.id,
      p_manager_email: email,
    });
    setManagerBusy(false);
    if (error) {
      setErr(`Remove manager failed: ${error.message}`);
      return;
    }
    setManagers((prev) => prev.filter((m) => m.email !== email));
  };

  const persistImages = async (next: string[]) => {
    if (!supabase) return;
    const { error } = await supabase.rpc('admin_update_station', {
      p_station_id: station.id,
      p_images: next,
    });
    if (error) {
      setErr(`Photo save failed: ${error.message}`);
      return;
    }
    setImages(next);
    onSaved(station.id, { images: next });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !supabase) return;
    if (!file.type.startsWith('image/')) {
      setErr('Please choose an image file.');
      return;
    }
    setUploading(true);
    setErr(null);
    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${station.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('station-photos')
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (upErr) {
      setErr(
        /bucket.*not found/i.test(upErr.message)
          ? 'Station photo storage isn’t set up yet (run supabase/admin-full-station-editor.sql).'
          : `Upload failed: ${upErr.message}`
      );
      return;
    }
    const { data } = supabase.storage.from('station-photos').getPublicUrl(path);
    await persistImages([...images, data.publicUrl]);
  };

  const removeImage = async (url: string) => {
    await persistImages(images.filter((u) => u !== url));
  };

  const save = async () => {
    if (!supabase) return;
    setSaving(true);
    setErr(null);
    const { error } = await supabase.rpc('admin_update_station', {
      p_station_id: station.id,
      p_name: name.trim(),
      p_operator: operator.trim() || null,
      p_phone: phone.trim() || null,
      p_station_type: stationType,
      p_is_picng_accredited: isAccredited,
      p_address: address.trim() || null,
      p_city: city.trim() || null,
      p_state: state.trim() || null,
      p_area: area.trim() || null,
      p_cng_price: cngPrice.trim() ? Number(cngPrice) : null,
      p_pump_pressure: pumpPressure.trim() ? Math.round(Number(pumpPressure)) : null,
      p_connector_types: connectorTypes.trim()
        ? connectorTypes.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      p_charging_speed_kw: chargingSpeed.trim() ? Number(chargingSpeed) : null,
      p_price_per_kwh: pricePerKwh.trim() ? Number(pricePerKwh) : null,
      p_total_ports: totalPorts.trim() ? Math.round(Number(totalPorts)) : null,
      p_network: network.trim() || null,
      p_is_24_hours: is24Hours,
      p_opens_at: !is24Hours && opensAt ? opensAt : null,
      p_closes_at: !is24Hours && closesAt ? closesAt : null,
      p_hours_note: hoursNote.trim() || null,
    });
    setSaving(false);
    if (error) {
      setErr(`Save failed: ${error.message}`);
      return;
    }
    onSaved(station.id, {
      name: name.trim(),
      operator: operator.trim() || null,
      phone: phone.trim() || null,
      station_type: stationType,
      is_picng_accredited: isAccredited,
      address: address.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      area: area.trim() || null,
      cng_price: cngPrice.trim() ? Number(cngPrice) : null,
      pump_pressure: pumpPressure.trim() ? Math.round(Number(pumpPressure)) : null,
      connector_types: connectorTypes.trim() ? connectorTypes.split(',').map((s) => s.trim()).filter(Boolean) : [],
      charging_speed_kw: chargingSpeed.trim() ? Number(chargingSpeed) : null,
      price_per_kwh: pricePerKwh.trim() ? Number(pricePerKwh) : null,
      total_ports: totalPorts.trim() ? Math.round(Number(totalPorts)) : null,
      network: network.trim() || null,
      is_24_hours: is24Hours,
      opens_at: !is24Hours && opensAt ? opensAt : null,
      closes_at: !is24Hours && closesAt ? closesAt : null,
      hours_note: hoursNote.trim() || null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[230] bg-black/40 grid place-items-center p-4">
      <div className="w-full max-w-2xl max-h-[88vh] bg-white rounded-2xl shadow-xl flex flex-col">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="font-extrabold text-slate-900 text-sm truncate pr-2">Full details — {station.name}</h2>
          <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 shrink-0">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          {err && <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</p>}

          {/* Photos */}
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wide">Photos</h3>
            <div className="grid grid-cols-3 gap-2">
              {images.map((url) => (
                <div key={url} className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(url)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-video rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 flex flex-col items-center justify-center gap-1 text-xs font-semibold disabled:opacity-50"
              >
                <span className="text-lg leading-none">{uploading ? '…' : '+'}</span>
                {uploading ? 'Uploading' : 'Add photo'}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </div>
          </section>

          {/* Core Info */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wide">Core info</h3>
            <div>
              <label className={labelCls}>Name</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Operator</label>
                <input className={inputCls} value={operator} onChange={(e) => setOperator(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className={labelCls}>Station type</label>
                <select className={inputCls} value={stationType} onChange={(e) => setStationType(e.target.value)}>
                  <option value="cng">CNG</option>
                  <option value="ev_charging">EV charging</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 pb-1.5">
                <input type="checkbox" checked={isAccredited} onChange={(e) => setIsAccredited(e.target.checked)} />
                Pi-CNG accredited
              </label>
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>City</label>
                <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>State</label>
                <input className={inputCls} value={state} onChange={(e) => setState(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Area</label>
                <input className={inputCls} value={area} onChange={(e) => setArea(e.target.value)} />
              </div>
            </div>
          </section>

          {/* Pricing & Specs */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wide">Pricing & specs</h3>
            {isEv ? (
              <>
                <div>
                  <label className={labelCls}>Connector types (comma-separated)</label>
                  <input
                    className={inputCls}
                    placeholder="CCS2 Combo, Type 2 AC"
                    value={connectorTypes}
                    onChange={(e) => setConnectorTypes(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Charging speed (kW)</label>
                    <input className={inputCls} inputMode="decimal" value={chargingSpeed} onChange={(e) => setChargingSpeed(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Price (₦/kWh)</label>
                    <input className={inputCls} inputMode="decimal" value={pricePerKwh} onChange={(e) => setPricePerKwh(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Total ports</label>
                    <input className={inputCls} inputMode="numeric" value={totalPorts} onChange={(e) => setTotalPorts(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Network</label>
                  <input className={inputCls} value={network} onChange={(e) => setNetwork(e.target.value)} />
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>CNG price (₦/kg)</label>
                  <input className={inputCls} inputMode="decimal" value={cngPrice} onChange={(e) => setCngPrice(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Pump pressure (bar)</label>
                  <input className={inputCls} inputMode="numeric" value={pumpPressure} onChange={(e) => setPumpPressure(e.target.value)} />
                </div>
              </div>
            )}
          </section>

          {/* Hours */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wide">Hours</h3>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={is24Hours} onChange={(e) => setIs24Hours(e.target.checked)} />
              Open 24 hours
            </label>
            {!is24Hours && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Opens at</label>
                  <input type="time" className={inputCls} value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Closes at</label>
                  <input type="time" className={inputCls} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                </div>
              </div>
            )}
            <div>
              <label className={labelCls}>Hours note (optional)</label>
              <input className={inputCls} placeholder="e.g. Closed Sundays" value={hoursNote} onChange={(e) => setHoursNote(e.target.value)} />
            </div>
          </section>

          {isAdmin && (
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wide">
                Station managers
              </h3>
              <p className="text-xs text-slate-500 -mt-1">
                A manager can edit only this station's details (not pin location review, bulk tools, or other stations).
              </p>
              {loadingManagers ? (
                <p className="text-xs text-slate-400">Loading…</p>
              ) : managers.length === 0 ? (
                <p className="text-xs text-slate-400">No managers assigned yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {managers.map((m) => (
                    <div
                      key={m.userId}
                      className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{m.name || 'Unnamed driver'}</p>
                        <p className="text-xs text-slate-500 truncate">{m.email}</p>
                      </div>
                      <button
                        onClick={() => removeManager(m.email)}
                        disabled={managerBusy}
                        className="text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold shrink-0 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  className={inputCls}
                  placeholder="manager@email.com"
                  value={newManagerEmail}
                  onChange={(e) => setNewManagerEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addManager()}
                />
                <button
                  onClick={addManager}
                  disabled={managerBusy || !newManagerEmail.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-white font-semibold whitespace-nowrap disabled:opacity-50"
                >
                  Add
                </button>
              </div>
              <p className="text-xs text-slate-400">
                The email must belong to a driver who has already signed up (any email-verified account works).
              </p>
            </section>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="text-xs px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save all'}
          </button>
        </div>
      </div>
    </div>
  );
};
