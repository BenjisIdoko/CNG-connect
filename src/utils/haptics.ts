/** Short vibration on supporting devices (Android Chrome). iOS Safari has no vibration API. */
export function haptic(ms: number | number[] = 12): void {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
