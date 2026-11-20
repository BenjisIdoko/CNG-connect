import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { ManagerLink, groupManagers } from '../../utils/stationManagerGroups';
import { cancelStationManagerInvite, describeInviteOutcome, sendManagerInvite } from '../../services/managerAccessService';
import type { RpcClient } from '../../services/stationManagerService';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';

interface StationOption {
  id: string;
  name: string;
}

const selectCls =
  'h-9 max-md:h-11 w-full rounded-md border border-adm-line bg-adm-card px-3 text-sm max-md:text-base text-adm-ink outline-none transition-colors focus-visible:border-adm-note focus-visible:ring-2 focus-visible:ring-adm-note';

/**
 * Super-admin view of every station manager: who manages which stations, with an "invite by email"
 * form and a remove button per station. A manager does not need a CNG-Connect account first: an invite
 * waits (shown as pending) until that email signs in at /station-manager with an emailed code. The
 * database checks the caller is the admin on every change.
 */
export const StationManagersPanel: React.FC<{ flash: (m: string) => void }> = ({ flash }) => {
  const supabase = useSupabaseClient();
  const [links, setLinks] = useState<ManagerLink[]>([]);
  const [stations, setStations] = useState<StationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [stationId, setStationId] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setLoadErr(null);
    const [{ data: rows, error: rowsErr }, { data: stationRows, error: stationsErr }, { data: inviteRows }] = await Promise.all([
      supabase.from('station_managers').select('station_id,user_id'),
      supabase.from('stations').select('id,name').order('name', { ascending: true }),
      // Before the invites migration is applied this simply returns nothing.
      supabase.from('station_manager_invites').select('station_id,email'),
    ]);
    if (rowsErr || stationsErr) {
      setLoading(false);
      setLoadErr((rowsErr || stationsErr)?.message || 'Could not load station managers');
      return;
    }
    const options = (stationRows || []).map((s) => ({ id: s.id as string, name: (s.name as string) || (s.id as string) }));
    setStations(options);
    const userIds = [...new Set((rows || []).map((r) => r.user_id as string))];
    let profiles: { id: string; email: string; name: string }[] = [];
    if (userIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id,email,name').in('id', userIds);
      profiles = (data || []).map((p) => ({
        id: p.id as string,
        email: (p.email as string) || '',
        name: (p.name as string) || '',
      }));
    }
    const nameOf = new Map(options.map((o) => [o.id, o.name]));
    const profileOf = new Map(profiles.map((p) => [p.id, p]));
    const real: ManagerLink[] = (rows || []).map((r) => {
      const profile = profileOf.get(r.user_id as string);
      return {
        stationId: r.station_id as string,
        stationName: nameOf.get(r.station_id as string) || (r.station_id as string),
        userId: r.user_id as string,
        email: profile?.email || '(unknown email)',
        name: profile?.name || '',
      };
    });
    const pending: ManagerLink[] = (inviteRows || []).map((i) => {
      const invitedEmail = (i.email as string) || '';
      return {
        stationId: i.station_id as string,
        stationName: nameOf.get(i.station_id as string) || (i.station_id as string),
        userId: `invite:${invitedEmail}`,
        email: invitedEmail,
        name: '',
        pending: true,
      };
    });
    setLinks([...real, ...pending]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => groupManagers(links), [links]);

  const invite = async () => {
    if (!supabase || busy || !email.trim() || !stationId) return;
    setBusy('invite');
    setFormErr(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setBusy(null);
      setFormErr('Sign in again to invite managers');
      return;
    }
    const result = await sendManagerInvite({
      accessToken,
      stationId,
      email,
      client: supabase as unknown as RpcClient,
    });
    setBusy(null);
    if (!result.ok) {
      setFormErr(result.error);
      return;
    }
    setEmail('');
    flash(describeInviteOutcome(result));
    void load();
  };

  const remove = async (g: { email: string; pending: boolean }, station: { id: string; name: string }) => {
    if (!supabase || busy) return;
    const question = g.pending
      ? `Cancel the invite for ${g.email} to manage ${station.name}?`
      : `Remove ${g.email} as manager of ${station.name}?`;
    if (!window.confirm(question)) return;
    setBusy(`${g.email}|${station.id}`);
    setFormErr(null);
    if (g.pending) {
      const result = await cancelStationManagerInvite(supabase as unknown as RpcClient, station.id, g.email);
      setBusy(null);
      if (!result.ok) {
        setFormErr(result.error);
        return;
      }
      flash('Invite cancelled');
    } else {
      const { error } = await supabase.rpc('admin_remove_station_manager', {
        p_station_id: station.id,
        p_manager_email: g.email,
      });
      setBusy(null);
      if (error) {
        setFormErr(`Could not remove: ${error.message}`);
        return;
      }
      flash('Manager removed');
    }
    void load();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-16 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Invite a station manager</CardTitle>
            <CardDescription>
              They don't need a CNG-Connect account. We email them a link to <code>/station-manager</code>; the first time they enter
              this same email and sign in with the code that follows, then set a password so they don't need a code again. They
              see only the stations you invite them to.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manager-email">Manager email</Label>
              <Input
                id="manager-email"
                type="email"
                placeholder="manager@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="manager-station">Station</Label>
              <select id="manager-station" value={stationId} onChange={(e) => setStationId(e.target.value)} className={selectCls}>
                <option value="">Choose a station…</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={() => void invite()} disabled={busy !== null || !email.trim() || !stationId} className="self-start">
              {busy === 'invite' ? 'Inviting…' : 'Invite manager'}
            </Button>
            {formErr && (
              <p role="alert" className="text-sm font-semibold text-adm-danger">
                {formErr}
              </p>
            )}
          </CardContent>
        </Card>

        {loading && (
          <div className="flex flex-col gap-3" aria-label="Loading station managers">
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {loadErr && (
          <p role="alert" className="rounded-md border border-adm-danger/30 bg-adm-danger-soft px-4 py-3 text-sm font-semibold text-adm-danger">
            {loadErr}
          </p>
        )}
        {!loading && !loadErr && groups.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="font-geist text-base font-bold">No station managers yet</p>
              <p className="mt-1 text-sm text-adm-mute-text">Invite one above and they can post for their station.</p>
            </CardContent>
          </Card>
        )}

        {groups.map((g) => (
          <Card key={g.userId}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{g.name || g.email}</CardTitle>
                {g.pending && <Badge variant="warning">Invited, has not signed in yet</Badge>}
              </div>
              {g.name && <CardDescription>{g.email}</CardDescription>}
            </CardHeader>
            <ul className="flex flex-col divide-y divide-adm-line">
              {g.stations.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="truncate">{s.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-adm-danger hover:bg-adm-danger-soft"
                    onClick={() => void remove(g, s)}
                    disabled={busy !== null}
                  >
                    {busy === `${g.email}|${s.id}` ? 'Working…' : g.pending ? 'Cancel invite' : 'Remove'}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
};
