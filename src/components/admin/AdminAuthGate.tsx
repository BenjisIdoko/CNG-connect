import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { AdminRoot } from './AdminRoot';
import { PasswordSignInForm } from './PasswordSignInForm';

/**
 * Sign-in screen for the admin dashboard (/admin). Password-based, not the driver app's email-code flow:
 * deliberately, so the admin isn't stuck waiting on an email round-trip every time. Renders `children` once
 * a session exists. It does not itself check `is_admin`; the dashboard decides what a signed-in-but-
 * unprivileged visitor gets to see, and the database refuses every admin action to anyone else.
 */
export const AdminAuthGate: React.FC<{
  title: string;
  onExit: () => void;
  children: React.ReactNode;
}> = ({ title, onExit, children }) => {
  const { session, isAuthLoading, adminSignInWithPassword } = useAuth();

  if (isAuthLoading) {
    return (
      <AdminRoot className="fixed inset-0 z-[200] grid place-items-center text-sm text-adm-mute-text">Loading…</AdminRoot>
    );
  }

  if (session) return <>{children}</>;

  return (
    <PasswordSignInForm
      title={title}
      description="Sign in with your admin email and password."
      onExit={onExit}
      onSubmit={adminSignInWithPassword}
    />
  );
};
