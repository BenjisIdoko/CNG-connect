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
  full: 'bg-emerald-500',
  queue: 'bg-amber-500',
  low: 'bg-orange-500',
  out: 'bg-rose-500',
};

/**
 * Reports drivers flagged (or that got 3+ dislikes): keep, remove, or restore. Removing
 * re-computes the station status from the newest remaining report. Needs supabase/moderation.sql.
 * Styled as a plain data table to match the Stations panel, rather than the driver app's
 * card feed — this is a review queue for an admin, not a driver-facing screen.
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
    <div className="h-full flex flex-col min-h-0">
      {/* toolbar */}
      <div className="h-11 shrink-0 border-b border-slate-200 flex items-center justify-between px-4 gap-3">
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
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                view === key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => void load()} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 font-semibold shrink-0">
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && <p className="p-4 text-xs text-slate-400">Loading…</p>}
        {err && <p className="p-4 text-xs font-semibold text-rose-600">{err}</p>}

        {!loading && !err && rows.length === 0 && (
          <div className="p-8 text-center">
            <p className="font-bold text-sm text-slate-900">{view === 'review' ? 'Nothing to review' : 'Nothing removed recently'}</p>
            <p className="text-xs text-slate-500 mt-1">
              {view === 'review'
                ? 'Reports appear here when drivers flag them or they get 3+ dislikes.'
                : 'Removed reports stay here for 30 days so you can restore them.'}
            </p>
          </div>
        )}

        {!loading && !err && rows.length > 0 && (
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 text-left">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 min-w-[160px]">Station</th>
                <th className="px-3 py-2 min-w-[100px]">Status</th>
                <th className="px-3 py-2 min-w-[110px]">Reporter</th>
                <th className="px-3 py-2 min-w-[90px]">Reported</th>
                <th className="px-3 py-2 min-w-[100px]">Verification</th>
                <th className="px-3 py-2 min-w-[220px]">Flags / comment</th>
                <th className="px-3 py-2 w-16">Photo</th>
                <th className="px-3 py-2 w-44" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.report_id} className={`border-b border-slate-100 ${r.open_flags > 0 ? 'bg-rose-50/40' : 'hover:bg-slate-50/70'}`}>
                  <td className="px-3 py-2 font-semibold text-slate-900 max-w-[180px] truncate" title={r.station_name}>
                    {r.station_name}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                      <span className={`w-2 h-2 rounded-full ${STATUS_DOT[r.status] || 'bg-slate-400'}`} />
                      {r.status_label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 max-w-[110px] truncate">{r.author}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatRelativeTime(r.created_at)}</td>
                  <td className="px-3 py-2 text-slate-600 capitalize">{r.verification_level.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1 mb-1">
                      {r.open_flags > 0 && (
                        <span className="rounded-md bg-rose-100 text-rose-700 px-1.5 py-0.5 font-semibold">
                          {r.open_flags} flag{r.open_flags > 1 ? 's' : ''}
                        </span>
                      )}
                      {(r.reasons || []).map((x) => (
                        <span key={x} className="rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.5">
                          {REASON_LABEL[x] || x}
                        </span>
                      ))}
                      {r.dislikes > 0 && (
                        <span className="rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.5">
                          {r.dislikes} dislike{r.dislikes > 1 ? 's' : ''}
                        </span>
                      )}
                      {r.hidden && r.hidden_reason && (
                        <span className="rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.5">{r.hidden_reason}</span>
                      )}
                    </div>
                    {r.comment && <p className="text-slate-600 max-w-[260px] truncate" title={r.comment}>&ldquo;{r.comment}&rdquo;</p>}
                  </td>
                  <td className="px-3 py-2">
                    {r.photo && (
                      <a href={r.photo} target="_blank" rel="noreferrer">
                        <img src={r.photo} alt="Report" className="w-10 h-10 rounded-lg object-cover" loading="lazy" />
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {view === 'review' ? (
                      <div className="flex gap-1.5">
                        <button
                          disabled={busyId === r.report_id}
                          onClick={() => void act(r, 'hide')}
                          className="text-[0.6875rem] px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold disabled:opacity-50"
                        >
                          Remove
                        </button>
                        <button
                          disabled={busyId === r.report_id}
                          onClick={() => void act(r, 'keep')}
                          className="text-[0.6875rem] px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 font-bold disabled:opacity-50"
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={busyId === r.report_id}
                        onClick={() => void act(r, 'restore')}
                        className="text-[0.6875rem] px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold disabled:opacity-50"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
