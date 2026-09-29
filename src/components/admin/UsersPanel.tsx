import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';

interface Row {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  state: string | null;
  vehicle: string | null;
  cng_kit: string | null;
  reports_count: number | null;
  reputation_score: number | null;
  community_points: number | null;
  is_admin: boolean | null;
}

/**
 * Read-only directory of every driver account — name, contact, vehicle/kit,
 * and reputation stats. `profiles` is publicly readable (see schema.sql), so
 * this is a plain select rather than a security-definer RPC like the other
 * admin panels; the nav item itself is what's admin-gated (see AdminScreen).
 */
export const UsersPanel: React.FC<{ flash: (m: string) => void }> = ({ flash }) => {
  const supabase = useSupabaseClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id,name,email,phone,state,vehicle,cng_kit,reports_count,reputation_score,community_points,is_admin')
      .order('name');
    setLoading(false);
    if (error) {
      flash(`Failed to load users: ${error.message}`);
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

      <div className="flex-1 overflow-auto">
        {loading && <p className="p-4 text-xs text-slate-400">Loading users…</p>}
        {!loading && filtered.length > 0 && (
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 text-left">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 min-w-[160px]">Name</th>
                <th className="px-3 py-2 min-w-[200px]">Email</th>
                <th className="px-3 py-2 min-w-[130px]">Phone</th>
                <th className="px-3 py-2 min-w-[90px]">State</th>
                <th className="px-3 py-2 min-w-[160px]">Vehicle</th>
                <th className="px-3 py-2 min-w-[160px]">CNG kit</th>
                <th className="px-3 py-2 text-right min-w-[70px]">Reports</th>
                <th className="px-3 py-2 text-right min-w-[80px]">Reputation</th>
                <th className="px-3 py-2 text-right min-w-[70px]">Points</th>
                <th className="px-3 py-2 min-w-[70px]">Role</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/70">
                  <td className="px-3 py-2 font-semibold text-slate-900 max-w-[160px] truncate" title={r.name || ''}>
                    {r.name || <span className="text-slate-400 italic font-normal">(no name)</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={r.email || ''}>
                    {r.email || '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.phone || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{r.state || '—'}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-[160px] truncate" title={r.vehicle || ''}>
                    {r.vehicle || '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600 max-w-[160px] truncate" title={r.cng_kit || ''}>
                    {r.cng_kit || '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{r.reports_count ?? 0}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{(r.reputation_score ?? 0).toFixed(1)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{r.community_points ?? 0}</td>
                  <td className="px-3 py-2">
                    {r.is_admin && (
                      <span className="rounded-md bg-emerald-100 text-emerald-700 px-1.5 py-0.5 font-semibold whitespace-nowrap">
                        Admin
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <p className="p-4 text-xs text-slate-400">Nothing matches.</p>}
      </div>
    </div>
  );
};
