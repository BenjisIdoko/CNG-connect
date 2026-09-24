/// <reference types="vite/client" />
import type { SupabaseClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-supabase-project.supabase.co' &&
  !supabaseUrl.includes('YOUR_SUPABASE')
);

// The supabase-js bundle is ~200 KB, so it is loaded on demand (after first paint)
// instead of being part of the startup bundle. Everything awaits getSupabase().
let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    );
  }
  return clientPromise;
}

/** Warm the client in the background (e.g. right after first paint) so auth restores promptly. */
export function preloadSupabase(): void {
  void getSupabase();
}

/**
 * Lightweight read straight against the PostgREST endpoint (no supabase-js needed),
 * so the first station list can render without downloading the ~200 KB client.
 * Uses the signed-in user's stored token when it is still valid, else the anon key.
 * Returns null on any failure so callers can fall back to the full client.
 */
export async function restSelect<T = any>(table: string, query: string): Promise<T[] | null> {
  if (!isSupabaseConfigured) return null;
  let bearer = supabaseAnonKey;
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    const stored = JSON.parse(localStorage.getItem(`sb-${ref}-auth-token`) || 'null');
    if (stored?.access_token && (!stored.expires_at || stored.expires_at * 1000 > Date.now() + 60_000)) {
      bearer = stored.access_token;
    }
  } catch {
    /* no stored session */
  }
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch {
    return null;
  }
}
