import React from 'react';

interface Props {
  busy: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

/**
 * The one-time question shown right after a driver favourites a station: do they want an alert when a
 * community manager posts that gas has arrived (or run out). Pinned above the bottom nav like the install
 * banner. Asking at this moment, not buried in Profile, is what makes people say yes.
 */
export const PushAlertPrompt: React.FC<Props> = ({ busy, onAccept, onDismiss }) => (
  <section aria-label="Gas alerts" data-theme="light" className="fixed inset-x-0 bottom-[7.5rem] z-40 px-4 pointer-events-none">
    <div className="max-w-md mx-auto pointer-events-auto bg-rd-ink text-white rounded-2xl shadow-[0_10px_30px_rgba(20,32,26,0.3)] p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
          <span aria-hidden="true" className="material-symbols-outlined text-[22px]">notifications_active</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-geist text-body font-semibold text-white leading-tight">Get an alert when gas arrives here?</p>
          <p className="text-caption text-white/70 mt-0.5">
            A community manager at the station tells you the moment gas is available or runs out.
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="min-h-11 flex-1 rounded-full bg-primary px-4 font-geist text-caption font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60 active:scale-95 transition-transform"
        >
          {busy ? 'Turning on…' : 'Turn on alerts'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="min-h-11 rounded-full px-4 font-geist text-caption font-bold text-white/80 outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-60"
        >
          Not now
        </button>
      </div>
    </div>
  </section>
);
