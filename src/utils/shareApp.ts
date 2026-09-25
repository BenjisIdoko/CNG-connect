import { track } from '../services/analytics';

const APP_URL = 'https://cngconnect.com.ng';

export const APP_SHARE_TITLE = 'CNG-Connect';
export const APP_SHARE_TEXT =
  'Find CNG stations near you and see live pressure and queue updates from drivers. Free on CNG-Connect:';

export type ShareAppResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Opens the phone's share sheet (WhatsApp, SMS, ...) with the app link. Where the
 * browser has no share sheet (most desktops) the message is copied instead.
 */
export async function shareApp(): Promise<ShareAppResult> {
  track('share_clicked', { kind: 'app' });
  try {
    if (navigator.share) {
      await navigator.share({ title: APP_SHARE_TITLE, text: APP_SHARE_TEXT, url: APP_URL });
      return 'shared';
    }
    await navigator.clipboard.writeText(`${APP_SHARE_TEXT} ${APP_URL}`);
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
