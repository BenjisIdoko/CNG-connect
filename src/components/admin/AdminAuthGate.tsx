import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { AdminRoot } from './AdminRoot';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { CodeSignIn } from './CodeSignIn';

/**
 * Shared sign-in screen for every admin/manager route. Password-based, not
 * the driver app's email-OTP flow: deliberately, per product decision, so
 * admins aren't stuck waiting on an email round-trip every time. Renders
 * `children` once a session exists. It does not itself check `is_admin` or
 * manager rows, so the same gate serves the full admin dashboard and a plain
 * station manager alike; each destination decides what a signed-in-but-
 * unprivileged visitor gets to see.
 */
export const AdminAuthGate: React.FC<{
  title: string;
  onExit: () => void;
  children: React.ReactNode;
  /** 'password' for the admin; 'code' for station managers (emailed code, no password). */
  mode?: 'password' | 'code';
}> = ({ title, onExit, children, mode = 'password' }) => {
  const { session, isAuthLoading, adminSignInWithPassword, sendLoginCode, verifyLoginCode } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (isAuthLoading) {
    return (
      <AdminRoot className="fixed inset-0 z-[200] grid place-items-center text-sm text-adm-mute-text">Loading…</AdminRoot>
    );
  }

  if (session) return <>{children}</>;

  if (mode === 'code') {
    return <CodeSignIn title={title} onExit={onExit} sendCode={sendLoginCode} verifyCode={verifyLoginCode} />;
  }

  const handleSubmit = async () => {
    setBusy(true);
    setErr(null);
    const r = await adminSignInWithPassword(email.trim(), password);
    setBusy(false);
    if (!r.success) setErr(r.error || 'Invalid email or password.');
  };

  return (
    <AdminRoot className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto p-6">
      <Card className="w-full max-w-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>Sign in with your admin email and password.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" disabled={busy || !email || !password} className="w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            {err && (
              <p role="alert" className="text-sm font-semibold text-adm-danger">
                {err}
              </p>
            )}
            <Button type="button" variant="link" onClick={onExit} className="self-start px-0 text-adm-mute-text">
              <ArrowLeft aria-hidden="true" /> Back to app
            </Button>
          </CardContent>
        </form>
      </Card>
    </AdminRoot>
  );
};
