import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Download,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import type { EditableUser } from './UserEditorModal';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toCsv } from '../../utils/csv';
import { cn } from '../../lib/utils';
import {
  KIT_NONE,
  RoleFilter,
  SortDir,
  UserSortKey,
  distinctKits,
  distinctStates,
  filterUsers,
  paginate,
  sortUsers,
  userInitials,
} from '../../utils/userDirectory';

const PAGE_SIZES = [10, 25, 50, 100];

const selectCls =
  'h-10 rounded-md border border-adm-line bg-adm-card px-3 text-sm text-adm-ink outline-none transition-colors focus-visible:border-adm-note focus-visible:ring-2 focus-visible:ring-adm-note';

/** A column heading that sorts the table; the arrow shows the current sort. */
const SortHead: React.FC<{
  label: string;
  sortKey: UserSortKey;
  active: UserSortKey;
  dir: SortDir;
  onSort: (k: UserSortKey) => void;
  className?: string;
}> = ({ label, sortKey, active, dir, onSort, className }) => {
  const on = active === sortKey;
  return (
    <TableHead className={className} aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 rounded-sm font-semibold text-adm-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-adm-note"
      >
        {label}
        {on && (dir === 'asc' ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />)}
      </button>
    </TableHead>
  );
};

export interface DirectoryRow extends EditableUser {
  reports_count: number | null;
  reputation_score: number | null;
  community_points: number | null;
}

interface DirectoryProps {
  rows: DirectoryRow[];
  loading: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** Called after an export so the screen can announce it. */
  flash: (m: string) => void;
  /** Ids of accounts with the community manager role; they get a "Community manager" label. */
  communityManagerIds?: Set<string>;
}

/**
 * The user directory table: search, filter, sort and page through every driver account. It only
 * draws and reorganises the rows it is given; loading, editing and deleting live in UsersPanel.
 */
export const UsersDirectory: React.FC<DirectoryProps> = ({ rows, loading, onEdit, onDelete, flash, communityManagerIds }) => {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [stateFilter, setStateFilter] = useState('');
  const [kit, setKit] = useState('');
  const [sortKey, setSortKey] = useState<UserSortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const kits = useMemo(() => distinctKits(rows), [rows]);
  const states = useMemo(() => distinctStates(rows), [rows]);
  const filtered = useMemo(
    () => filterUsers(rows, { search, role, state: stateFilter, kit, communityManagerIds }),
    [rows, search, role, stateFilter, kit, communityManagerIds],
  );
  const sorted = useMemo(() => sortUsers(filtered, sortKey, sortDir, communityManagerIds), [filtered, sortKey, sortDir, communityManagerIds]);
  const view = paginate(sorted, page, pageSize);
  const anyFilter = Boolean(search.trim() || role !== 'all' || stateFilter || kit);

  const summary = useMemo(() => {
    const total = rows.length;
    let admins = 0;
    let managers = 0;
    let withKit = 0;
    for (const r of rows) {
      if (r.is_admin) admins++;
      else if (communityManagerIds?.has(r.id)) managers++;
      if ((r.cng_kit || '').trim()) withKit++;
    }
    const drivers = Math.max(0, total - admins - managers);
    const noKit = Math.max(0, total - withKit);
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      admins,
      managers,
      drivers,
      withKit,
      noKit,
      driversPct: pct(drivers),
      managersPct: pct(managers),
      adminsPct: pct(admins),
      kitPct: pct(withKit),
      noKitPct: pct(noKit),
    };
  }, [rows, communityManagerIds]);

  const resetPage = () => setPage(1);
  const onSort = (key: UserSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
    resetPage();
  };
  const clearFilters = () => {
    setSearch('');
    setRole('all');
    setStateFilter('');
    setKit('');
    resetPage();
  };

  /** Downloads exactly what the filters and sort currently show, not just the visible page. */
  const exportCsv = () => {
    const headers = ['name', 'email', 'phone', 'state', 'vehicle', 'cng_kit', 'reports', 'reputation', 'points', 'role'];
    const data = sorted.map((r) => [
      r.name ?? '',
      r.email ?? '',
      r.phone ?? '',
      r.state ?? '',
      r.vehicle ?? '',
      r.cng_kit ?? '',
      r.reports_count ?? 0,
      (r.reputation_score ?? 0).toFixed(1),
      r.community_points ?? 0,
      r.is_admin ? 'admin' : communityManagerIds?.has(r.id) ? 'community manager' : 'driver',
    ]);
    const blob = new Blob([toCsv(headers, data)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash(`Exported ${sorted.length} user${sorted.length === 1 ? '' : 's'}`);
  };

  const chip = (value: string, label: string) => (
    <button
      key={value || 'all'}
      type="button"
      aria-pressed={kit === value}
      onClick={() => {
        setKit(value);
        resetPage();
      }}
      className={cn(
        'max-w-full truncate rounded-md px-2.5 py-1.5 max-md:min-h-10 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-adm-note focus-visible:ring-offset-2 focus-visible:ring-offset-adm-card',
        kit === value ? 'bg-adm-note text-white' : 'bg-adm-muted text-adm-ink hover:bg-adm-line',
      )}
    >
      {label}
    </button>
  );

  const iconBtn = 'size-8 max-md:size-10';

  return (
    <div className="h-full overflow-x-hidden overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 pb-16 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-geist text-xl font-bold tracking-tight text-balance text-adm-ink">User directory</h2>
              <Badge variant="secondary" className="text-xs">
                {rows.length} {rows.length === 1 ? 'user' : 'users'}
              </Badge>
            </div>
            <p className="text-xs text-adm-mute-text">
              Search, filter and manage driver accounts. Admin access can only be changed in the database.
            </p>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={sorted.length === 0} className="h-9 shrink-0">
            <Download aria-hidden="true" /> Export CSV
          </Button>
        </div>

        {/* Sypher Split KPI & Segmented Bar Row */}
        {!loading && rows.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Role Breakdown Card (Sypher "Invoices" style) */}
            <div className="flex flex-col justify-between gap-3.5 rounded-xl border border-adm-line bg-adm-card p-4 shadow-[0_1px_2px_rgba(17,24,20,0.03)] lg:col-span-7">
              <div className="grid grid-cols-3 divide-x divide-adm-line">
                <div className="pr-3 sm:pr-4">
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-adm-mute-text">Drivers</span>
                  <span className="mt-1 block font-geist text-xl font-bold tracking-tight text-adm-ink tabular-nums sm:text-2xl">
                    {summary.drivers}
                  </span>
                  <span className="mt-1.5 block text-xs text-adm-mute-text tabular-nums">{summary.driversPct}%</span>
                </div>
                <div className="px-3 sm:px-4">
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-adm-mute-text">Managers</span>
                  <span className="mt-1 block font-geist text-xl font-bold tracking-tight text-adm-ink tabular-nums sm:text-2xl">
                    {summary.managers}
                  </span>
                  <span className="mt-1.5 block text-xs text-adm-mute-text tabular-nums">{summary.managersPct}%</span>
                </div>
                <div className="pl-3 sm:pl-4">
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-adm-mute-text">Admins</span>
                  <span className="mt-1 block font-geist text-xl font-bold tracking-tight text-adm-ink tabular-nums sm:text-2xl">
                    {summary.admins}
                  </span>
                  <span className="mt-1.5 block text-xs text-adm-mute-text tabular-nums">{summary.adminsPct}%</span>
                </div>
              </div>
              <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-full bg-adm-muted gap-0.5">
                {summary.drivers > 0 && (
                  <div className="h-full bg-[#16a34a]" style={{ width: `${Math.max(4, summary.driversPct)}%` }} />
                )}
                {summary.managers > 0 && (
                  <div className="h-full bg-[#84cc16]" style={{ width: `${Math.max(4, summary.managersPct)}%` }} />
                )}
                {summary.admins > 0 && (
                  <div className="h-full bg-adm-ink" style={{ width: `${Math.max(4, summary.adminsPct)}%` }} />
                )}
              </div>
            </div>

            {/* CNG Kit Conversion Coverage Card */}
            <div className="flex flex-col justify-between gap-3.5 rounded-xl border border-adm-line bg-adm-card p-4 shadow-[0_1px_2px_rgba(17,24,20,0.03)] lg:col-span-5">
              <div className="grid grid-cols-2 divide-x divide-adm-line">
                <div className="pr-3 sm:pr-4">
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-adm-mute-text">Kit Recorded</span>
                  <span className="mt-1 block font-geist text-xl font-bold tracking-tight text-adm-ink tabular-nums sm:text-2xl">
                    {summary.withKit}
                  </span>
                  <span className="mt-1.5 block text-xs font-semibold text-[#16a34a] tabular-nums">{summary.kitPct}%</span>
                </div>
                <div className="pl-3 sm:pl-4">
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-wider text-adm-mute-text">No Kit Recorded</span>
                  <span className="mt-1 block font-geist text-xl font-bold tracking-tight text-adm-ink tabular-nums sm:text-2xl">
                    {summary.noKit}
                  </span>
                  <span className="mt-1.5 block text-xs text-adm-mute-text tabular-nums">{summary.noKitPct}%</span>
                </div>
              </div>
              <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-full bg-adm-muted gap-0.5">
                {summary.withKit > 0 && (
                  <div className="h-full bg-[#16a34a]" style={{ width: `${Math.max(4, summary.kitPct)}%` }} />
                )}
                {summary.noKit > 0 && (
                  <div className="h-full bg-adm-line" style={{ width: `${Math.max(4, summary.noKitPct)}%` }} />
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-adm-line bg-adm-card p-4 shadow-[0_1px_2px_rgba(17,24,20,0.03)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-adm-mute-text" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Search users"
                placeholder="Search by name, email, phone, state or vehicle"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
                className="h-10 w-full pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-adm-mute-text">
                <SlidersHorizontal className="size-3.5" aria-hidden="true" /> Filters:
              </span>
              <select
                aria-label="Role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as RoleFilter);
                  resetPage();
                }}
                className={cn(selectCls, 'max-sm:flex-1 min-w-0')}
              >
                <option value="all">All roles</option>
                <option value="admin">Admins</option>
                <option value="community_manager">Community managers</option>
                <option value="driver">Drivers</option>
              </select>
              <select
                aria-label="State"
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  resetPage();
                }}
                className={cn(selectCls, 'max-sm:flex-1 min-w-0')}
              >
                <option value="">All states</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {anyFilter && (
                <Button variant="link" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-adm-line/80 pt-3">
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-adm-mute-text">
              CNG kit:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {chip('', 'All')}
              {kits.map((k) => chip(k, k))}
              {chip(KIT_NONE, 'Not installed yet')}
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col gap-3" aria-label="Loading users">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {!loading && view.total > 0 && (
          <div className="overflow-hidden rounded-xl border border-adm-line bg-adm-card shadow-[0_1px_2px_rgba(17,24,20,0.03)]">
            <Table className="table-fixed max-md:block">
              <TableHeader className="max-md:hidden">
                <TableRow className="bg-adm-muted/50 hover:bg-adm-muted/50">
                  <SortHead label="User" sortKey="name" active={sortKey} dir={sortDir} onSort={onSort} className="pl-4" />
                  <SortHead label="State" sortKey="state" active={sortKey} dir={sortDir} onSort={onSort} className="w-24 lg:w-28" />
                  <TableHead className="hidden xl:table-cell xl:w-36">Vehicle</TableHead>
                  <SortHead label="CNG kit" sortKey="kit" active={sortKey} dir={sortDir} onSort={onSort} className="hidden lg:table-cell lg:w-44" />
                  <SortHead label="Role" sortKey="role" active={sortKey} dir={sortDir} onSort={onSort} className="w-32 lg:w-36" />
                  <SortHead label="Activity" sortKey="reports" active={sortKey} dir={sortDir} onSort={onSort} className="w-32 lg:w-36" />
                  <SortHead label="Email" sortKey="email" active={sortKey} dir={sortDir} onSort={onSort} className="w-40 lg:w-44" />
                  <TableHead className="w-20 pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="max-md:block max-md:divide-y max-md:divide-adm-line">
                {view.items.map((r) => (
                  <TableRow
                    key={r.id}
                    className="max-md:grid max-md:grid-cols-[1fr_auto] max-md:items-start max-md:gap-x-3 max-md:gap-y-2 max-md:p-4"
                  >
                    <TableCell className="pl-4 max-md:col-span-1 max-md:p-0">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          aria-hidden="true"
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-adm-line bg-adm-muted text-xs font-bold text-adm-ink"
                        >
                          {userInitials(r.name, r.email)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-adm-ink" title={r.name || ''}>
                            {r.name || <span className="font-normal italic text-adm-mute-text">(no name)</span>}
                          </p>
                          <p className="truncate text-xs text-adm-mute-text">{r.phone || 'No phone'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="truncate text-adm-mute-text max-md:col-span-2 max-md:p-0 max-md:text-xs">
                      {r.state || '—'}
                    </TableCell>
                    <TableCell className="hidden truncate text-adm-mute-text xl:table-cell" title={r.vehicle || ''}>
                      {r.vehicle || '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-md:col-span-2 max-md:block max-md:p-0">
                      {r.cng_kit ? (
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-adm-line bg-adm-muted/40 px-2.5 py-0.5 text-xs font-medium text-adm-ink">
                          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[#16a34a]" />
                          <span className="truncate" title={r.cng_kit}>
                            {r.cng_kit}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-adm-mute-text">Not installed yet</span>
                      )}
                    </TableCell>
                    <TableCell className="max-md:col-span-1 max-md:p-0">
                      {r.is_admin ? (
                        <Badge>Admin</Badge>
                      ) : communityManagerIds?.has(r.id) ? (
                        <Badge variant="outline">Community manager</Badge>
                      ) : (
                        <span className="text-xs text-adm-mute-text">Driver</span>
                      )}
                    </TableCell>
                    <TableCell className="max-md:col-span-1 max-md:p-0 max-md:text-right">
                      <p className="truncate font-semibold text-adm-ink">{r.reports_count ?? 0} reports</p>
                      <p className="truncate text-xs text-adm-mute-text">
                        {(r.reputation_score ?? 0).toFixed(1)} rating · {r.community_points ?? 0} pts
                      </p>
                    </TableCell>
                    <TableCell className="truncate text-adm-mute-text max-md:col-span-2 max-md:p-0 max-md:text-xs" title={r.email || ''}>
                      {r.email || '—'}
                    </TableCell>
                    <TableCell className="pr-3 max-md:col-start-2 max-md:row-start-1 max-md:p-0">
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="icon-sm" className={iconBtn} aria-label={`Edit ${r.name || r.email}`} onClick={() => onEdit(r.id)}>
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={cn(iconBtn, 'text-adm-danger hover:bg-adm-danger-soft')}
                          aria-label={`Delete ${r.name || r.email}`}
                          onClick={() => onDelete(r.id)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!loading && view.total === 0 && (
          <div className="rounded-xl border border-adm-line bg-adm-card p-8 text-center shadow-[0_1px_2px_rgba(17,24,20,0.03)]">
            <p className="font-geist text-base font-bold">{rows.length === 0 ? 'No accounts yet' : 'No users match'}</p>
            <p className="mt-1 text-sm text-adm-mute-text">
              {rows.length === 0 ? 'Accounts appear here when drivers sign up.' : 'Try a different search, or clear the filters.'}
            </p>
            {anyFilter && (
              <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-adm-mute-text">
            <div className="flex items-center gap-3">
              <label htmlFor="users-page-size">Rows per page:</label>
              <select
                id="users-page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  resetPage();
                }}
                className={selectCls}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span aria-live="polite">
                Page {view.page} of {view.pageCount} ({view.total} {view.total === 1 ? 'user' : 'users'})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" aria-label="First page" disabled={view.page <= 1} onClick={() => setPage(1)}>
                <ChevronsLeft aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Previous page" disabled={view.page <= 1} onClick={() => setPage(view.page - 1)}>
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Next page" disabled={view.page >= view.pageCount} onClick={() => setPage(view.page + 1)}>
                <ChevronRight aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Last page" disabled={view.page >= view.pageCount} onClick={() => setPage(view.pageCount)}>
                <ChevronsRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
