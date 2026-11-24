import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { formatRelativeTime } from '../../utils/timeUtils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

type QueueRow = {
  report_id: string;
  station_id: string;
  station_name: string;
  author: string;
  status: 'full' | 'low' | 'queue' | 'out'; // 'low' only on reports filed before low pressure was retired
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
  full: 'bg-adm-note',
  queue: 'bg-adm-warn',
  low: 'bg-adm-mute-text',
  out: 'bg-adm-danger',
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
    <div className="h-full overflow-x-hidden overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 pb-16 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-adm-line bg-adm-card px-4 py-3 shadow-[0_1px_2px_rgba(17,24,20,0.03)]">
          <div className="flex items-center gap-3">
            <Tabs value={view} onValueChange={(v) => setView(v as 'review' | 'hidden')}>
              <TabsList aria-label="Report view">
                <TabsTrigger value="review">Needs review</TabsTrigger>
                <TabsTrigger value="hidden">Removed (30 days)</TabsTrigger>
              </TabsList>
            </Tabs>
            {!loading && (
              <Badge variant="secondary" className="text-xs">
                {rows.length} {rows.length === 1 ? 'report' : 'reports'}
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          {loading && (
            <div className="flex flex-col gap-3" aria-label="Loading reports">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {err && (
            <p role="alert" className="rounded-xl border border-adm-danger/30 bg-adm-danger-soft px-4 py-3 text-sm font-semibold text-adm-danger">
              {err}
            </p>
          )}

          {!loading && !err && rows.length === 0 && (
            <div className="mx-auto w-full max-w-md rounded-xl border border-adm-line bg-adm-card p-8 text-center shadow-[0_1px_2px_rgba(17,24,20,0.03)]">
              <p className="font-geist text-base font-bold text-adm-ink">{view === 'review' ? 'Nothing to review' : 'Nothing removed recently'}</p>
              <p className="mt-1 text-sm text-adm-mute-text">
                {view === 'review'
                  ? 'Reports appear here when drivers flag them or they get 3+ dislikes.'
                  : 'Removed reports stay here for 30 days so you can restore them.'}
              </p>
            </div>
          )}

          {!loading && !err && rows.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-adm-line bg-adm-card shadow-[0_1px_2px_rgba(17,24,20,0.03)]">
              <Table className="table-fixed max-md:block">
                <TableHeader className="max-md:hidden">
                  <TableRow className="bg-adm-muted/50 hover:bg-adm-muted/50">
                    <TableHead className="w-[26%] pl-4">Station</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="hidden lg:table-cell lg:w-32">Reporter</TableHead>
                    <TableHead className="w-24">Reported</TableHead>
                    <TableHead className="hidden xl:table-cell xl:w-32">Verification</TableHead>
                    <TableHead>Flags / comment</TableHead>
                    <TableHead className="w-16">Photo</TableHead>
                    <TableHead className="w-36 pr-4 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="max-md:block max-md:divide-y max-md:divide-adm-line">
                  {rows.map((r) => (
                    <TableRow key={r.report_id} className="max-md:flex max-md:flex-col max-md:gap-2 max-md:p-4">
                      <TableCell className="pl-4 truncate font-semibold max-md:p-0" title={r.station_name}>
                        {r.station_name}
                      </TableCell>
                      <TableCell className="max-md:p-0">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <span aria-hidden="true" className={`size-2 rounded-sm ${STATUS_DOT[r.status] || 'bg-adm-line'}`} />
                          {r.status_label}
                        </span>
                      </TableCell>
                      <TableCell className="hidden truncate text-adm-mute-text lg:table-cell">{r.author}</TableCell>
                      <TableCell className="whitespace-nowrap text-adm-mute-text max-md:p-0 max-md:text-xs">
                        {formatRelativeTime(r.created_at)}
                      </TableCell>
                      <TableCell className="hidden truncate capitalize text-adm-mute-text xl:table-cell">
                        {r.verification_level.replace(/_/g, ' ')}
                      </TableCell>
                      <TableCell className="max-md:p-0">
                        <div className="mb-1 flex flex-wrap gap-1">
                          {r.open_flags > 0 && (
                            <Badge variant="destructive">
                              {r.open_flags} flag{r.open_flags > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {(r.reasons || []).map((x) => (
                            <Badge key={x} variant="secondary">
                              {REASON_LABEL[x] || x}
                            </Badge>
                          ))}
                          {r.dislikes > 0 && (
                            <Badge variant="secondary">
                              {r.dislikes} dislike{r.dislikes > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {r.hidden && r.hidden_reason && <Badge variant="secondary">{r.hidden_reason}</Badge>}
                        </div>
                        {r.comment && (
                          <p className="truncate text-adm-mute-text" title={r.comment}>
                            &ldquo;{r.comment}&rdquo;
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="max-md:p-0">
                        {r.photo && (
                          <a href={r.photo} target="_blank" rel="noreferrer" aria-label={`Open the photo for ${r.station_name}`}>
                            <img src={r.photo} alt="" className="size-10 rounded-md border border-adm-line object-cover" loading="lazy" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right max-md:p-0 max-md:text-left">
                        {view === 'review' ? (
                          <div className="flex justify-end gap-1.5 max-md:justify-start">
                            <Button variant="destructive" size="sm" disabled={busyId === r.report_id} onClick={() => void act(r, 'hide')}>
                              Remove
                            </Button>
                            <Button variant="default" size="sm" disabled={busyId === r.report_id} onClick={() => void act(r, 'keep')}>
                              Keep
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" disabled={busyId === r.report_id} onClick={() => void act(r, 'restore')}>
                            Restore
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
