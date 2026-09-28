import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../common/Icon';

/**
 * Shared email-OTP sign-in screen for every admin/manager route. Renders `children`
 * once a session exists — it does not itself check `is_admin` or manager rows, so
 * the same gate serves the full admin dashboard and a plain station manager alike;
 * each destination decides what a signed-in-but-unprivileged visitor gets to see.
 */
export const AdminAuthGate: React.FC<{ title: string; onExit: () => void; children: React.ReactNode }> = ({
  title,
  onExit,
  children,
}) => {
  const { session, isAuthLoading, sendLoginCode, verifyLoginCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isAuthLoading) {
    return <div className="fixed inset-0 z-[200] grid place-items-center bg-white text-sm text-slate-500">Loading…</div>;
  }

  if (session) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-3">
        <h1 className="text-lg font-extrabold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">Sign in with the email an admin knows you under.</p>
        {!codeSent ? (
          <>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              disabled={busy || !email}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                const r = await sendLoginCode(email.trim());
                setBusy(false);
                if (r.success) setCodeSent(true);
                else setErr(r.error || 'Could not send code.');
              }}
              className="rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </>
        ) : (
          <>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Verification code"
              aria-label="Verification code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
            />
            <button
              disabled={busy || code.length < 6}
              onClick={async () => {
                setBusy(true);
                setErr(null);
                const r = await verifyLoginCode(email.trim(), code);
                setBusy(false);
                if (!r.success) setErr(r.error || 'Invalid code.');
              }}
              className="rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Verify'}
            </button>
          </>
        )}
        {err && <p className="text-xs font-semibold text-rose-600">{err}</p>}
        <button onClick={onExit} className="mt-1 text-xs text-slate-400 hover:text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Icon name="arrow_back" size={14} /> Back to app
          </span>
        </button>
      </div>
    </div>
  );
};
