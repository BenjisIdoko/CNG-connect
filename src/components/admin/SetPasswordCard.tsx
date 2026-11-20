import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { friendlyPasswordError, validateNewPassword } from '../../utils/passwordRules';

interface Props {
  /** Saves the new password for the signed-in person. */
  onSave: (password: string) => Promise<{ success: boolean; error?: string }>;
  /** Called after a successful save, and when the manager chooses the skip button. */
  onDone: () => void;
  /** Wording, so the same card serves "Set a password" and "Change password". */
  heading?: string;
  intro?: string;
  saveLabel?: string;
  /** The skip button's text; null hides it (changing an existing password has nothing to skip). */
  skipLabel?: string | null;
}

/**
 * Shown to a station manager right after they sign in with an emailed code, so the next sign-in can use
 * a password and no code is sent. The manager chooses the password; it is checked before it is sent and
 * any failure is shown in plain words.
 */
export const SetPasswordCard: React.FC<Props> = ({
  onSave,
  onDone,
  heading = 'Set a password',
  intro = "So you won't need an emailed code next time.",
  saveLabel = 'Save password',
  skipLabel = 'Not now',
}) => {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const problem = validateNewPassword(password, again);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onSave(password);
    setBusy(false);
    if (result.success) onDone();
    else setError(friendlyPasswordError(result.error || ''));
  };

  const fieldClass = 'max-md:text-base';

  return (
    <Card className="mx-auto w-full max-w-xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <CardHeader>
          <CardTitle>{heading}</CardTitle>
          <CardDescription>{intro}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-adm-mute-text">At least 8 characters.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password-again">Type it again</Label>
            <Input
              id="new-password-again"
              type="password"
              autoComplete="new-password"
              className={fieldClass}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-semibold text-adm-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !password || !again} className="min-h-[44px]">
              {busy ? 'Saving…' : saveLabel}
            </Button>
            {skipLabel !== null && (
              <Button type="button" variant="ghost" disabled={busy} onClick={onDone} className="min-h-[44px]">
                {skipLabel}
              </Button>
            )}
          </div>
        </CardContent>
      </form>
    </Card>
  );
};
