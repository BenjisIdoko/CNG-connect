import React, { useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { buildThread, isThreadClosed, totalPending, ThreadCounts, ThreadKind } from '../../utils/adminThread';
import { isNewSince, rankQueue, QueueItem } from '../../utils/adminQueue';
import { formatRelativeTime } from '../../utils/timeUtils';
import { cn } from '../../lib/utils';

export type OverviewTarget = 'reports' | 'suggestions' | 'stations';

export interface OverviewData {
  /** null until loaded, or when loading failed. */
  counts: ThreadCounts | null;
  items: QueueItem[];
  totals: { stations: number | null; users: number | null; communityManagers: number | null };
}

interface Props {
  data: OverviewData;
  loading: boolean;
  /** Plain-language problems loading part of the Overview; empty when everything loaded. */
  errors: string[];
  lastVisitMs: number | null;
  onNavigate: (target: OverviewTarget) => void;
  onRetry: () => void;
}

const KIND_LABEL: Record<ThreadKind, string> = {
  flagged: 'Flagged report',
  suggestion: 'Suggestion',
  pin: 'Pin review',
};

const KIND_PLURAL: Record<ThreadKind, string> = {
  flagged: 'flagged reports',
  suggestion: 'suggestions',
  pin: 'pin reviews',
};

const KIND_TARGET: Record<ThreadKind, OverviewTarget> = {
  flagged: 'reports',
  suggestion: 'suggestions',
  pin: 'stations',
};

/** Notch colours carry meaning: red needs a decision, green is waiting, amber is a data fix. */
const NOTCH_CLASS: Record<ThreadKind, string> = {
  flagged: 'bg-adm-danger',
  suggestion: 'bg-adm-emerald',
  pin: 'bg-adm-lime',
};

const QUEUE_ROWS = 12;

const countText = (n: number | null): string => (n === null ? '—' : String(n));

const pctText = (part: number, total: number): string => {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
};

/**
 * The thread: a hairline with one notch for each thing waiting. When nothing is waiting it is an
 * unbroken line, the thread closed.
 */
const Thread: React.FC<{ counts: ThreadCounts }> = ({ counts }) => {
  const segments = buildThread(counts);
  const total = totalPending(counts);
  const label =
    total === 0
      ? 'Nothing needs attention'
      : `${total} waiting: ${segments.map((s) => `${s.count} ${KIND_PLURAL[s.kind]}`).join(', ')}`;
  return (
    <div role="img" aria-label={label} className="relative flex h-7 items-center">
      <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-adm-line" />
      {segments.length === 0 ? (
        <span aria-hidden="true" className="relative h-1.5 w-full rounded-full bg-adm-emerald" />
      ) : (
        <span aria-hidden="true" className="relative flex items-center gap-3 bg-adm-card pr-3">
          {segments.map((segment) => (
            <span key={segment.kind} className="flex items-center gap-[3px]">
              {Array.from({ length: segment.notches }, (_, i) => (
                <span key={i} className={`h-6 w-1.5 rounded-xs ${NOTCH_CLASS[segment.kind]}`} />
              ))}
            </span>
          ))}
        </span>
      )}
    </div>
  );
};

export const OverviewView: React.FC<Props> = ({ data, loading, errors, lastVisitMs, onNavigate, onRetry }) => {
  const { counts, items, totals } = data;
  const [kindFilter, setKindFilter] = useState<'all' | ThreadKind>('all');

  const ranked = rankQueue(items);
  const filteredItems = kindFilter === 'all' ? ranked : ranked.filter((i) => i.kind === kindFilter);
  const shown = filteredItems.slice(0, QUEUE_ROWS);
  const closed = counts !== null && isThreadClosed(counts);
  const totalWait = counts === null ? 0 : totalPending(counts);

  const regularDrivers =
    totals.users !== null && totals.communityManagers !== null
      ? Math.max(0, totals.users - totals.communityManagers)
      : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 pb-16 md:p-6">
        {errors.length > 0 && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 rounded-xl border border-adm-danger/30 bg-adm-danger-soft px-4 py-3 text-sm text-adm-danger"
          >
            <span className="flex-1 font-semibold">{errors.join(' ')}</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}

        {/* Top Row: Sypher-style Split KPI & Segmented Bar Cards */}
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left Panel: Moderation Status & Segmented Breakdown (Sypher "Invoices" card layout) */}
          <Card className="lg:col-span-7">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-base">
                  {counts === null
                    ? 'Needs attention'
                    : closed
                      ? 'All clear'
                      : `${totalPending(counts)} ${totalPending(counts) === 1 ? 'thing needs' : 'things need'} you`}
                </CardTitle>
                <CardDescription>
                  {counts === null
                    ? loading
                      ? 'Counting what is waiting…'
                      : 'Could not count what is waiting.'
                    : closed
                      ? 'No flagged reports, suggestions or pin reviews are waiting. The thread is closed.'
                      : 'Each notch is one item: flagged reports in red, suggestions in green, pin reviews in lime.'}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={onRetry} aria-label="Refresh overview" title="Refresh overview">
                <RefreshCw className="size-3.5 text-adm-mute-text" aria-hidden="true" />
              </Button>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
              {/* 3-Column Sypher Split Metrics */}
              <div className="grid grid-cols-3 divide-x divide-adm-line">
                {(['flagged', 'suggestion', 'pin'] as ThreadKind[]).map((kind, idx) => {
                  const val = counts === null ? null : counts[kind];
                  const share = counts === null || val === null ? '—' : pctText(val, totalWait);
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => onNavigate(KIND_TARGET[kind])}
                      className={cn(
                        'group flex flex-col items-start text-left outline-none transition-colors hover:bg-adm-muted/40 focus-visible:ring-2 focus-visible:ring-adm-note',
                        idx === 0 ? 'pr-4' : idx === 1 ? 'px-4' : 'pl-4',
                      )}
                    >
                      <span className="flex w-full items-center justify-between gap-1 text-[11px] font-semibold uppercase tracking-wider text-adm-mute-text">
                        <span className="truncate">{KIND_PLURAL[kind]}</span>
                        <ArrowUpRight
                          className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="mt-1 font-geist text-2xl font-bold tracking-tight text-adm-ink tabular-nums">
                        {countText(val)}
                      </span>
                      <span className="mt-3 flex items-center gap-1.5 text-xs text-adm-mute-text tabular-nums">
                        <span aria-hidden="true" className={`size-2 rounded-xs ${NOTCH_CLASS[kind]}`} />
                        {share} of queue
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sypher Proportional Segmented Bar */}
              {counts !== null && totalWait > 0 && (
                <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-full bg-adm-muted gap-0.5">
                  {counts.flagged > 0 && (
                    <div
                      className="h-full bg-adm-danger transition-all"
                      style={{ width: `${Math.max(6, Math.round((counts.flagged / totalWait) * 100))}%` }}
                    />
                  )}
                  {counts.suggestion > 0 && (
                    <div
                      className="h-full bg-adm-emerald transition-all"
                      style={{ width: `${Math.max(6, Math.round((counts.suggestion / totalWait) * 100))}%` }}
                    />
                  )}
                  {counts.pin > 0 && (
                    <div
                      className="h-full bg-adm-lime transition-all"
                      style={{ width: `${Math.max(6, Math.round((counts.pin / totalWait) * 100))}%` }}
                    />
                  )}
                </div>
              )}

              {/* Thread Notches + Legend Links */}
              <div className="flex flex-col gap-2.5 border-t border-adm-line/80 pt-3">
                {counts === null ? <Skeleton className="h-7 w-full" /> : <Thread counts={counts} />}
                <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
                  {(['flagged', 'suggestion', 'pin'] as ThreadKind[]).map((kind) => (
                    <li key={kind}>
                      <button
                        type="button"
                        onClick={() => onNavigate(KIND_TARGET[kind])}
                        className="inline-flex items-center gap-1.5 rounded-md py-0.5 font-semibold text-adm-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-adm-note"
                      >
                        <span aria-hidden="true" className={`size-2 rounded-xs ${NOTCH_CLASS[kind]}`} />
                        <span className="tabular-nums">{countText(counts === null ? null : counts[kind])}</span>
                        <span className="font-normal text-adm-mute-text">{KIND_PLURAL[kind]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Right Panel: In the app (Sypher "Deliveries" + "Costs by category" card layout) */}
          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle className="text-base">In the app</CardTitle>
              <CardDescription>Live footprint across stations, registered drivers, and ambassadors.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {/* Top Mini KPI Row with Micro Bar Visuals */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-adm-line/80 bg-adm-muted/30 p-3">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-adm-mute-text">
                    Stations
                  </span>
                  <span className="mt-1 block font-geist text-xl font-bold text-adm-ink tabular-nums">
                    {countText(totals.stations)}
                  </span>
                  <div aria-hidden="true" className="mt-2.5 flex items-end gap-[2px] h-4">
                    {[65, 80, 75, 90, 85, 100, 95, 100].map((h, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-[1px] bg-adm-emerald"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-adm-line/80 bg-adm-muted/30 p-3">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-adm-mute-text">
                    Accounts
                  </span>
                  <span className="mt-1 block font-geist text-xl font-bold text-adm-ink tabular-nums">
                    {countText(totals.users)}
                  </span>
                  <div aria-hidden="true" className="mt-2.5 flex items-end gap-[2px] h-4">
                    {[40, 55, 60, 70, 80, 85, 92, 100].map((h, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-[1px] bg-adm-emerald/80"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-adm-line/80 bg-adm-muted/30 p-3">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-adm-mute-text">
                    Managers
                  </span>
                  <span className="mt-1 block font-geist text-xl font-bold text-adm-ink tabular-nums">
                    {countText(totals.communityManagers)}
                  </span>
                  <div aria-hidden="true" className="mt-2.5 flex items-center h-4">
                    <span className="h-2 w-full rounded-full bg-gradient-to-r from-adm-lime to-adm-emerald" />
                  </div>
                </div>
              </div>

              {/* Sypher "Costs by category" Dotted-Leader Breakdown */}
              <dl className="flex flex-col divide-y divide-adm-line/70 text-[13px]">
                {(
                  [
                    ['Stations', totals.stations, 'bg-adm-emerald'],
                    ['Users', totals.users, 'bg-adm-lime'],
                    ['Community managers', totals.communityManagers, 'bg-adm-ink'],
                  ] as [string, number | null, string][]
                ).map(([label, value, dotCls]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <dt className="flex items-center gap-2 text-adm-mute-text">
                      <span aria-hidden="true" className={`size-2 shrink-0 rounded-xs ${dotCls}`} />
                      <span>{label}</span>
                    </dt>
                    <dd className="font-geist-mono font-semibold text-adm-ink tabular-nums">{countText(value)}</dd>
                  </div>
                ))}
                {regularDrivers !== null && totals.users !== null && totals.users > 0 && (
                  <div className="flex items-center justify-between gap-3 pt-2.5 text-xs text-adm-mute-text">
                    <span>Driver to manager ratio</span>
                    <span className="font-geist-mono font-medium tabular-nums">
                      {regularDrivers} drivers · {pctText(totals.communityManagers ?? 0, totals.users)} managers
                    </span>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Panel: Work Queue Table with Sypher Inline Filter Pills */}
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Work queue</CardTitle>
              <CardDescription>
                Oldest first. Highlighted rows mark flags and suggestions new since you last opened this page.
              </CardDescription>
            </div>
            {ranked.length > 0 && (
              <div role="tablist" aria-label="Filter work queue" className="flex flex-wrap items-center gap-1">
                {(
                  [
                    ['all', 'All', ranked.length],
                    ['flagged', 'Flagged', counts?.flagged ?? 0],
                    ['suggestion', 'Suggestions', counts?.suggestion ?? 0],
                    ['pin', 'Pin reviews', counts?.pin ?? 0],
                  ] as const
                ).map(([key, label, count]) => {
                  const active = kindFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setKindFilter(key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-adm-note',
                        active ? 'bg-adm-muted text-adm-ink' : 'text-adm-mute-text hover:text-adm-ink',
                      )}
                    >
                      {label}
                      <span className="text-[11px] text-adm-mute-text tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardHeader>
          {loading && items.length === 0 ? (
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          ) : shown.length === 0 ? (
            <CardContent>
              <p className="text-sm text-adm-mute-text">
                {counts === null ? 'The queue could not be loaded.' : 'Nothing is waiting. New flags and suggestions will appear here.'}
              </p>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="hidden sm:table-cell">Waiting</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((item) => {
                  const isNew = isNewSince(item.createdAt, lastVisitMs);
                  return (
                    <TableRow key={`${item.kind}-${item.id}`} data-state={isNew ? 'new' : undefined}>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={item.kind === 'flagged' ? 'destructive' : item.kind === 'pin' ? 'warning' : 'secondary'}>
                          {KIND_LABEL[item.kind]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[13rem] sm:max-w-[22rem]">
                        <Badge
                          variant={item.kind === 'flagged' ? 'destructive' : item.kind === 'pin' ? 'warning' : 'secondary'}
                          className="mb-1 sm:hidden"
                        >
                          {KIND_LABEL[item.kind]}
                        </Badge>
                        <p className="truncate font-semibold text-adm-ink">
                          {item.title}
                          {isNew && (
                            <Badge variant="new" className="ml-2 align-middle">
                              New
                            </Badge>
                          )}
                        </p>
                        {item.detail && <p className="truncate text-xs text-adm-mute-text">{item.detail}</p>}
                        <p className="text-xs text-adm-mute-text sm:hidden">{item.createdAt ? formatRelativeTime(item.createdAt) : 'Date unknown'}</p>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-adm-mute-text sm:table-cell">
                        {item.createdAt ? formatRelativeTime(item.createdAt) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => onNavigate(KIND_TARGET[item.kind])}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {filteredItems.length > shown.length && (
            <p className="border-t border-adm-line px-5 py-3 text-xs text-adm-mute-text">
              Showing the {shown.length} oldest of {filteredItems.length}. Open a section to see the rest.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};
