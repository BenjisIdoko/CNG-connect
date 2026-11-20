import React, { useState } from 'react';
import { GasStation } from '../types';
import { useSupabaseClient } from '../hooks/useSupabaseClient';
import type { RpcClient } from '../services/rpcClient';
import { notifyGasPost, postCommunityGas } from '../services/communityPostService';

interface Props {
  station: GasStation;
  /** Called after a successful post so the app can show it at once. */
  onPosted: (available: boolean) => void;
}

type Message = { kind: 'ok' | 'error'; text: string };

/**
 * The card a community manager sees on any station's page: two choices, Gas available and Gas not available.
 * Community managers are trusted ambassadors chosen by the admin, so there is no distance rule.
 */
export const CommunityGasPostCard: React.FC<Props> = ({ station, onPosted }) => {
  const supabase = useSupabaseClient();
  const [busy, setBusy] = useState<'available' | 'out' | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const post = async (available: boolean) => {
    if (busy || !supabase) return;
    setBusy(available ? 'available' : 'out');
    setMessage(null);
    const result = await postCommunityGas(supabase as unknown as RpcClient, { stationId: station.id, available });
    setBusy(null);
    if (result.ok) {
      setMessage({ kind: 'ok', text: available ? 'Posted: gas is available.' : 'Posted: gas is not available.' });
      onPosted(available);
      // Alert the drivers who opted in. Fire and forget: the post is already saved whatever happens here.
      void supabase.auth.getSession().then(({ data }) => {
        void notifyGasPost({ accessToken: data.session?.access_token ?? '', stationId: station.id });
      });
    } else {
      setMessage({ kind: 'error', text: result.error });
    }
  };

  return (
    <div className="rounded-2xl bg-rd-surface ring-1 ring-rd-divider px-4 py-3">
      <p className="text-caption text-rd-text-tertiary">Community manager</p>
      <p className="font-geist font-bold text-body-lg leading-snug text-rd-fg">Post the gas status</p>
      <p className="text-caption text-rd-text-tertiary mt-0.5">Everyone sees it.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void post(true)}
          className="min-h-[48px] flex-1 rounded-full bg-rd-available-container px-3 font-geist text-body font-bold text-rd-on-available-container outline-none focus-visible:ring-2 focus-visible:ring-rd-selected disabled:opacity-50"
        >
          {busy === 'available' ? 'Posting…' : 'Gas available'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void post(false)}
          className="min-h-[48px] flex-1 rounded-full bg-rd-out-container px-3 font-geist text-body font-bold text-rd-on-out-container outline-none focus-visible:ring-2 focus-visible:ring-rd-selected disabled:opacity-50"
        >
          {busy === 'out' ? 'Posting…' : 'Gas not available'}
        </button>
      </div>
      <p
        role={message?.kind === 'error' ? 'alert' : 'status'}
        aria-live="polite"
        className={`mt-2 text-caption font-semibold ${message?.kind === 'error' ? 'text-status-red' : 'text-rd-on-available-container'}`}
      >
        {message?.text ?? ''}
      </p>
    </div>
  );
};
