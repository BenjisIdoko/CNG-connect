import { track } from '../services/analytics';
import { buildInviteUrl } from './referral';

export const APP_SHARE_TITLE = 'CNG-Connect';
export const APP_SHARE_TEXT =
  'Find CNG stations near you and see live pressure and queue updates from drivers. Free on CNG-Connect:';

export type ShareAppResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Opens the phone's share sheet (WhatsApp, SMS, ...) with the app link. When the driver is
 * signed in the link carries their referral code, so a friend who joins through it can earn
 * them airtime. Where the browser has no share sheet (most desktops) the message is copied.
 */
export async function shareApp(referralCode?: string | null): Promise<ShareAppResult> {
  track('share_clicked', { kind: 'app', referral: Boolean(referralCode) });
  const url = buildInviteUrl(referralCode);
  try {
    if (navigator.share) {
      await navigator.share({ title: APP_SHARE_TITLE, text: APP_SHARE_TEXT, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(`${APP_SHARE_TEXT} ${url}`);
    return 'copied';
  } catch (e) {
    // Closing the share sheet rejects with AbortError; that is not a failure.
    if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

export function shareAppToast(result: ShareAppResult): string | null {
  if (result === 'copied') return 'Link copied. Paste it in WhatsApp or a message.';
  if (result === 'failed') return 'Could not open sharing on this device.';
  return null;
}
