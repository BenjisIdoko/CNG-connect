import React, { useEffect, useReducer, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AdminRoot } from './AdminRoot';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { isPlausibleEmail } from '../../services/managerAccessService';
import { canResend, cleanCode, initialSignIn, nextSignIn, SignInEvent, SignInState } from './codeSignInState';

type Outcome = { success: boolean; error?: string };

interface Props {
  title: string;
  onExit: () => void;
  sendCode: (email: string) => Promise<Outcome>;
  verifyCode: (email: string, code: string) => Promise<Outcome>;
  /** When given, a "Use my password instead" link is shown (managers who already have a password). */
  onUsePassword?: () => void;
  /** Replaces the sentence on the email step. */
  intro?: string;
  /** Added after "We sent a code to …" on the code step. */
  codeStepNote?: string;
}

/**
 * Sign-in for station managers: enter your email, get a code by email, enter it. No password and no
 * driver sign-up. Which stations you manage comes from the admin's invite for that email.
 */
export const CodeSignIn: React.FC<Props> = ({ title, onExit, sendCode, verifyCode, onUsePassword, intro, codeStepNote }) => {
  const [state, dispatch] = useReducer((s: SignInState, e: SignInEvent) => nextSignIn(s, e, Date.now()), undefined, initialSignIn);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second while waiting for a new code to be allowed.
  useEffect(() => {
    if (state.step !== 'code') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.step, state.sentAt]);

  const send = async () => {
    const address = email.trim();
    if (!isPlausibleEmail(address)) {
      dispatch({ type: 'failed', error: "That doesn't look like an email address" });
      return;
    }
    setBusy(true);
    const result = await sendCode(address);
    setBusy(false);
    if (result.success) {
      setCode('');
      setNow(Date.now());
      dispatch({ type: 'sent', email: address });
    } else {
      dispatch({ type: 'failed', error: result.error || 'Could not send the code. Try again in a minute.' });
    }
  };

  const verify = async () => {
    const digits = cleanCode(code);
    if (!digits) {
      dispatch({ type: 'failed', error: 'Enter the code from the email (numbers only).' });
      return;
    }
    setBusy(true);
    const result = await verifyCode(state.email, digits);
    setBusy(false);
    if (!result.success) {
      dispatch({ type: 'failed', error: result.error || 'That code is not right, or it has expired.' });
    }
  };

  const secondsLeft = state.sentAt ? Math.max(0, Math.ceil((30_000 - (now - state.sentAt)) / 1000)) : 0;

  return (
    <AdminRoot className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto p-6">
      <Card className="w-full max-w-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void (state.step === 'email' ? send() : verify());
          }}
        >
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>
              {state.step === 'email'
                ? (intro ?? 'Enter your email and we will send you a code. No password and no CNG-Connect sign-up needed.')
                : `We sent a code to ${state.email}. Enter it below.${codeStepNote ? ` ${codeStepNote}` : ''}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {state.step === 'email' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manager-email">Email</Label>
                <Input
                  id="manager-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="manager-code">Code</Label>
                <Input
                  id="manager-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
            )}

            <Button type="submit" size="lg" disabled={busy || (state.step === 'email' ? !email.trim() : !code.trim())} className="w-full">
              {state.step === 'email' ? (busy ? 'Sending…' : 'Send me a code') : busy ? 'Signing in…' : 'Sign in'}
            </Button>

            {state.error && (
              <p role="alert" className="text-sm font-semibold text-adm-danger">
                {state.error}
              </p>
            )}

            {state.step === 'code' && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Button type="button" variant="link" className="px-0" disabled={busy || !canResend(state, now)} onClick={() => void send2(state.email, sendCode, setBusy, dispatch, setCode, setNow)}>
                  {canResend(state, now) ? 'Send a new code' : `Send a new code in ${secondsLeft}s`}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="px-0"
                  onClick={() => {
                    setEmail(state.email);
                    dispatch({ type: 'change-email' });
                  }}
                >
                  Use a different email
                </Button>
              </div>
            )}

            {onUsePassword && (
              <Button type="button" variant="link" onClick={onUsePassword} className="self-start px-0">
                Use my password instead
              </Button>
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

/** Sends a fresh code to the email already chosen (used by "Send a new code"). */
async function send2(
  address: string,
  sendCode: (email: string) => Promise<Outcome>,
  setBusy: (b: boolean) => void,
  dispatch: React.Dispatch<SignInEvent>,
  setCode: (c: string) => void,
  setNow: (n: number) => void,
) {
  setBusy(true);
  const result = await sendCode(address);
  setBusy(false);
  if (result.success) {
    setCode('');
    setNow(Date.now());
    dispatch({ type: 'sent', email: address });
  } else {
    dispatch({ type: 'failed', error: result.error || 'Could not send a new code. Try again in a minute.' });
  }
}
