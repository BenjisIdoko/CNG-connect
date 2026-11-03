import { useEffect, useState } from 'react';
import { isDarkTheme } from '../utils/theme';

const query = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

const read = () => isDarkTheme(document.documentElement.getAttribute('data-theme'), !!query()?.matches);

/** True while the dark palette is showing, following both the system and the Profile choice. */
export function useIsDarkTheme(): boolean {
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const update = () => setDark(read());
    const mq = query();
    mq?.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    update();
    return () => {
      mq?.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);
  return dark;
}
