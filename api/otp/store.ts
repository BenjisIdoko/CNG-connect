import { createClient } from '@supabase/supabase-js';

export interface OtpSession {
  code: string;
  expiresAt: number;
  lastSentAt: number;
}

const memoryStore = new Map<string, OtpSession>();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export async function getOtpSession(phone: string): Promise<OtpSession | null> {
  if (supabase) {
    try {
      const { data } = await supabase.from('otp_sessions').select('*').eq('phone', phone).single();
      if (data) {
        return {
          code: data.code,
          expiresAt: Number(data.expires_at),
          lastSentAt: Number(data.last_sent_at),
        };
      }
    } catch (err) {
      console.warn('Supabase getOtpSession error:', err);
    }
  }
  return memoryStore.get(phone) || null;
}

export async function saveOtpSession(phone: string, session: OtpSession): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('otp_sessions').upsert({
        phone,
        code: session.code,
        expires_at: session.expiresAt,
        last_sent_at: session.lastSentAt,
      });
    } catch (err) {
      console.warn('Supabase saveOtpSession error:', err);
    }
  }
  memoryStore.set(phone, session);
}

export async function deleteOtpSession(phone: string): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('otp_sessions').delete().eq('phone', phone);
    } catch (err) {
      console.warn('Supabase deleteOtpSession error:', err);
    }
  }
  memoryStore.delete(phone);
}
