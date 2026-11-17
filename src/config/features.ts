/**
 * Application feature flags.
 * Set flags to false to cleanly hide features across the entire app
 * without removing or breaking the underlying code, components, or tests.
 */
export const FEATURES = {
  /**
   * "Share the app, earn ₦500 airtime" referral and rewards program.
   * Note: the map screen's round share button is NOT part of this flag. It always shares the bare
   * app link, with no referral code and no promo sheet.
   * When false:
   *   - Top header "Share the App" button is hidden
   *   - Desktop sidebar "Share app with drivers" button is hidden
   *   - Profile screen InviteCard is hidden
   *   - Sign-up screen "Have an invite code?" field is hidden
   *   - Admin screen "Airtime payouts" tab is hidden
   *   - Referral URL parameter capturing and claiming are disabled
   *   - Bottom-sheet ShareAppSheet modal is disabled
   */
  ENABLE_REFERRALS: false,
} as const;
