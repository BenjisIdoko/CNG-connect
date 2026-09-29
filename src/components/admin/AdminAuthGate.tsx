import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../common/Icon';

/**
 * Shared sign-in screen for every admin/manager route. Password-based, not
 * the driver app's email-OTP flow — deliberately, per product decision, so
 * admins aren't stuck waiting on an email round-trip every time. Renders
 * `children` once a session exists — it does not itself check `is_admin` or
 * manager rows, so the same gate serves the full admin dashboard and a plain
 * station manager alike; each destination decides what a signed-in-but-
 * unprivileged visitor gets to see.
 */
export const AdminAuthGate: React.FC<{ title: string; onExit: () => void; children: React.ReactNode }> = ({
  title,
  onExit,
  children,
}) => {
  const { session, isAuthLoading, adminSignInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isAuthLoading) {
    return <div data-theme="light" className="fixed inset-0 z-[200] grid place-items-center bg-white text-sm text-slate-500">Loading…</div>;
  }

  if (session) return <>{children}</>;

  const handleSubmit = async () => {
    setBusy(true);
    setErr(null);
    const r = await adminSignInWithPassword(email.trim(), password);
    setBusy(false);
    if (!r.success) setErr(r.error || 'Invalid email or password.');
  };

  return (
    <div data-theme="light" className="fixed inset-0 z-[200] grid place-items-center bg-slate-50 p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-3"
      >
        <h1 className="text-lg font-extrabold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">Sign in with your admin email and password.</p>
        <input
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          aria-label="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !email || !password}
          className="rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {err && <p className="text-xs font-semibold text-rose-600">{err}</p>}
        <button type="button" onClick={onExit} className="mt-1 text-xs text-slate-400 hover:text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Icon name="arrow_back" size={14} /> Back to app
          </span>
        </button>
      </form>
    </div>
  );
};
