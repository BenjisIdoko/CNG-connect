/**
 * Privacy-first product analytics — first-party, no third-party SDK, no cookies.
 *
 * - Anonymous random id (localStorage) + per-visit session id. No name/email/phone/location.
 * - Events go to our own Supabase table (`analytics_events`, insert-only for clients).
 * - Batched and sent with keepalive so events survive the tab closing.
 * - Honors Do-Not-Track and a user opt-out (Profile → "Anonymous usage data").
 */
import { isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from './supabaseClient';
import { BUILD_ID } from '../utils/appUpdate';

export type EventName =
  | 'app_open'
  | 'screen_view'
  | 'station_viewed'
  | 'search_used'
  | 'filter_applied'
  | 'directions_clicked'
  | 'share_clicked'
  | 'login_code_requested'
  | 'login_verified'
  | 'report_started'
  | 'report_submitted'
  | 'arrival_prompt_shown'
  | 'followup_prompt_shown'
  | 'followup_dismissed'
  | 'install_prompt_accepted'
  | 'app_installed'
  | 'notification_permission'
  | 'js_error';

type Props = Record<string, string | number | boolean | null | undefined>;
type QueuedEvent = {
  name: EventName;
  props: Record<string, string | number | boolean | null>;
  anon_id: string;
  user_id: string | null;
  session_id: string;
  path: string;
  app_version: string;
  standalone: boolean;
};

const OPT_OUT_KEY = 'cng_analytics_optout';
const ANON_KEY = 'cng_aid';
const FLUSH_MS = 6000;
const MAX_QUEUE = 100;
const MAX_BATCH = 40;

const rand = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let userId: string | null = null;
const sessionId = rand();
let errorCount = 0;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function anonId(): string {
  let id = safeGet(ANON_KEY);
  if (!id) {
    id = rand();
    try {
      localStorage.setItem(ANON_KEY, id);
    } catch {
      /* private mode: id lasts for the session only */
    }
  }
  return id;
}

export function isAnalyticsOptedOut(): boolean {
  return safeGet(OPT_OUT_KEY) === '1';
}

export function isAnalyticsEnabled(): boolean {
  if (!isSupabaseConfigured) return false;
  if (safeGet(OPT_OUT_KEY) === '1') return false;
  if (typeof navigator !== 'undefined' && (navigator as any).doNotTrack === '1') return false;
  return true;
}

export function setAnalyticsEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.removeItem(OPT_OUT_KEY);
    else localStorage.setItem(OPT_OUT_KEY, '1');
  } catch {
    /* ignore */
  }
  if (!enabled) queue = [];
}

export function setAnalyticsUser(id: string | null): void {
  userId = id;
}

function isStandalone(): boolean {
  try {
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
  } catch {
    return false;
  }
}

function clean(props: Props): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    out[k.slice(0, 40)] = typeof v === 'string' ? v.slice(0, 120) : v;
  }
  return out;
}

export function track(name: EventName, props: Props = {}): void {
  if (!isAnalyticsEnabled()) return;
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({
    name,
    props: clean(props),
    anon_id: anonId(),
    user_id: userId,
    session_id: sessionId,
    path: typeof location !== 'undefined' ? location.pathname : '/',
    app_version: BUILD_ID,
    standalone: isStandalone(),
  });
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

export function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0 || !isAnalyticsEnabled() || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
  const batch = queue.splice(0, MAX_BATCH);
  try {
    void fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch),
    }).then((res) => {
      // Table missing / rejected: drop silently rather than retrying forever.
      if (!res.ok && res.status >= 500) queue.unshift(...batch);
    }).catch(() => {
      queue.unshift(...batch);
    });
  } catch {
    /* never let analytics break the app */
  }
  if (queue.length > 0 && !timer) timer = setTimeout(flush, FLUSH_MS);
}

let started = false;
/** Call once at startup: app_open, flush on hide, and error reporting. */
export function startAnalytics(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const firstSeenKey = 'cng_first_seen';
  const returning = safeGet(firstSeenKey) !== null;
  if (!returning) {
    try {
      localStorage.setItem(firstSeenKey, String(Date.now()));
    } catch {
      /* ignore */
    }
  }
  track('app_open', {
    returning,
    viewport: window.innerWidth < 768 ? 'phone' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
    lang: navigator.language?.slice(0, 8),
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);

  window.addEventListener('error', (e) => {
    if (errorCount++ >= 5) return; // cap noisy loops
    track('js_error', { message: String(e.message).slice(0, 100), source: (e.filename || '').split('/').pop() });
  });
  window.addEventListener('appinstalled', () => track('app_installed'));
}
