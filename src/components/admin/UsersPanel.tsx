import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { UserEditorModal, EditableUser } from './UserEditorModal';

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
    <div className="h-full flex flex-col min-h-0">
      <div className="h-11 shrink-0 border-b border-slate-200 flex items-center justify-between px-4 gap-3">
        <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">{rows.length} account{rows.length === 1 ? '' : 's'}</span>
        <input
          placeholder="Search name / email / phone / state"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs w-72"
        />
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading && <p className="p-4 text-xs text-slate-400">Loading users…</p>}
        {!loading && filtered.length > 0 && (
          <div className="rounded-lg border border-slate-200">
            <table className="min-w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 text-left [&_tr]:border-b [&_tr]:border-slate-200">
                <tr>
                  <th className="h-11 px-4 min-w-[160px] align-middle font-medium">Name</th>
                  <th className="h-11 px-4 min-w-[200px] align-middle font-medium">Email</th>
                  <th className="h-11 px-4 min-w-[130px] align-middle font-medium">Phone</th>
                  <th className="h-11 px-4 min-w-[90px] align-middle font-medium">State</th>
                  <th className="h-11 px-4 min-w-[160px] align-middle font-medium">Vehicle</th>
                  <th className="h-11 px-4 min-w-[160px] align-middle font-medium">CNG kit</th>
                  <th className="h-11 px-4 min-w-[70px] align-middle font-medium text-right">Reports</th>
                  <th className="h-11 px-4 min-w-[80px] align-middle font-medium text-right">Reputation</th>
                  <th className="h-11 px-4 min-w-[70px] align-middle font-medium text-right">Points</th>
                  <th className="h-11 px-4 min-w-[70px] align-middle font-medium">Role</th>
                  <th className="h-11 px-4 min-w-[140px] align-middle" />
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                    <td className="px-4 py-3 align-middle font-semibold text-slate-900 max-w-[160px] truncate" title={r.name || ''}>
                      {r.name || <span className="text-slate-400 italic font-normal">(no name)</span>}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-600 max-w-[200px] truncate" title={r.email || ''}>
                      {r.email || '—'}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-600 whitespace-nowrap">{r.phone || '—'}</td>
                    <td className="px-4 py-3 align-middle text-slate-600">{r.state || '—'}</td>
                    <td className="px-4 py-3 align-middle text-slate-600 max-w-[160px] truncate" title={r.vehicle || ''}>
                      {r.vehicle || '—'}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-600 max-w-[160px] truncate" title={r.cng_kit || ''}>
                      {r.cng_kit || '—'}
                    </td>
                    <td className="px-4 py-3 align-middle text-right text-slate-600">{r.reports_count ?? 0}</td>
                    <td className="px-4 py-3 align-middle text-right text-slate-600">{(r.reputation_score ?? 0).toFixed(1)}</td>
                    <td className="px-4 py-3 align-middle text-right text-slate-600">{r.community_points ?? 0}</td>
                    <td className="px-4 py-3 align-middle">
                      {r.is_admin && (
                        <span className="rounded-md bg-emerald-100 text-emerald-700 px-1.5 py-0.5 font-semibold whitespace-nowrap">
                          Admin
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setEditId(r.id)}
                          className="text-[0.6875rem] px-2.5 py-1 rounded-lg bg-slate-800 text-white font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(r.id)}
                          className="text-[0.6875rem] px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-semibold hover:bg-rose-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length === 0 && <p className="p-4 text-xs text-slate-400">Nothing matches.</p>}
      </div>

      {editRow && (
        <UserEditorModal
          user={editRow}
          flash={flash}
          onClose={() => setEditId(null)}
          onSaved={(id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
        />
      )}

      {deleteRow && (
        <div className="fixed inset-0 z-[225] bg-black/40 grid place-items-center p-6">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5 flex flex-col gap-3">
            <h2 className="font-extrabold text-slate-900 text-sm">Delete this account?</h2>
            <p className="text-xs text-slate-600">
              <span className="font-semibold">{deleteRow.name || deleteRow.email}</span> will lose access immediately —
              this permanently deletes their account, profile, reports, and posts. This can't be undone.
            </p>
            <div className="flex justify-end gap-2 mt-1">
              <button onClick={() => setDeleteId(null)} className="text-xs px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
                Cancel
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="text-xs px-4 py-1.5 rounded-lg bg-rose-600 text-white font-bold disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
