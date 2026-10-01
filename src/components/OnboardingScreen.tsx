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
      image: '/onboarding/slide-stations.webp',
    },
    {
      id: 'gps',
      title: 'Accurate GPS & Live Distances',
      description:
        'Get real-time distances (km) and drive times to the nearest stations and conversion centres.',
      image: '/onboarding/slide-gps.webp',
    },
    {
      id: 'community',
      title: 'State Alerts & Proximity Chat',
      description:
        'Get instant alerts when nearby stations restock, and chat with other drivers refilling alongside you.',
      image: '/onboarding/slide-community.webp',
    },
    {
      id: 'workshops',
      title: 'Access CNG Conversion Centres',
      description:
        'Browse CNG-accredited conversion centres in all 36 states. Verify registration codes, call technicians directly, and schedule cylinder inspections.',
      image: '/onboarding/slide-workshops.webp',
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

  // "Skip" means "let me in now" — straight to the map as a guest when that's on offer,
  // not one more slide with yet another tap before they can leave onboarding.
  const handleSkip = () => {
    if (onExploreAsGuest) onExploreAsGuest();
    else setCurrentSlide(slides.length - 1);
  };

  return (
    // data-theme="light": same reasoning as the other rebuilt screens — the handoff has no
    // dark-mode values yet.
    <div data-theme="light" className="fixed inset-0 z-50 bg-rd-bg text-rd-ink flex flex-col overflow-hidden">
      {/* Hero photo — design_handoff_cng_connect_mobile 1g: fixed height, rounded bottom corners */}
      <div className="relative h-[430px] shrink-0 bg-surface-container-high rounded-b-[36px] overflow-hidden">
        <img
          key={activeSlide.id}
          src={activeSlide.image}
          alt={activeSlide.title}
          className="w-full h-full object-cover animate-fade-in"
        />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
        {!isLast && (
          <div className="absolute top-0 inset-x-0 pt-[max(env(safe-area-inset-top,0px),1.25rem)] px-6 flex items-center justify-between max-w-xl mx-auto">
            <span className="font-geist text-[1.0625rem] font-extrabold text-white tracking-tight [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]">
              CNG&#8209;Connect
            </span>
            <button
              onClick={onStartLogin}
              className="text-[0.875rem] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)] active:opacity-70"
            >
              Log in
            </button>
          </div>
        )}
      </div>

      {/* Copy + controls */}
      <div className="flex-1 flex flex-col px-6 pt-6 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] max-w-xl mx-auto w-full">
        {/* Page dots — design_handoff_cng_connect_mobile 1g: 8px, active 26x8 ink pill */}
        <div className="flex items-center gap-1.5 mb-5">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentSlide === idx ? 'w-[26px] bg-rd-ink' : 'w-2 bg-[#C3C8C5]'
              }`}
            />
          ))}
        </div>

        <h1 key={`t-${activeSlide.id}`} className="font-geist text-[2rem] leading-[1.15] font-bold tracking-tight animate-fade-in">
          {activeSlide.title}
        </h1>
        <p className="mt-2.5 text-[0.9375rem] text-rd-text-tertiary leading-relaxed">{activeSlide.description}</p>

        <div className="flex-1" />

        {isLast ? (
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onStartSignUp}
              className="w-full h-14 bg-rd-ink text-white font-geist font-bold text-[0.9375rem] rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              Create account
            </button>
            <button
              onClick={onStartLogin}
              className="w-full h-14 bg-white text-rd-ink font-geist font-bold text-[0.9375rem] rounded-full ring-1 ring-[#D5D8D6] active:scale-[0.98] transition-transform"
            >
              Log in
            </button>
            {onExploreAsGuest && (
              <button onClick={onExploreAsGuest} className="h-10 text-[0.9375rem] font-bold text-primary">
                Explore as guest
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button onClick={handleSkip} className="text-[0.9375rem] font-semibold text-rd-text-tertiary py-2 pr-4">
              Skip
            </button>
            <div className="flex items-center gap-3">
              {currentSlide > 0 && (
                <button
                  onClick={handlePrev}
                  aria-label="Previous slide"
                  className="w-12 h-12 rounded-full bg-surface-container text-rd-ink flex items-center justify-center active:scale-95 transition-transform"
                >
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
              )}
              <button
                onClick={handleNext}
                aria-label="Continue"
                className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center active:scale-95 transition-transform shadow-[0_6px_14px_rgba(49,154,63,0.35)]"
              >
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
