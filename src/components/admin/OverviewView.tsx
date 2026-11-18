import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { buildThread, isThreadClosed, totalPending, ThreadCounts, ThreadKind } from '../../utils/adminThread';
import { isNewSince, rankQueue, QueueItem } from '../../utils/adminQueue';
import { formatRelativeTime } from '../../utils/timeUtils';

export type OverviewTarget = 'reports' | 'suggestions' | 'stations';

export interface OverviewData {
  /** null until loaded, or when loading failed. */
  counts: ThreadCounts | null;
  items: QueueItem[];
  totals: { stations: number | null; users: number | null; managers: number | null };
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
  suggestion: 'bg-adm-note',
  pin: 'bg-adm-warn',
};

const QUEUE_ROWS = 12;

const countText = (n: number | null): string => (n === null ? '—' : String(n));

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
    <div role="img" aria-label={label} className="relative flex h-8 items-center">
      <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-adm-note" />
      {segments.length > 0 && (
        <span aria-hidden="true" className="relative flex items-center gap-3 bg-adm-card pr-3">
          {segments.map((segment) => (
            <span key={segment.kind} className="flex items-center gap-[3px]">
              {Array.from({ length: segment.notches }, (_, i) => (
                <span key={i} className={`h-7 w-1.5 rounded-sm ${NOTCH_CLASS[segment.kind]}`} />
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
  const ranked = rankQueue(items);
  const shown = ranked.slice(0, QUEUE_ROWS);
  const closed = counts !== null && isThreadClosed(counts);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-16 md:p-6">
        {errors.length > 0 && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-adm-danger/30 bg-adm-danger-soft px-4 py-3 text-sm text-adm-danger">
            <span className="flex-1 font-semibold">{errors.join(' ')}</span>
            <Button variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
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
                  : 'Each notch is one item: flagged reports in red, suggestions in green, pin reviews in amber.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {counts === null ? <Skeleton className="h-8 w-full" /> : <Thread counts={counts} />}
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {(['flagged', 'suggestion', 'pin'] as ThreadKind[]).map((kind) => (
                <li key={kind}>
                  <button
                    type="button"
                    onClick={() => onNavigate(KIND_TARGET[kind])}
                    className="inline-flex items-center gap-2 rounded-md py-1 font-semibold text-adm-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-adm-note"
                  >
                    <span aria-hidden="true" className={`size-2.5 rounded-sm ${NOTCH_CLASS[kind]}`} />
                    <span className="tabular-nums">{countText(counts === null ? null : counts[kind])}</span>
                    <span className="font-normal text-adm-mute-text">{KIND_PLURAL[kind]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Work queue</CardTitle>
              <CardDescription>Oldest first. Gold marks flags and suggestions new since you last opened this page.</CardDescription>
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
                        <TableCell className="max-w-[13rem] sm:max-w-[18rem]">
                          <Badge
                            variant={item.kind === 'flagged' ? 'destructive' : item.kind === 'pin' ? 'warning' : 'secondary'}
                            className="mb-1 sm:hidden"
                          >
                            {KIND_LABEL[item.kind]}
                          </Badge>
                          <p className="truncate font-semibold">
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
            {ranked.length > shown.length && (
              <p className="border-t border-adm-line px-5 py-3 text-xs text-adm-mute-text">
                Showing the {shown.length} oldest of {ranked.length}. Open a section to see the rest.
              </p>
            )}
          </Card>

          <Card className="self-start">
            <CardHeader>
              <CardTitle>In the app</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col divide-y divide-adm-line text-sm">
                {(
                  [
                    ['Stations', totals.stations],
                    ['Users', totals.users],
                    ['Station managers', totals.managers],
                  ] as [string, number | null][]
                ).map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <dt className="text-adm-mute-text">{label}</dt>
                    <dd className="font-geist-mono font-semibold tabular-nums">{countText(value)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
