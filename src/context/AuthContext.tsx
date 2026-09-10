import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { UserProfile } from '../types';
import { INITIAL_USER } from '../data/mockData';
import { resizeToSquareJpeg } from '../utils/resizeImage';

interface AuthResult {
  success: boolean;
  error?: string;
}

interface VerifyResult extends AuthResult {
  /** True when this session's profile has no name yet — i.e. first sign-in. Returned directly rather than read back off context state, which wouldn't have re-rendered yet by the time the caller's await resolves. */
  isNewDriver?: boolean;
}

interface AuthContextType {
  session: Session | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  driverProfile: UserProfile;
  /** True once a session exists but the profile has no name yet — i.e. this is their first sign-in and they need the "complete your profile" step. */
  isNewDriver: boolean;
  sendLoginCode: (email: string) => Promise<AuthResult>;
  verifyLoginCode: (email: string, code: string) => Promise<VerifyResult>;
  /** Redirect to Google's consent screen. Resolves only on error (a success redirects the page). */
  signInWithGoogle: () => Promise<AuthResult>;
  updateProfile: (updater: Partial<UserProfile> | ((prev: UserProfile) => UserProfile)) => Promise<void>;
  /** Resize + upload an image to the `avatars` bucket and save its URL on the profile. */
  uploadAvatar: (file: File) => Promise<{ url?: string; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapProfileRow(row: Record<string, unknown>, fallbackEmail: string): UserProfile {
  return {
    name: (row.name as string) || '',
    phone: (row.phone as string) || '',
    email: (row.email as string) || fallbackEmail,
    avatar: (row.avatar as string) || INITIAL_USER.avatar,
    vehicle: (row.vehicle as string) || '',
    cngInstalledDate: (row.cng_installed_date as string) || '',
    monthlySavings: Number(row.monthly_savings || 0),
    reportsCount: Number(row.reports_count || 0),
    reputationScore: Number(row.reputation_score ?? 5.0),
    communityPoints: Number(row.community_points || 0),
    state: (row.state as string) || undefined,
    isAdmin: Boolean(row.is_admin),
  };
}

function toProfileRow(p: Partial<UserProfile>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.phone !== undefined) row.phone = p.phone;
  if (p.email !== undefined) row.email = p.email;
  if (p.avatar !== undefined) row.avatar = p.avatar;
  if (p.vehicle !== undefined) row.vehicle = p.vehicle;
  if (p.cngInstalledDate !== undefined) row.cng_installed_date = p.cngInstalledDate;
  if (p.monthlySavings !== undefined) row.monthly_savings = p.monthlySavings;
  if (p.reportsCount !== undefined) row.reports_count = p.reportsCount;
  if (p.reputationScore !== undefined) row.reputation_score = p.reputationScore;
  if (p.communityPoints !== undefined) row.community_points = p.communityPoints;
  if (p.state !== undefined) row.state = p.state;
  return row;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [driverProfile, setDriverProfile] = useState<UserProfile>(INITIAL_USER);
  const [isNewDriver, setIsNewDriver] = useState(false);

  const loadProfile = useCallback(async (userId: string, fallbackEmail: string): Promise<boolean> => {
    if (!supabase) return false;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error || !data) {
      // The DB trigger (handle_new_auth_user) creates this row on sign-up;
      // if it hasn't landed yet (rare race on the very first verify), treat
      // as a brand-new driver rather than surfacing an error.
      setDriverProfile({ ...INITIAL_USER, name: '', reportsCount: 0, communityPoints: 0, email: fallbackEmail });
      setIsNewDriver(true);
      return true;
    }
    setDriverProfile(mapProfileRow(data, fallbackEmail));
    // "New" = still needs the profile step. Google users arrive with a name
    // prefilled but no phone, so gate on both.
    const isNew = !data.name || !String(data.phone || '').trim();
    setIsNewDriver(isNew);
    return isNew;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        loadProfile(data.session.user.id, data.session.user.email || '');
      }
      setIsAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession.user.id, newSession.user.email || '');
      } else {
        setDriverProfile(INITIAL_USER);
        setIsNewDriver(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfile]);

  /**
   * Sends a numeric email OTP via Supabase Auth (shouldCreateUser: true means
   * this single call handles both sign-up and sign-in — Supabase creates the
   * auth.users row on first verify if it doesn't already exist). Requires
   * custom SMTP configured in the Supabase dashboard (Resend) and the
   * "Magic Link" email template edited to include {{ .Token }} — see
   * README/setup notes. Without that, Supabase's default shared sender is
   * rate-limited to a handful of emails/hour and sends a link, not a code.
   * OTP length is a Supabase project setting (6-10 digits, 6 by default) —
   * the sign-in UI doesn't assume a fixed length, so this works either way.
   */
  const sendLoginCode = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { success: false, error: 'Backend not configured.' };
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (!supabase) return { success: false, error: 'Backend not configured.' };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) return { success: false, error: error.message };
    return { success: true }; // browser is now navigating to Google
  }, []);

  const verifyLoginCode = useCallback(async (email: string, code: string): Promise<VerifyResult> => {
    if (!supabase) return { success: false, error: 'Backend not configured.' };
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error || !data.session) {
      return { success: false, error: error?.message || 'Invalid or expired code.' };
    }
    setSession(data.session);
    const isNewDriver = await loadProfile(data.session.user.id, data.session.user.email || '');
    return { success: true, isNewDriver };
  }, [loadProfile]);

  const updateProfile = useCallback(
    async (updater: Partial<UserProfile> | ((prev: UserProfile) => UserProfile)) => {
      if (!session || !supabase) return;

      let computed: UserProfile | null = null;
      setDriverProfile((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        computed = next;
        return next;
      });
      if (!computed) return;
      const nextProfile: UserProfile = computed;

      if (nextProfile.name) setIsNewDriver(false);
      // upsert, not update: a session created before handle_new_auth_user
      // existed (or any other reason the trigger's row is missing) would
      // otherwise silently no-op here — an UPDATE matches zero rows and
      // reports no error, so the profile would look saved locally but never
      // actually persist.
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, ...toProfileRow(nextProfile) });
      if (error) console.error('Failed to persist profile update:', error.message);
    },
    [session]
  );

  const uploadAvatar = useCallback(
    async (file: File): Promise<{ url?: string; error?: string }> => {
      if (!session || !supabase) return { error: 'You need to be signed in.' };
      if (!file.type.startsWith('image/')) return { error: 'Please choose an image file.' };

      let blob: Blob;
      try {
        blob = await resizeToSquareJpeg(file);
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Could not process that image.' };
      }

      // One file per user, always overwritten; a cache-busting query param on the
      // saved URL forces the <img> and any CDN to refetch after a change.
      const objectPath = `${session.user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(objectPath, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) {
        const msg = /bucket.*not found/i.test(upErr.message)
          ? 'Avatar storage isn’t set up yet (run supabase/avatars-bucket.sql).'
          : upErr.message;
        return { error: msg };
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(objectPath);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      await updateProfile({ avatar: url });
      return { url };
    },
    [session, updateProfile]
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setDriverProfile(INITIAL_USER);
    setIsNewDriver(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: Boolean(session),
        isAuthLoading,
        driverProfile,
        isNewDriver,
        sendLoginCode,
        verifyLoginCode,
        signInWithGoogle,
        updateProfile,
        uploadAvatar,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
