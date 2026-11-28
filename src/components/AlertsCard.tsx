import React from 'react';
import type { AlertsCardAction, AlertsCardButton, AlertsCardModel } from '../utils/alertsCard';

interface Props {
  model: AlertsCardModel;
  onAction: (action: AlertsCardAction) => void;
  /** Turning alerts on or off is in progress. */
  busy?: boolean;
  /** A test alert is being sent. */
  testBusy?: boolean;
}

const ICONS: Record<AlertsCardModel['kind'], string> = {
  signed_out: 'notifications',
  not_set_up: 'notifications',
  ios_old: 'ios_share',
  ios_install: 'ios_share',
  unsupported: 'info',
  blocked: 'warning',
  off: 'notifications',
  on: 'notifications_active',
};

/**
 * The Alerts card on Profile. It shows one state at a time (see describeAlertsCard), so a driver always sees
 * what is true for their phone and the one thing to do about it.
 */
export const AlertsCard: React.FC<Props> = ({ model, onAction, busy = false, testBusy = false }) => {
  const isOn = model.kind === 'on';
  const label = (button: AlertsCardButton): string => {
    if (button.action === 'enable' && busy) return 'Turning on…';
    if (button.action === 'disable' && busy) return 'Turning off…';
    if (button.action === 'test' && testBusy) return 'Sending…';
    return button.label;
  };
  const working = busy || testBusy;

  return (
    <section
      aria-label="Gas alerts"
      className="bg-surface-container-high rounded-2xl p-4 shadow-[0_4px_14px_rgba(14,20,32,0.05)] flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            isOn ? 'bg-rd-available-container text-rd-on-available-container' : 'bg-surface-container text-outline'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">{ICONS[model.kind]}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold text-on-surface leading-tight">{model.title}</h2>
          {model.body && <p className="mt-1 text-caption text-outline">{model.body}</p>}
        </div>
      </div>

      {model.steps && (
        <ol className="flex flex-col gap-2.5">
          {model.steps.map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="shrink-0 w-6 h-6 rounded-full bg-surface-container text-on-surface text-micro font-semibold flex items-center justify-center"
              >
                {index + 1}
              </span>
              <span className="text-caption text-on-surface pt-px">{step}</span>
            </li>
          ))}
        </ol>
      )}

      {model.note && (
        <div className="rounded-xl bg-surface-container px-3 py-2.5 flex items-center justify-between gap-3">
          <p className="text-caption text-on-surface">{model.note.text}</p>
          {model.note.action && (
            <button
              type="button"
              onClick={() => onAction(model.note!.action!.action)}
              className="min-h-11 shrink-0 px-2 text-caption font-bold text-primary outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md active:opacity-70"
            >
              {model.note.action.label}
            </button>
          )}
        </div>
      )}

      {(model.primary || model.secondary) && (
        <div className="flex flex-col gap-1">
          {model.primary && (
            <button
              type="button"
              onClick={() => onAction(model.primary!.action)}
              disabled={working}
              className="min-h-11 w-full rounded-full bg-primary px-4 text-caption font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
            >
              {label(model.primary)}
            </button>
          )}
          {model.secondary && (
            <button
              type="button"
              onClick={() => onAction(model.secondary!.action)}
              disabled={working}
              className="min-h-11 w-full rounded-full px-4 text-caption font-bold text-outline outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 active:opacity-70"
            >
              {label(model.secondary)}
            </button>
          )}
        </div>
      )}
    </section>
  );
};
