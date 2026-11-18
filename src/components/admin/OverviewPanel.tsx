import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabaseClient } from '../../hooks/useSupabaseClient';
import { OverviewData, OverviewTarget, OverviewView } from './OverviewView';
import type { QueueItem } from '../../utils/adminQueue';

const LAST_VISIT_KEY = 'cng-admin-last-visit';

const readLastVisit = (): number | null => {
  try {
    const raw = window.localStorage.getItem(LAST_VISIT_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
};

const EMPTY: OverviewData = { counts: null, items: [], totals: { stations: null, users: null, managers: null } };

/**
 * The admin's home: what is waiting (flagged reports, driver suggestions, station pins to review),
 * ranked oldest first, plus totals. It only reads, using the same queries the other tabs use. If
 * any of the three queues cannot be read it refuses to claim "all clear" and says so.
 */
export const OverviewPanel: React.FC<{ onNavigate: (target: OverviewTarget) => void }> = ({ onNavigate }) => {
  const supabase = useSupabaseClient();
  const [data, setData] = useState<OverviewData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  // The last visit is read once on arrival; the new time is stored when the admin leaves.
  const [lastVisitMs] = useState<number | null>(readLastVisit);
  const arrivedAt = useRef(Date.now());

  useEffect(
    () => () => {
      try {
        window.localStorage.setItem(LAST_VISIT_KEY, String(arrivedAt.current));
      } catch {
        /* storage can be blocked; the gold tint simply will not persist */
      }
    },
    [],
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [sugg, flagged, pins, stations, users, managers] = await Promise.all([
      supabase
        .from('station_suggestions')
        .select('id,name,city,state,created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(200),
      supabase.rpc('admin_moderation_queue', { p_view: 'review' }),
      supabase.from('stations').select('id,name,city').eq('needs_pin_review', true).order('name').limit(500),
      supabase.from('stations').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('station_managers').select('user_id'),
    ]);

    const problems: string[] = [];
    const items: QueueItem[] = [];

    if (sugg.error) problems.push('Driver suggestions could not be loaded.');
    else {
      for (const s of sugg.data || []) {
        items.push({
          id: String(s.id),
          kind: 'suggestion',
          title: (s.name as string) || 'Unnamed station',
          detail: [s.city, s.state].filter(Boolean).join(', '),
          createdAt: (s.created_at as string) || null,
        });
      }
    }

    if (flagged.error) problems.push('Flagged reports could not be loaded.');
    else {
      for (const r of (flagged.data || []) as Array<Record<string, unknown>>) {
        const flags = Number(r.open_flags || 0);
        items.push({
          id: String(r.report_id),
          kind: 'flagged',
          title: String(r.station_name || 'Unknown station'),
          detail: flags > 0 ? `${flags} flag${flags === 1 ? '' : 's'} · by ${r.author || 'a driver'}` : `${Number(r.dislikes || 0)} dislikes`,
          createdAt: (r.created_at as string) || null,
        });
      }
    }

    if (pins.error) problems.push('Pin reviews could not be loaded.');
    else {
      for (const p of pins.data || []) {
        items.push({
          id: String(p.id),
          kind: 'pin',
          title: (p.name as string) || 'Unnamed station',
          detail: (p.city as string) || '',
          createdAt: null,
        });
      }
    }

    const counts =
      sugg.error || flagged.error || pins.error
        ? null
        : {
            suggestion: items.filter((i) => i.kind === 'suggestion').length,
            flagged: items.filter((i) => i.kind === 'flagged').length,
            pin: items.filter((i) => i.kind === 'pin').length,
          };

    setData({
      counts,
      items,
      totals: {
        stations: stations.error ? null : stations.count ?? 0,
        users: users.error ? null : users.count ?? 0,
        managers: managers.error ? null : new Set((managers.data || []).map((m) => m.user_id as string)).size,
      },
    });
    setErrors(problems);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <OverviewView
      data={data}
      loading={loading}
      errors={errors}
      lastVisitMs={lastVisitMs}
      onNavigate={onNavigate}
      onRetry={() => void load()}
    />
  );
};
