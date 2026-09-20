import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FullStationEditorModal, FullStationRow } from './FullStationEditorModal';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';

type ManagedStation = FullStationRow & {
  lat: number;
  lng: number;
  needs_pin_review: boolean;
  location_precision: string | null;
  data_source: string | null;
};

/**
 * Lightweight ?manager=1 route: a driver assigned (by an admin, via the
 * "Station managers" section of the full admin editor) to one or more
 * specific stations can sign in here and edit only those stations' details
 * — the same FullStationEditorModal the admin tool uses, just without pin
 * review, bulk CSV, bulk delete, or visibility into any other station.
 */
export const StationManagerScreen: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { session, driverProfile, isAuthLoading, sendLoginCode, verifyLoginCode, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);

  const [stations, setStations] = useState<ManagedStation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setLoadErr(null);
    const { data, error } = await supabase.rpc('my_managed_stations');
    setLoading(false);
    if (error) {
      setLoadErr(error.message);
      return;
    }
    setStations((data || []) as ManagedStation[]);
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const editing = stations.find((s) => s.id === editingId) || null;

  if (isAuthLoading) {
    return <div className="fixed inset-0 z-[200] bg-white grid place-items-center text-slate-500">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-50 grid place-items-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-3">
          <h1 className="text-lg font-extrabold text-slate-900">Station Manager</h1>
          <p className="text-sm text-slate-500">Sign in with the email an admin assigned you under.</p>
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
            <span className="inline-flex items-center gap-1"><ArrowLeft size={14} weight="bold" /> Back to app</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col">
      <div className="h-12 shrink-0 border-b border-slate-200 flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-extrabold text-slate-900 text-sm whitespace-nowrap">My Stations</span>
          <span className="text-xs text-slate-400 truncate">{driverProfile.email}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => signOut()} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200">
            Sign out
          </button>
          <button onClick={onExit} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200">
            Exit
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 max-w-xl w-full mx-auto flex flex-col gap-3">
        {loading && <p className="text-sm text-slate-400">Loading your stations…</p>}
        {loadErr && <p className="text-sm text-rose-600 font-semibold">{loadErr}</p>}
        {!loading && !loadErr && stations.length === 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-500">
            No stations are assigned to you yet. Ask an admin to add your email ({driverProfile.email}) as a manager
            for your station.
          </div>
        )}
        {stations.map((s) => (
          <button
            key={s.id}
            onClick={() => setEditingId(s.id)}
            className="text-left bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all"
          >
            <p className="font-extrabold text-slate-900 text-sm">{s.name}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{s.address}</p>
            <p className="text-xs text-emerald-700 font-semibold mt-1.5"><span className="inline-flex items-center gap-1">Edit details <ArrowRight size={12} weight="bold" /></span></p>
          </button>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[210] bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {editing && (
        <FullStationEditorModal
          station={editing}
          isAdmin={false}
          onClose={() => setEditingId(null)}
          onSaved={(id, patch) => {
            setStations((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
            flash('Saved station details');
          }}
        />
      )}
    </div>
  );
};
