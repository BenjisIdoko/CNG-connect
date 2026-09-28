import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { formatRelativeTime } from '../../utils/timeUtils';

type QueueRow = {
  report_id: string;
  station_id: string;
  station_name: string;
  author: string;
  status: 'full' | 'low' | 'queue' | 'out';
  status_label: string;
  comment: string | null;
  photo: string | null;
  verification_level: string;
  created_at: string;
  likes: number;
  dislikes: number;
  hidden: boolean;
  hidden_reason: string | null;
  open_flags: number;
  reasons: string[] | null;
};

const REASON_LABEL: Record<string, string> = {
  wrong_status: 'Wrong status',
  fake_photo: 'Fake photo',
  spam: 'Spam / abuse',
  other: 'Other',
};

const STATUS_DOT: Record<string, string> = {
  full: 'bg-status-green',
  queue: 'bg-status-amber',
  low: 'bg-status-orange',
  out: 'bg-status-red',
};

/**
 * Reports drivers flagged (or that got 3+ dislikes): keep, remove, or restore. Removing
 * re-computes the station status from the newest remaining report. Needs supabase/moderation.sql.
 */
export const ReportsPanel: React.FC<{ flash: (m: string) => void }> = ({ flash }) => {
  const supabase = useSupabaseClient();
  const [view, setView] = useState<'review' | 'hidden'>('review');
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.rpc('admin_moderation_queue', { p_view: view });
    setLoading(false);
    if (error) {
      setErr(
        /admin_moderation_queue|schema cache/i.test(error.message)
          ? 'Moderation isn’t set up yet — run supabase/moderation.sql in the Supabase SQL editor.'
          : error.message
      );
      return;
    }
    setRows((data || []) as QueueRow[]);
  }, [supabase, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (row: QueueRow, action: 'hide' | 'keep' | 'restore') => {
    if (!supabase) return;
    setBusyId(row.report_id);
    const { error } = await supabase.rpc('admin_moderate_report', {
      p_report_id: row.report_id,
      p_action: action,
    });
    setBusyId(null);
    if (error) {
      flash(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.report_id !== row.report_id));
    flash(action === 'hide' ? 'Report removed' : action === 'restore' ? 'Report restored' : 'Kept — flags cleared');
  };

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-2xl mx-auto p-4 flex flex-col gap-3 pb-16">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2" role="tablist">
          {(
            [
              ['review', 'Needs review'],
              ['hidden', 'Removed (30 days)'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`px-4 py-2 rounded-full text-caption font-bold transition-colors ${
                view === key ? 'bg-deep-teal text-white' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => void load()} className="px-3 py-1.5 rounded-full bg-surface-container text-caption font-semibold shrink-0">
          Refresh
        </button>
      </div>

      {loading && <p className="text-caption text-outline">Loading…</p>}
      {err && <p className="text-caption text-status-red font-semibold">{err}</p>}
      {!loading && !err && rows.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-[0_4px_14px_rgba(31,41,35,0.05)]">
          <p className="font-bold text-body-lg">{view === 'review' ? 'Nothing to review' : 'Nothing removed recently'}</p>
          <p className="text-caption text-outline mt-1">
            {view === 'review'
              ? 'Reports appear here when drivers flag them or they get 3+ dislikes.'
              : 'Removed reports stay here for 30 days so you can restore them.'}
          </p>
        </div>
      )}

      {rows.map((r) => (
        <article key={r.report_id} className="bg-white rounded-2xl p-4 shadow-[0_4px_14px_rgba(31,41,35,0.05)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-bold text-body text-slate-900 truncate">{r.station_name}</h2>
              <p className="text-caption text-outline">
                {r.author} · {formatRelativeTime(r.created_at)} · {r.verification_level.replace(/_/g, ' ')}
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 text-caption font-bold text-slate-900">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[r.status] || 'bg-slate-400'}`} />
              {r.status_label}
            </span>
          </div>

          {r.comment && <p className="text-caption text-on-surface-variant mt-2">“{r.comment}”</p>}
          {r.photo && <img src={r.photo} alt="Report photo" className="mt-2 w-40 h-28 rounded-xl object-cover" loading="lazy" />}

          <div className="mt-3 flex flex-wrap gap-1.5 text-micro font-semibold">
            {r.open_flags > 0 && (
              <span className="rounded-md bg-status-red-container text-on-error-container px-2 py-0.5">
                {r.open_flags} flag{r.open_flags > 1 ? 's' : ''}
              </span>
            )}
            {(r.reasons || []).map((x) => (
              <span key={x} className="rounded-md bg-surface-container text-slate-600 px-2 py-0.5">
                {REASON_LABEL[x] || x}
              </span>
            ))}
            {r.dislikes > 0 && (
              <span className="rounded-md bg-surface-container text-slate-600 px-2 py-0.5">
                {r.dislikes} dislike{r.dislikes > 1 ? 's' : ''}
              </span>
            )}
            {r.hidden && r.hidden_reason && (
              <span className="rounded-md bg-surface-container text-slate-600 px-2 py-0.5">{r.hidden_reason}</span>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            {view === 'review' ? (
              <>
                <button
                  disabled={busyId === r.report_id}
                  onClick={() => void act(r, 'hide')}
                  className="flex-1 h-11 rounded-full bg-status-red text-white font-bold text-caption disabled:opacity-50 active:scale-95 transition-transform"
                >
                  Remove report
                </button>
                <button
                  disabled={busyId === r.report_id}
                  onClick={() => void act(r, 'keep')}
                  className="flex-1 h-11 rounded-full bg-surface-container text-slate-900 font-bold text-caption disabled:opacity-50 active:scale-95 transition-transform"
                >
                  Keep
                </button>
              </>
            ) : (
              <button
                disabled={busyId === r.report_id}
                onClick={() => void act(r, 'restore')}
                className="flex-1 h-11 rounded-full bg-primary text-white font-bold text-caption disabled:opacity-50 active:scale-95 transition-transform"
              >
                Restore report
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
    </div>
  );
};
