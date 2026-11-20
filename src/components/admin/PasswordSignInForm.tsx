import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AdminRoot } from './AdminRoot';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface Props {
  title: string;
  description: string;
  /** Resolves with the failure text to show, or success. */
  onSubmit: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onExit: () => void;
  /** Extra controls under the form, for example "Email me a code" for managers. */
  footer?: React.ReactNode;
}

/**
 * Email and password sign-in shared by the admin dashboard and the station manager page. The fields
 * carry the attributes a browser or phone password manager needs to fill and save them.
 */
export const PasswordSignInForm: React.FC<Props> = ({ title, description, onSubmit, onExit, footer }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async () => {
    setBusy(true);
    setErr(null);
    const r = await onSubmit(email.trim(), password);
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
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
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
            {footer}
            <Button type="button" variant="link" onClick={onExit} className="self-start px-0 text-adm-mute-text">
              <ArrowLeft aria-hidden="true" /> Back to app
            </Button>
          </CardContent>
        </form>
      </Card>
    </AdminRoot>
  );
};
