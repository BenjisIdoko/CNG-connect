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
  /** Ids of accounts that manage at least one station; they get a "Station manager" label. */
  managerIds?: Set<string>;
}

/**
 * The user directory table: search, filter, sort and page through every driver account. It only
 * draws and reorganises the rows it is given; loading, editing and deleting live in UsersPanel.
 */
export const UsersDirectory: React.FC<DirectoryProps> = ({ rows, loading, onEdit, onDelete, flash, managerIds }) => {
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
  const filtered = useMemo(() => filterUsers(rows, { search, role, state: stateFilter, kit }), [rows, search, role, stateFilter, kit]);
  const sorted = useMemo(() => sortUsers(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);
  const view = paginate(sorted, page, pageSize);
  const anyFilter = Boolean(search.trim() || role !== 'all' || stateFilter || kit);

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
      r.is_admin ? 'admin' : 'driver',
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
        'shrink-0 rounded-md px-3 py-1.5 max-md:min-h-11 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-adm-note focus-visible:ring-offset-2 focus-visible:ring-offset-adm-card',
        kit === value ? 'bg-adm-note text-white' : 'bg-adm-muted text-adm-ink hover:bg-adm-line',
      )}
    >
      {label}
    </button>
  );

  const iconBtn = 'size-9 max-md:size-11';

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 pb-16 md:p-6">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-geist text-2xl font-bold text-balance">User directory</h2>
            <Badge variant="secondary" className="text-sm">
              {rows.length} {rows.length === 1 ? 'user' : 'users'}
            </Badge>
          </div>
          <p className="text-sm text-adm-mute-text">Search, filter and manage driver accounts. Admin access can only be changed in the database.</p>
        </div>

        <div className="rounded-lg border border-adm-line bg-adm-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[16rem] flex-1">
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
                className="h-10 pl-9"
              />
            </div>
            <Button variant="outline" onClick={exportCsv} disabled={sorted.length === 0} className="h-10">
              <Download aria-hidden="true" /> Export CSV
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-adm-line pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-sm text-adm-mute-text">
                <SlidersHorizontal className="size-4" aria-hidden="true" /> Filters:
              </span>
              <select
                aria-label="Role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as RoleFilter);
                  resetPage();
                }}
                className={selectCls}
              >
                <option value="all">All roles</option>
                <option value="admin">Admins</option>
                <option value="driver">Drivers</option>
              </select>
              <select
                aria-label="State"
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  resetPage();
                }}
                className={selectCls}
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
            <div className="flex items-center gap-3">
              <span className="inline-flex shrink-0 items-center gap-2 text-sm text-adm-mute-text">
                <SlidersHorizontal className="size-4" aria-hidden="true" /> CNG kit:
              </span>
              <div className="flex gap-2 overflow-x-auto py-1">
                {chip('', 'All')}
                {kits.map((k) => chip(k, k))}
                {chip(KIT_NONE, 'Not installed yet')}
              </div>
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
          <div className="overflow-hidden rounded-lg border border-adm-line bg-adm-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-adm-muted/60 hover:bg-adm-muted/60">
                  <SortHead label="User" sortKey="name" active={sortKey} dir={sortDir} onSort={onSort} className="min-w-[190px] pl-4" />
                  <SortHead label="State" sortKey="state" active={sortKey} dir={sortDir} onSort={onSort} className="min-w-[80px]" />
                  <TableHead className="min-w-[120px]">Vehicle</TableHead>
                  <SortHead label="CNG kit" sortKey="kit" active={sortKey} dir={sortDir} onSort={onSort} className="min-w-[180px]" />
                  <SortHead label="Role" sortKey="role" active={sortKey} dir={sortDir} onSort={onSort} className="min-w-[80px]" />
                  <SortHead label="Activity" sortKey="reports" active={sortKey} dir={sortDir} onSort={onSort} className="min-w-[120px]" />
                  <SortHead label="Email" sortKey="email" active={sortKey} dir={sortDir} onSort={onSort} className="min-w-[190px]" />
                  <TableHead className="w-[88px] pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.items.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-adm-muted text-sm font-semibold text-adm-note"
                        >
                          {userInitials(r.name, r.email)}
                        </span>
                        <div className="min-w-0">
                          <p className="max-w-[170px] truncate font-semibold" title={r.name || ''}>
                            {r.name || <span className="font-normal italic text-adm-mute-text">(no name)</span>}
                          </p>
                          <p className="text-xs text-adm-mute-text">{r.phone || 'No phone'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-adm-mute-text">{r.state || '—'}</TableCell>
                    <TableCell className="max-w-[130px] truncate text-adm-mute-text" title={r.vehicle || ''}>
                      {r.vehicle || '—'}
                    </TableCell>
                    <TableCell>
                      {r.cng_kit ? (
                        <span className="inline-flex max-w-[190px] items-center gap-2 rounded-full border border-adm-line bg-adm-card px-3 py-1 text-sm">
                          <span aria-hidden="true" className="size-2 shrink-0 rounded-sm bg-adm-note" />
                          <span className="truncate" title={r.cng_kit}>
                            {r.cng_kit}
                          </span>
                        </span>
                      ) : (
                        <span className="text-adm-mute-text">Not installed yet</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.is_admin ? (
                        <Badge>Admin</Badge>
                      ) : managerIds?.has(r.id) ? (
                        <Badge variant="outline">Station manager</Badge>
                      ) : (
                        <span className="text-adm-mute-text">Driver</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{r.reports_count ?? 0} reports</p>
                      <p className="text-xs text-adm-mute-text">
                        {(r.reputation_score ?? 0).toFixed(1)} rating · {r.community_points ?? 0} pts
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[190px] truncate text-adm-mute-text" title={r.email || ''}>
                      {r.email || '—'}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1">
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
          <div className="rounded-lg border border-adm-line bg-adm-card p-8 text-center">
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
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-adm-mute-text">
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
