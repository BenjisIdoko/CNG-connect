import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../services/supabaseClient';

/** The lazily loaded Supabase client, or null until it has loaded (or if not configured). */
export function useSupabaseClient(): SupabaseClient | null {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSupabase().then((c) => {
      if (!cancelled) setClient(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return client;
}
