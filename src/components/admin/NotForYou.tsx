import React from 'react';

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
  <div data-theme="light" className="fixed inset-0 z-[200] grid place-items-center bg-slate-50 p-6">
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-3">
      <h1 className="text-lg font-extrabold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500">{message}</p>
      <a
        href={linkHref}
        className="rounded-lg bg-emerald-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-emerald-700"
      >
        {linkLabel}
      </a>
      <button type="button" onClick={onSignOut} className="text-xs font-semibold text-slate-500 hover:underline">
        Sign out
      </button>
    </div>
  </div>
);
