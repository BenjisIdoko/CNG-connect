/**
 * Keeps forms usable while the on-screen keyboard is open.
 * - Publishes the keyboard height as --kb-inset (iOS Safari doesn't resize the
 *   layout viewport, so bottom-pinned sheets/buttons would sit under the keyboard).
 * - Scrolls a focused field into view once the keyboard has animated in.
 * Android Chrome resizes the layout itself (interactive-widget=resizes-content),
 * in which case the inset simply stays 0.
 */
export function installKeyboardInset(): void {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  if (vv) {
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      document.documentElement.style.setProperty('--kb-inset', `${inset}px`);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
  }
  document.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement | null;
    if (!el?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
    window.setTimeout(() => {
      try {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {
        /* element may have unmounted */
      }
    }, 320);
  });
}
