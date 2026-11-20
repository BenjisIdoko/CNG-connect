import React from 'react';

interface Props {
  busy: boolean;
  onSend: () => void;
}

/**
 * A row on the Profile page, shown once alerts are on: one button that sends a test alert to this phone, so
 * the driver can see that alerts really arrive. It matches the other Profile rows.
 */
export const SendTestAlertRow: React.FC<Props> = ({ busy, onSend }) => (
  <div className="px-4 py-3.5 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-outline">notifications_active</span>
      <div className="min-w-0">
        <span className="text-body font-semibold block leading-tight text-on-surface">Send a test alert</span>
        <span className="text-micro text-outline">Checks that alerts reach this phone</span>
      </div>
    </div>
    <button
      type="button"
      onClick={onSend}
      disabled={busy}
      className="min-h-11 shrink-0 rounded-full bg-primary px-4 text-caption font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 active:scale-95 transition-transform"
    >
      {busy ? 'Sending…' : 'Send test'}
    </button>
  </div>
);
