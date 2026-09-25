import React, { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatRelativeTime } from '../utils/timeUtils';

type PayoutRow = {
  referral_id: number;
  referrer_name: string;
  referrer_phone: string;
  referrer_email: string;
  friend_name: string;
  friend_phone: string;
  reward_naira: number;
  status: string;
  qualified_at: string | null;
  paid_at: string | null;
  first_report: string | null;
};

/** Admin list of who is owed referral airtime. You top up the number, then mark it paid. */
export const AirtimePayouts: React.FC<{ supabase: SupabaseClient | null; flash: (m: string) => void }> = ({ supabase, flash }) => {
  const [view, setView] = useState<'owed' | 'paid'>('owed');
  const [rows, setRows] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.rpc('admin_referral_queue', { p_view: view });
    setLoading(false);
    if (error) {
      setErr(
        /admin_referral_queue|schema cache/i.test(error.message)
          ? 'The promo isn’t set up yet — run supabase/referrals.sql in the Supabase SQL editor.'
          : error.message
      );
      return;
    }
    setRows((data || []) as PayoutRow[]);
  }, [supabase, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (row: PayoutRow, action: 'paid' | 'reject' | 'unpay') => {
    if (!supabase) return;
    setBusy(row.referral_id);
    const { error } = await supabase.rpc('admin_referral_set', { p_id: row.referral_id, p_action: action });
    setBusy(null);
    if (error) {
      flash(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.referral_id !== row.referral_id));
    flash(action === 'paid' ? 'Marked as paid' : action === 'unpay' ? 'Moved back to owed' : 'Rejected');
  };

  const total = rows.reduce((n, r) => n + r.reward_naira, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="tablist">
        {(
          [
            ['owed', 'To pay'],
            ['paid', 'Paid'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`px-4 py-2 rounded-full text-caption font-bold ${view === key ? 'bg-primary text-white' : 'bg-white text-on-surface-variant'}`}
          >
            {label}
          </button>
        ))}
        <button onClick={() => void load()} className="ml-auto px-3 py-2 rounded-full bg-white text-caption font-semibold">
          Refresh
        </button>
      </div>

      {loading && <p className="text-caption text-outline">Loading…</p>}
      {err && <p className="text-caption text-status-red font-semibold">{err}</p>}
      {!loading && !err && rows.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-[0_4px_14px_rgba(31,41,35,0.05)]">
          <p className="font-bold text-body-lg">{view === 'owed' ? 'Nobody is owed airtime' : 'No payouts yet'}</p>
          <p className="text-caption text-outline mt-1">
            {view === 'owed' ? 'A friend appears here once they have joined with a link and filed their first report.' : 'Rewards you mark as paid show up here.'}
          </p>
        </div>
      )}
      {rows.length > 0 && (
        <p className="text-caption font-semibold text-on-surface-variant">
          {rows.length} {view === 'owed' ? 'to pay' : 'paid'} · ₦{total.toLocaleString()}
        </p>
      )}

      {rows.map((r) => (
        <article key={r.referral_id} className="bg-white rounded-2xl p-4 shadow-[0_4px_14px_rgba(31,41,35,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-micro font-semibold text-outline">Send airtime to</p>
              <h2 className="font-bold text-body text-slate-900 truncate">{r.referrer_name || 'Driver'}</h2>
              <a href={`tel:${r.referrer_phone}`} className="text-body font-extrabold text-primary">
                {r.referrer_phone || 'No phone saved'}
              </a>
            </div>
            <span className="shrink-0 rounded-full bg-primary-container text-on-surface font-extrabold px-3 py-1 text-caption">
              ₦{r.reward_naira.toLocaleString()}
            </span>
          </div>
          <p className="text-caption text-outline mt-2">
            For inviting <strong className="text-slate-700">{r.friend_name || 'a new driver'}</strong> ({r.friend_phone || 'no phone'}) ·{' '}
            {formatRelativeTime((view === 'paid' ? r.paid_at : r.qualified_at) || '')}
          </p>
          {r.first_report && <p className="text-micro text-outline mt-1">First report: {r.first_report}</p>}
          <div className="mt-3 flex gap-2">
            {view === 'owed' ? (
              <>
                <button
                  disabled={busy === r.referral_id}
                  onClick={() => void act(r, 'paid')}
                  className="flex-1 h-11 rounded-full bg-primary text-white font-bold text-caption disabled:opacity-50 active:scale-95 transition-transform"
                >
                  Mark as paid
                </button>
                <button
                  disabled={busy === r.referral_id}
                  onClick={() => {
                    if (window.confirm('Reject this referral? No airtime will be owed for it.')) void act(r, 'reject');
                  }}
                  className="h-11 px-5 rounded-full bg-surface-container text-slate-900 font-bold text-caption disabled:opacity-50 active:scale-95 transition-transform"
                >
                  Reject
                </button>
              </>
            ) : (
              <button
                disabled={busy === r.referral_id}
                onClick={() => void act(r, 'unpay')}
                className="h-11 px-5 rounded-full bg-surface-container text-slate-900 font-bold text-caption disabled:opacity-50"
              >
                Undo (not paid)
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};
