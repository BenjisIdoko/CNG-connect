import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SetPasswordCard } from './SetPasswordCard';
import { friendlyProfileError, validateContactDetails } from '../../utils/contactDetails';

type Outcome = { success: boolean; error?: string };

interface Props {
  name: string;
  phone: string;
  email: string;
  /** Saves the person's own name and phone. */
  onSaveDetails: (name: string, phone: string) => Promise<Outcome>;
  /** Changes the account password. */
  onChangePassword: (password: string) => Promise<Outcome>;
  flash: (message: string) => void;
}

/**
 * A station manager's own profile: their name and phone number (their own contact details, not the
 * station's, which are in the station editor), and a way to change their password. The email is shown
 * but cannot be edited: it is the account's identity and what the admin's invites are tied to.
 */
export const ManagerProfilePanel: React.FC<Props> = ({ name, phone, email, onSaveDetails, onChangePassword, flash }) => {
  const [nameValue, setNameValue] = useState(name);
  const [phoneValue, setPhoneValue] = useState(phone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a password change so the card starts empty again.
  const [passwordCardKey, setPasswordCardKey] = useState(0);

  const saveDetails = async () => {
    const checked = validateContactDetails(nameValue, phoneValue);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onSaveDetails(checked.name, checked.phone);
    setBusy(false);
    if (result.success) {
      setNameValue(checked.name);
      setPhoneValue(checked.phone);
      flash('Details saved');
    } else {
      setError(friendlyProfileError(result.error || ''));
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 pb-16">
        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveDetails();
            }}
          >
            <CardHeader>
              <CardTitle>Your details</CardTitle>
              <CardDescription>Your own contact details. The station's contact number is in the station editor.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  autoComplete="name"
                  className="max-md:text-base"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-phone">Phone number</Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0803 123 4567"
                  className="max-md:text-base"
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(e.target.value)}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-adm-ink">Email</p>
                <p className="break-all text-sm text-adm-ink">{email}</p>
                <p className="mt-0.5 text-xs text-adm-mute-text">
                  Your email cannot be changed here. It is how the admin's invites find you.
                </p>
              </div>
              {error && (
                <p role="alert" className="text-sm font-semibold text-adm-danger">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="min-h-[44px] self-start">
                {busy ? 'Saving…' : 'Save details'}
              </Button>
            </CardContent>
          </form>
        </Card>

        <SetPasswordCard
          key={passwordCardKey}
          heading="Change password"
          intro="Choose a new password for this account. Use it the next time you sign in."
          saveLabel="Change password"
          skipLabel={null}
          onSave={onChangePassword}
          onDone={() => {
            setPasswordCardKey((k) => k + 1);
            flash('Password changed');
          }}
        />
      </div>
    </div>
  );
};
