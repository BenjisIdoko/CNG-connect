import React, { useState } from 'react';
import { Modal } from './common/Modal';

export type FlagReason = 'wrong_status' | 'spam' | 'fake_photo' | 'other';

const REASONS: { key: FlagReason; label: string; hint: string }[] = [
  { key: 'wrong_status', label: 'Wrong or outdated status', hint: 'It doesn’t match what’s at the pump' },
  { key: 'fake_photo', label: 'Fake or old photo', hint: 'Not taken at this station, or reused' },
  { key: 'spam', label: 'Spam or abuse', hint: 'Ads, insults or nonsense' },
  { key: 'other', label: 'Something else', hint: '' },
];

/** Lets a signed-in driver flag a report. 3 distinct flags hide it automatically; admins review the rest. */
export const FlagReportSheet: React.FC<{
  authorName: string;
  onClose: () => void;
  onSubmit: (reason: FlagReason) => Promise<boolean>;
}> = ({ authorName, onClose, onSubmit }) => {
  const [reason, setReason] = useState<FlagReason>('wrong_status');
  const [busy, setBusy] = useState(false);

  return (
    <Modal isOpen onClose={onClose} title="Report a problem">
      <p className="text-caption text-outline -mt-1 mb-3">
        What’s wrong with {authorName}’s report? Reports flagged by several drivers are hidden automatically.
      </p>
      <div role="radiogroup" aria-label="Reason" className="flex flex-col gap-2">
        {REASONS.map((r) => {
          const on = reason === r.key;
          return (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setReason(r.key)}
              className={`text-left rounded-2xl px-4 py-3 transition-all ${
                on ? 'bg-primary-container ring-[1.5px] ring-primary' : 'bg-surface-container'
              }`}
            >
              <div className="text-body font-semibold text-on-surface">{r.label}</div>
              {r.hint && <div className="text-caption text-outline">{r.hint}</div>}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const ok = await onSubmit(reason);
          setBusy(false);
          if (ok) onClose();
        }}
        className="mt-4 w-full h-12 rounded-full bg-deep-teal text-white font-bold disabled:opacity-50 active:scale-[0.98] transition-transform"
      >
        {busy ? 'Sending…' : 'Send report'}
      </button>
    </Modal>
  );
};
