import React, { useState } from 'react';
import { Button } from '../ui/button';
import { CodeSignIn } from './CodeSignIn';
import { PasswordSignInForm } from './PasswordSignInForm';
import { friendlySignInError } from '../../utils/passwordRules';
import { clearSetPasswordPrompt, verifyWithSetPasswordPrompt } from '../../utils/passwordPrompt';

type Outcome = { success: boolean; error?: string };

const CODE_INTRO =
  "Enter your email and we will send you a code. After you sign in you can set a password, so you won't need a code next time.";

interface Props {
  title: string;
  onExit: () => void;
  signInWithPassword: (email: string, password: string) => Promise<Outcome>;
  sendCode: (email: string) => Promise<Outcome>;
  verifyCode: (email: string, code: string) => Promise<Outcome>;
}

/**
 * A station manager's sign-in: email and password, with an emailed code on request (the first time, or a
 * forgotten password). It lives only while nobody is signed in, so after signing out it always starts on the
 * password form again, and no code is sent unless the manager asks for one.
 */
export const ManagerSignIn: React.FC<Props> = ({ title, onExit, signInWithPassword, sendCode, verifyCode }) => {
  const [useCode, setUseCode] = useState(false);

  if (useCode) {
    return (
      <CodeSignIn
        title={title}
        onExit={onExit}
        intro={CODE_INTRO}
        codeStepNote="After you sign in, you will be asked to choose a password."
        sendCode={sendCode}
        // A code sign-in is when a manager is asked to set a password (first time, or a forgotten one).
        verifyCode={(email, code) => verifyWithSetPasswordPrompt(() => verifyCode(email, code))}
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
        const result = await signInWithPassword(email, password);
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
};
