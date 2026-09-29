import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Shown whenever a Supabase password-recovery link is opened — the emailed
 * link signs the browser straight in (that's how Supabase recovery works),
 * so without this screen the app would just drop the user into the driver
 * home screen or admin dashboard with no way to actually set the password
 * they clicked the link to set. Takes over the whole screen ahead of every
 * other route until a new password is saved.
 */
export const PasswordResetScreen: React.FC = () => {
  const { updatePassword, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setErr('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setErr('Passwords do not match.');
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await updatePassword(password);
    setBusy(false);
    if (!r.success) {
      setErr(r.error || 'Could not set password.');
      return;
    }
    setDone(true);
  };

  return (
    <div data-theme="light" className="fixed inset-0 z-[300] grid place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-3">
        {done ? (
          <>
            <h1 className="text-lg font-extrabold text-slate-900">Password set</h1>
            <p className="text-sm text-slate-500">
              Your password has been updated. You can now sign in with it.
            </p>
            <button
              onClick={() => void signOut()}
              className="rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white"
            >
              Continue
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="flex flex-col gap-3"
          >
            <h1 className="text-lg font-extrabold text-slate-900">Set a new password</h1>
            <p className="text-sm text-slate-500">Choose a password for your account.</p>
            <input
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="New password"
              aria-label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              aria-label="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !password || !confirm}
              className="rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save password'}
            </button>
            {err && <p className="text-xs font-semibold text-rose-600">{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
};
