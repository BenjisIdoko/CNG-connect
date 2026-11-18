import React from 'react';
import { AdminRoot } from './AdminRoot';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

interface Props {
  title: string;
  message: string;
  linkLabel: string;
  linkHref: string;
  onSignOut: () => void;
}

/**
 * Shown to someone who is signed in at the wrong back-office entrance (for example a station
 * manager at /admin). The database refuses them anyway; this just says so plainly and points
 * them at the entrance that is theirs.
 */
export const NotForYou: React.FC<Props> = ({ title, message, linkLabel, linkHref, onSignOut }) => (
  <AdminRoot className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto p-6">
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <a
          href={linkHref}
          className="inline-flex h-11 items-center justify-center rounded-md bg-adm-foil px-6 text-sm font-semibold text-adm-ink outline-none transition-colors hover:bg-adm-foil-hover focus-visible:ring-2 focus-visible:ring-adm-note focus-visible:ring-offset-2 focus-visible:ring-offset-adm-paper"
        >
          {linkLabel}
        </a>
        <Button type="button" variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
      </CardContent>
    </Card>
  </AdminRoot>
);
