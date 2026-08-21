import React, { useEffect, useState } from 'react';
import { ASSETS } from '../data/mockData';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [carImg, setCarImg] = useState(
    ASSETS.onboardingIllustration ||
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=1200&auto=format&fit=crop'
  );

  useEffect(() => {
    const p1 = setTimeout(() => setProgress(35), 400);
    const p2 = setTimeout(() => setProgress(75), 1100);
    const p3 = setTimeout(() => setProgress(100), 1800);
    const p4 = setTimeout(() => setIsFadingOut(true), 3400);
    const p5 = setTimeout(() => onFinish(), 3900);

    return () => {
      clearTimeout(p1);
      clearTimeout(p2);
      clearTimeout(p3);
      clearTimeout(p4);
      clearTimeout(p5);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black text-white flex flex-col justify-between overflow-hidden font-['Plus_Jakarta_Sans',sans-serif] transition-opacity duration-500 ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Full-Bleed Dramatic EV Photography Background */}
      <img
        src={carImg}
        alt="Modern EV Car"
        onError={() =>
          setCarImg(
            'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?q=80&w=1200&auto=format&fit=crop'
          )
        }
        className="absolute inset-0 w-full h-full object-cover transform scale-105 transition-transform duration-[4000ms] ease-out pointer-events-none"
      />

      {/* Dark Cinematic Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090e0c] via-black/40 to-black/60 pointer-events-none" />

      {/* Top Bar - Brand Logo */}
      <div className="relative z-10 p-6 pt-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/90 p-1 backdrop-blur-md shadow-md flex items-center justify-center">
            <img src={ASSETS.logo} alt="GasFinder Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-[22px] font-black text-white tracking-tight">
            Gas<span className="text-status-green">Finder</span>
          </span>
        </div>

        {/* Minimal Progress Line */}
        <div className="w-24 bg-white/20 h-1 rounded-full overflow-hidden backdrop-blur-md">
          <div
            className="bg-status-green h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_var(--color-status-green)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Bottom Hero Typography & AutoGo-Style CTA Pill */}
      <div className="relative z-10 p-6 pb-12 max-w-md mx-auto w-full space-y-6 animate-fade-in">
        <div className="space-y-2 text-left">
          <span className="text-[11px] font-black text-status-green bg-status-green/20 px-3 py-1 rounded-full uppercase tracking-widest backdrop-blur-md border border-status-green/30 inline-block">
            Official Pi-CNG Network
          </span>

          <h1 className="text-[38px] sm:text-[42px] font-black tracking-tight leading-[1.08] text-white">
            Your ride, <br />
            <span className="text-status-green">ready to go.</span>
          </h1>

          <p className="text-[14.5px] text-slate-300 font-medium leading-relaxed max-w-xs">
            Find, report, and navigate to live CNG stations and accredited kit centers with zero stress.
          </p>
        </div>

        {/* Brand Primary Button Pill */}
        <button
          onClick={() => {
            setIsFadingOut(true);
            setTimeout(onFinish, 400);
          }}
          className="w-full h-14 bg-status-green hover:opacity-95 text-on-surface font-black text-[16px] rounded-full shadow-[0_10px_30px_rgba(0,230,118,0.35)] flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
        >
          <span>Let's Go!</span>
          <span className="material-symbols-outlined text-[20px] font-bold">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};
