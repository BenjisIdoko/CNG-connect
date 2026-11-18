import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { UserEditorModal, EditableUser } from './UserEditorModal';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface Row extends EditableUser {
  reports_count: number | null;
  reputation_score: number | null;
  community_points: number | null;
}

/**
 * Full CRUD over driver accounts. Reading is a plain select (`profiles` is
 * publicly readable per schema.sql); editing and deleting go through
 * admin-only security-definer RPCs (see supabase/admin-users-crud.sql),
 * since RLS only lets a user update their own row. There's no "create" here
 * — a real account needs a real Supabase Auth user, which only the app's own
 * email-OTP sign-up can produce without a service-role key.
 */
export const UsersPanel: React.FC<{ flash: (m: string) => void }> = ({ flash }) => {
  const supabase = useSupabaseClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id,name,email,phone,state,vehicle,cng_kit,reports_count,reputation_score,community_points,is_admin')
      .order('name');
    setLoading(false);
    if (error) {
      flash(
        /cng_kit|schema cache/i.test(error.message)
          ? 'Users tab needs a migration — run supabase/add-cng-kit-field.sql in the Supabase SQL editor.'
          : `Failed to load users: ${error.message}`
      );
      return;
    }
    setRows((data || []) as Row[]);
  }, [supabase, flash]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.email, r.phone, r.state, r.vehicle].some((f) => (f || '').toLowerCase().includes(q))
    );
  }, [rows, search]);

  const editRow = editId ? rows.find((r) => r.id === editId) || null : null;
  const deleteRow = deleteId ? rows.find((r) => r.id === deleteId) || null : null;

  const confirmDelete = async () => {
    if (!supabase || !deleteRow) return;
    setDeleting(true);
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: deleteRow.id });
    setDeleting(false);
    if (error) {
      flash(
        /admin_delete_user|schema cache/i.test(error.message)
          ? 'Not set up yet — run supabase/admin-users-crud.sql in the Supabase SQL editor.'
          : `Delete failed: ${error.message}`
      );
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== deleteRow.id));
    setDeleteId(null);
    flash(`Deleted · ${deleteRow.name || deleteRow.email}`);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-adm-line bg-adm-card px-4 py-2 md:px-6">
        <span className="whitespace-nowrap text-sm font-semibold text-adm-mute-text">
          {rows.length} account{rows.length === 1 ? '' : 's'}
        </span>
        <Input
          type="search"
          aria-label="Search users"
          placeholder="Search name, email, phone or state"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading && (
          <div className="flex flex-col gap-3" aria-label="Loading users">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-adm-line bg-adm-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="min-w-[160px]">Name</TableHead>
                  <TableHead className="min-w-[200px]">Email</TableHead>
                  <TableHead className="min-w-[130px]">Phone</TableHead>
                  <TableHead className="min-w-[90px]">State</TableHead>
                  <TableHead className="min-w-[160px]">Vehicle</TableHead>
                  <TableHead className="min-w-[160px]">CNG kit</TableHead>
                  <TableHead className="min-w-[70px] text-right">Reports</TableHead>
                  <TableHead className="min-w-[80px] text-right">Reputation</TableHead>
                  <TableHead className="min-w-[70px] text-right">Points</TableHead>
                  <TableHead className="min-w-[70px]">Role</TableHead>
                  <TableHead className="min-w-[140px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-[160px] truncate font-semibold" title={r.name || ''}>
                      {r.name || <span className="font-normal italic text-adm-mute-text">(no name)</span>}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-adm-mute-text" title={r.email || ''}>
                      {r.email || '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-adm-mute-text">{r.phone || '—'}</TableCell>
                    <TableCell className="text-adm-mute-text">{r.state || '—'}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-adm-mute-text" title={r.vehicle || ''}>
                      {r.vehicle || '—'}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-adm-mute-text" title={r.cng_kit || ''}>
                      {r.cng_kit || '—'}
                    </TableCell>
                    <TableCell className="text-right text-adm-mute-text">{r.reports_count ?? 0}</TableCell>
                    <TableCell className="text-right text-adm-mute-text">{(r.reputation_score ?? 0).toFixed(1)}</TableCell>
                    <TableCell className="text-right text-adm-mute-text">{r.community_points ?? 0}</TableCell>
                    <TableCell>{r.is_admin && <Badge>Admin</Badge>}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => setEditId(r.id)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-adm-danger hover:bg-adm-danger-soft" onClick={() => setDeleteId(r.id)}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="p-4 text-sm text-adm-mute-text">{rows.length === 0 ? 'No accounts yet.' : 'Nothing matches that search.'}</p>
        )}
      </div>

      {editRow && (
        <UserEditorModal
          user={editRow}
          flash={flash}
          onClose={() => setEditId(null)}
          onSaved={(id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
        />
      )}

      <Dialog open={!!deleteRow} onOpenChange={(open) => !open && !deleting && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this account?</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-adm-ink">{deleteRow?.name || deleteRow?.email}</span> will lose access immediately.
              This permanently deletes their account, profile, reports, and posts. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
