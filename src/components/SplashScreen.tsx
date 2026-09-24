import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

const SEEN_KEY = 'cng_splash_seen_v2';

/** Splash is only worth showing once: returning drivers go straight to the map. */
export function shouldShowSplash(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    return false;
  }
}

/**
 * A short brand moment on the very first launch: app mark + wordmark on the dark
 * ground (matches the installed-app icon), auto-dismissing in ~1.2 s. No button,
 * no marketing copy — the onboarding slides that follow do the explaining.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* private mode: splash may show again, harmless */
    }
    const t1 = setTimeout(() => setLeaving(true), 900);
    const t2 = setTimeout(onFinish, 1250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onFinish]);

  return (
    <div
      role="status"
      aria-label="CNG-Connect is loading"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_35%_30%,#28362F,#1A2420)] text-white transition-opacity duration-300 ${
        leaving ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <img src="/pwa-icon.svg" alt="" className="burst-pop w-28 h-28 rounded-[28px] shadow-[0_18px_50px_rgba(0,0,0,0.45)]" />
      <span className="font-headline font-extrabold text-[1.5rem] tracking-tight">
        CNG-<span className="text-[#57C06A]">Connect</span>
      </span>
    </div>
  );
};
