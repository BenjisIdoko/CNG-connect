import React, { useCallback, useEffect, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { UserEditorModal } from './UserEditorModal';
import { UsersDirectory, DirectoryRow } from './UsersDirectory';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

/**
 * Full CRUD over driver accounts. Reading is a plain select (`profiles` is publicly readable per
 * schema.sql); editing and deleting go through admin-only security-definer RPCs
 * (supabase/admin-users-crud.sql), since RLS only lets a user update their own row. There is no
 * "create" here: a real account needs a real Supabase Auth user, which only the app's own
 * email-OTP sign-up can produce without a service-role key.
 */
export const UsersPanel: React.FC<{ flash: (m: string) => void }> = ({ flash }) => {
  const supabase = useSupabaseClient();
  const [rows, setRows] = useState<DirectoryRow[]>([]);
  const [communityManagerIds, setCommunityManagerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
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
    setRows((data || []) as DirectoryRow[]);
    // Who has the community manager role (the admin may read every row; before the migration this is empty).
    const { data: community } = await supabase.from('community_managers').select('user_id');
    setCommunityManagerIds(new Set((community || []).map((m) => m.user_id as string)));
  }, [supabase, flash]);

  useEffect(() => {
    void load();
  }, [load]);

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
    <>
      <UsersDirectory rows={rows} loading={loading} onEdit={setEditId} onDelete={setDeleteId} flash={flash} communityManagerIds={communityManagerIds} />

      {editRow && (
        <UserEditorModal
          user={editRow}
          flash={flash}
          isCommunityManager={communityManagerIds.has(editRow.id)}
          onCommunityManagerChanged={(id, value) =>
            setCommunityManagerIds((prev) => {
              const next = new Set(prev);
              if (value) next.add(id);
              else next.delete(id);
              return next;
            })
          }
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
    </>
  );
};
