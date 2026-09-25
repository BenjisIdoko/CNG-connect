import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { shareApp, shareAppToast } from '../utils/shareApp';

const REWARD = 500;

type Summary = { code: string; pending: number; owed: number; paid: number; slotsLeft: number };

/** "Invite drivers, earn ₦500 airtime" — the driver's link, code and progress. */
export const InviteCard: React.FC<{
  onSignIn?: () => void;
  onToast: (m: string) => void;
  /** 'sheet' drops the card chrome and title (the sheet supplies its own) and shows the three steps. */
  variant?: 'card' | 'sheet';
}> = ({ onSignIn, onToast, variant = 'card' }) => {
  const isSheet = variant === 'sheet';
  const { isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    apiService.getReferralSummary().then((s) => {
      if (cancelled) return;
      setSummary(s);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const share = async () => {
    const msg = shareAppToast(await shareApp(summary?.code));
    if (msg) onToast(msg);
  };

  const copyCode = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary.code);
      onToast('Code copied');
    } catch {
      onToast(`Your code: ${summary.code}`);
    }
  };

  return (
    <section
      aria-labelledby={isSheet ? undefined : 'invite-title'}
      className={isSheet ? '' : 'bg-white rounded-2xl p-4 shadow-[0_4px_14px_rgba(14,20,32,0.05)] border border-primary/15'}
    >
      {isSheet ? (
        <ol className="flex flex-col gap-3">
          {[
            { icon: 'share', title: 'Share your link', text: 'Send it on WhatsApp, SMS or anywhere.' },
            { icon: 'person_add', title: 'A friend joins', text: 'They sign up with your link and file their first station report.' },
            { icon: 'call', title: `You get ₦${REWARD} airtime`, text: `Up to ₦${(REWARD * 10).toLocaleString()} (10 friends) per driver.` },
          ].map((step, i) => (
            <li key={step.title} className="flex items-start gap-3">
              <span aria-hidden="true" className="w-9 h-9 rounded-full bg-primary-container text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">{step.icon}</span>
              </span>
              <div className="min-w-0">
                <p className="font-bold text-body text-on-surface leading-tight">
                  {i + 1}. {step.title}
                </p>
                <p className="text-caption text-on-surface-variant">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="w-10 h-10 rounded-full bg-primary-container text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">share</span>
          </span>
          <div className="min-w-0">
            <h2 id="invite-title" className="font-bold text-body-lg leading-tight">
              Invite drivers, earn ₦{REWARD} airtime
            </h2>
            <p className="text-caption text-on-surface-variant mt-1">
              When a friend joins with your link and files their first station report, you get ₦{REWARD} airtime. Up to ₦
              {(REWARD * 10).toLocaleString()} per driver.
            </p>
          </div>
        </div>
      )}

      {!isAuthenticated ? (
        <>
          <button
            onClick={onSignIn}
            className="mt-4 w-full h-12 rounded-full bg-deep-teal text-white font-bold text-caption active:scale-[0.98] transition-transform"
          >
            Sign in to get your invite link
          </button>
          {isSheet && (
            <button onClick={share} className="mt-1 w-full py-3 text-caption font-semibold text-on-surface-variant">
              Just share the app (no reward)
            </button>
          )}
        </>
      ) : (
        <>
          {summary && (
            <button
              onClick={copyCode}
              aria-label={`Your invite code ${summary.code}. Tap to copy`}
              className="mt-4 w-full flex items-center justify-between bg-surface-container rounded-2xl px-4 py-3 active:scale-[0.99] transition-transform"
            >
              <span className="text-micro font-semibold text-outline">Your code</span>
              <span className="font-mono font-bold tracking-[0.2em] text-body-lg text-on-surface">{summary.code}</span>
              <span aria-hidden="true" className="material-symbols-outlined text-outline text-[18px]">content_copy</span>
            </button>
          )}

          <button
            onClick={share}
            className="mt-2 w-full h-12 rounded-full bg-primary text-white font-bold text-caption flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">share</span>
            Share invite link
          </button>

          {summary && (
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Waiting', value: summary.pending, hint: 'joined, no report yet' },
                { label: 'Earned', value: `₦${(summary.owed * REWARD).toLocaleString()}`, hint: 'airtime to be sent' },
                { label: 'Paid', value: `₦${(summary.paid * REWARD).toLocaleString()}`, hint: 'airtime sent' },
              ].map((s) => (
                <div key={s.label} className="bg-surface-container rounded-xl py-2 px-1">
                  <dt className="text-micro font-semibold text-outline">{s.label}</dt>
                  <dd className="font-extrabold text-body text-on-surface">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {loaded && !summary && (
            <p className="mt-2 text-micro text-outline">Your personal code isn’t available yet, so the link won’t earn airtime. Try again later.</p>
          )}
          <p className="mt-3 text-micro text-outline">
            We review each referral, then send the airtime to the phone number on your profile. One reward per phone number.
            {summary && summary.slotsLeft === 0 ? ' You have reached the ₦5,000 limit.' : ''}
          </p>
        </>
      )}
    </section>
  );
};
