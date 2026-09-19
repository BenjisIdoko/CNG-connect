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
      title: 'Live pressure and queue status, before you drive there.',
      description:
        'See which stations actually have gas right now — reported by drivers who are there.',
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

  const isLast = currentSlide === slides.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-white text-slate-900 flex flex-col overflow-hidden font-['Urbanist',sans-serif]">
      {/* Hero photo */}
      <div className="relative h-[55%] min-h-[300px] shrink-0 bg-surface-container-high">
        <img
          key={activeSlide.id}
          src={activeSlide.image}
          alt={activeSlide.title}
          className="w-full h-full object-cover animate-fade-in"
        />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
        <div className="absolute top-0 inset-x-0 pt-[max(env(safe-area-inset-top,0px),1.25rem)] px-6 flex items-center justify-between max-w-xl mx-auto">
          <span className="text-[17px] font-extrabold text-white tracking-tight [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]">
            CNG&#8209;Connect
          </span>
          <button
            onClick={onStartLogin}
            className="text-[13px] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)] active:opacity-70"
          >
            Log in
          </button>
        </div>
      </div>

      {/* Copy + controls */}
      <div className="flex-1 flex flex-col px-6 pt-6 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] max-w-xl mx-auto w-full">
        <h1 key={`t-${activeSlide.id}`} className="text-[24px] leading-[1.25] font-bold tracking-tight animate-fade-in">
          {activeSlide.title}
        </h1>
        <p className="mt-2.5 text-[14px] text-on-surface-variant leading-relaxed">{activeSlide.description}</p>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 my-5">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentSlide === idx ? 'w-[22px] bg-primary' : 'w-1.5 bg-surface-dim'
              }`}
            />
          ))}
        </div>

        {isLast ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={onStartSignUp}
              className="w-full py-4 bg-primary text-white font-bold text-[15px] rounded-full flex items-center justify-center gap-2 shadow-[0_8px_18px_rgba(49,154,63,0.3)] active:scale-[0.98] transition-transform"
            >
              Sign Up
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
            <div className="flex items-center justify-center gap-8">
              <button onClick={onStartLogin} className="text-[14px] font-semibold text-slate-900 py-1">
                Log in
              </button>
              {onExploreAsGuest && (
                <button onClick={onExploreAsGuest} className="text-[14px] font-semibold text-outline py-1">
                  Explore as guest
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentSlide(slides.length - 1)}
              className="text-[14px] font-semibold text-on-surface-variant py-2 pr-4"
            >
              Skip
            </button>
            <div className="flex items-center gap-3">
              {currentSlide > 0 && (
                <button
                  onClick={handlePrev}
                  aria-label="Previous slide"
                  className="w-12 h-12 rounded-full bg-surface-container text-slate-900 flex items-center justify-center active:scale-95 transition-transform"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
              )}
              <button
                onClick={handleNext}
                aria-label="Continue"
                className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center active:scale-95 transition-transform shadow-[0_6px_14px_rgba(49,154,63,0.35)]"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
