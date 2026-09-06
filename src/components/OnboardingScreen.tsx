import React, { useState } from 'react';
import { ASSETS } from '../data/mockData';

interface OnboardingScreenProps {
  onStartSignUp: () => void;
  onStartLogin: () => void;
  onExploreAsGuest?: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onStartSignUp,
  onStartLogin,
  onExploreAsGuest,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 'stations',
      title: 'Find CNG Refilling Stations',
      description:
        'Locate CNG stations across Nigeria. Check live pump pressure (bar), queue wait times, and verified gas-availability updates reported directly by drivers.',
      image: '/onboarding/slide-stations.jpg',
    },
    {
      id: 'gps',
      title: 'Accurate GPS & Live Distances',
      description:
        'Get real-time distances (km) and drive times to the nearest stations and conversion centres.',
      image: '/onboarding/slide-gps.jpg',
    },
    {
      id: 'community',
      title: 'State Alerts & Proximity Chat',
      description:
        'Get instant alerts when nearby stations restock, and chat with other drivers refilling alongside you.',
      image: '/onboarding/slide-community.jpg',
    },
    {
      id: 'workshops',
      title: 'Access CNG Conversion Centres',
      description:
        'Browse CNG-accredited conversion centres in all 36 states. Verify registration codes, call technicians directly, and schedule cylinder inspections.',
      image: '/onboarding/slide-workshops.jpg',
    },
  ];

  const activeSlide = slides[currentSlide];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      onStartSignUp();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c1411] text-white flex flex-col justify-between overflow-hidden font-['Plus_Jakarta_Sans',sans-serif] selection:bg-status-green selection:text-deep-teal">
      {/* Dynamic Background Image with Smooth Gradient Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={activeSlide.image}
          alt={activeSlide.title}
          className="w-full h-full object-cover transform scale-105 transition-all duration-700 filter brightness-[0.45]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c1411] via-[#0c1411]/80 to-black/60" />
      </div>

      {/* Top Header Bar */}
      <div className="relative z-10 p-4 pt-8 max-w-xl mx-auto w-full flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
          <div className="w-8 h-8 rounded-xl bg-white/90 p-1 shadow-md flex items-center justify-center shrink-0">
            <img src={ASSETS.logo} alt="CNG-Connect Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-[20px] font-extrabold text-white tracking-tight">
            CNG-<span className="text-status-green">Connect</span>
          </span>
        </div>

        <button
          onClick={onStartLogin}
          className="shrink-0 h-9 px-4 text-[12.5px] font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all active:scale-95 border border-white/15 flex items-center justify-center gap-1 whitespace-nowrap"
        >
          <span>Log In</span>
          <span className="material-symbols-outlined text-[15px]">login</span>
        </button>
      </div>

      {/* Main Slide Content Card */}
      <div className="relative z-10 max-w-xl mx-auto w-full px-6 flex-1 flex flex-col justify-end pb-8">
        <div className="animate-fade-in space-y-3">
          <h1 className="text-[24px] sm:text-[28px] font-bold text-white leading-tight tracking-tight">
            {activeSlide.title}
          </h1>

          <p className="text-[14px] font-normal text-slate-300 leading-relaxed max-w-md">
            {activeSlide.description}
          </p>

          {/* Slide Indicator Dots */}
          <div className="flex items-center gap-2 pt-1">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${currentSlide === idx ? 'w-8 bg-status-green' : 'w-2 bg-white/30 hover:bg-white/50'
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Bottom Action Controls */}
        <div className="pt-6 space-y-3">
          {currentSlide === slides.length - 1 ? (
            /* Final Slide: Primary Registration & Login Buttons */
            <div className="flex flex-col gap-2.5">
              <button
                onClick={onStartSignUp}
                className="w-full h-13 bg-status-green hover:opacity-95 text-on-surface font-extrabold text-[15px] rounded-full flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"
              >
                <span className="whitespace-nowrap">Sign Up</span>
                <span className="material-symbols-outlined text-[20px] shrink-0">arrow_forward</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onStartLogin}
                  className="w-full h-11 bg-white/10 hover:bg-white/20 text-white font-bold text-[13.5px] rounded-full border border-white/20 backdrop-blur-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all whitespace-nowrap"
                >
                  <span>Log In</span>
                </button>

                {onExploreAsGuest && (
                  <button
                    onClick={onExploreAsGuest}
                    className="w-full h-11 bg-white/5 hover:bg-white/15 text-slate-300 font-bold text-[13.5px] rounded-full border border-white/10 backdrop-blur-md flex items-center justify-center gap-1 active:scale-[0.98] transition-all whitespace-nowrap"
                  >
                    <span>Explore</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Navigation Buttons */
            <div className="flex items-center justify-between gap-3">
              {currentSlide > 0 ? (
                <button
                  onClick={handlePrev}
                  className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/15 backdrop-blur-md active:scale-95 transition-all"
                  aria-label="Previous slide"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
              ) : (
                <div className="w-12" />
              )}

              <button
                onClick={handleNext}
                className="flex-1 h-12 bg-primary hover:opacity-95 text-on-primary font-extrabold text-[14px] rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
              >
                <span>Continue</span>
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
