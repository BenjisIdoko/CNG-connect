import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminRoot } from './AdminRoot';
import { Button } from '../ui/button';
import { CodeSignIn } from './CodeSignIn';
import { PasswordSignInForm } from './PasswordSignInForm';
import { friendlySignInError } from '../../utils/passwordRules';
import { clearSetPasswordPrompt, markSetPasswordPrompt } from '../../utils/passwordPrompt';

const MANAGER_CODE_INTRO =
  "Enter your email and we will send you a code. After you sign in you can set a password, so you won't need a code next time.";

/**
 * Shared sign-in screen for every admin/manager route. Password-based, not
 * the driver app's email-OTP flow: deliberately, per product decision, so
 * admins aren't stuck waiting on an email round-trip every time. Station managers
 * (mode 'manager') also sign in with a password; an emailed code is the way in the
 * first time and when a password is forgotten, and after a code sign-in they are
 * asked to set a password. Renders `children` once a session exists. It does not itself check `is_admin` or
 * manager rows, so the same gate serves the full admin dashboard and a plain
 * station manager alike; each destination decides what a signed-in-but-
 * unprivileged visitor gets to see.
 */
export const AdminAuthGate: React.FC<{
  title: string;
  onExit: () => void;
  children: React.ReactNode;
  mode?: 'password' | 'code' | 'manager';
}> = ({ title, onExit, children, mode = 'password' }) => {
  const { session, isAuthLoading, adminSignInWithPassword, sendLoginCode, verifyLoginCode } = useAuth();
  const [useCode, setUseCode] = useState(false);

  if (isAuthLoading) {
    return (
      <AdminRoot className="fixed inset-0 z-[200] grid place-items-center text-sm text-adm-mute-text">Loading…</AdminRoot>
    );
  }

  if (session) return <>{children}</>;

  if (mode === 'code') {
    return <CodeSignIn title={title} onExit={onExit} sendCode={sendLoginCode} verifyCode={verifyLoginCode} />;
  }

  if (mode === 'manager') {
    if (useCode) {
      return (
        <CodeSignIn
          title={title}
          onExit={onExit}
          intro={MANAGER_CODE_INTRO}
          sendCode={sendLoginCode}
          // A code sign-in is when a manager is asked to set a password (first time, or forgotten one).
          verifyCode={async (email, code) => {
            const result = await verifyLoginCode(email, code);
            if (result.success) markSetPasswordPrompt();
            return result;
          }}
          onUsePassword={() => setUseCode(false)}
        />
      );
    }
    return (
      <PasswordSignInForm
        title={title}
        description="Sign in with your email and password."
        onExit={onExit}
        onSubmit={async (email, password) => {
          const result = await adminSignInWithPassword(email, password);
          if (!result.success) return { success: false, error: friendlySignInError(result.error || '') };
          clearSetPasswordPrompt();
          return result;
        }}
        footer={
          <Button type="button" variant="link" className="self-start px-0" onClick={() => setUseCode(true)}>
            First time, or forgot your password? Email me a code
          </Button>
        }
      />
    );
  }

  return (
    <PasswordSignInForm
      title={title}
      description="Sign in with your admin email and password."
      onExit={onExit}
      onSubmit={adminSignInWithPassword}
    />
  );
};
