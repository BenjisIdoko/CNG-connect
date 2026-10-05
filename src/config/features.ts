/**
 * Application feature flags.
 * Set flags to false to cleanly hide features across the entire app
 * without removing or breaking the underlying code, components, or tests.
 */
export const FEATURES = {
  /**
   * "Share the app, earn ₦500 airtime" referral and rewards program.
   * When false:
   *   - Map screen round share button is hidden
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
