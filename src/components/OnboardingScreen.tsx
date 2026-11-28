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
      title: 'See which stations have gas',
      description: 'Reported live by drivers at the pump.',
      image: '/onboarding/slide-stations.webp',
    },
    {
      id: 'gps',
      title: 'Know how far it is',
      description: 'Distance and drive time to the nearest stations and conversion centres.',
      image: '/onboarding/slide-gps.webp',
    },
    {
      id: 'community',
      title: 'Get restock alerts',
      description: 'Hear when nearby stations restock and chat with drivers refilling beside you.',
      image: '/onboarding/slide-community.webp',
    },
    {
      id: 'workshops',
      title: 'Find a conversion centre',
      description: 'Accredited centres in all 36 states. Call a technician or book an inspection.',
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
            <span className="font-geist text-body font-bold text-white tracking-tight [text-shadow:0_1px_4px_rgba(0,0,0,0.4)]">
              CNG&#8209;Connect
            </span>
            <button
              onClick={onStartLogin}
              className="min-h-11 pl-4 -mr-2 pr-2 flex items-center text-micro font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)] active:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded-md"
            >
              Log in
            </button>
          </div>
        )}
      </div>

      {/* Copy + controls */}
      <div className="flex-1 flex flex-col px-6 pt-6 pb-[max(env(safe-area-inset-bottom,0px),1.5rem)] max-w-xl mx-auto w-full">
        {/* Page dots — design_handoff_cng_connect_mobile 1g: 8px, active 26x8 ink pill */}
        <div className="flex items-center -ml-1 -mt-2.5 -mb-0.5">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              aria-current={currentSlide === idx ? 'true' : undefined}
              className={`h-11 flex items-center justify-center transition-all duration-300 ${currentSlide === idx ? 'w-[34px]' : 'w-6'}`}
            >
              <span
                aria-hidden="true"
                className={`block h-2 rounded-full transition-all duration-300 ${
                  currentSlide === idx ? 'w-[26px] bg-rd-ink' : 'w-2 bg-[#C3C8C5]'
                }`}
              />
            </button>
          ))}
        </div>

        <h1 key={`t-${activeSlide.id}`} className="font-geist text-[2rem] leading-[1.15] font-bold tracking-tight animate-fade-in">
          {activeSlide.title}
        </h1>
        <p className="mt-2.5 text-caption text-rd-text-tertiary leading-relaxed">{activeSlide.description}</p>

        <div className="flex-1" />

        {isLast ? (
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onStartSignUp}
              className="w-full h-14 bg-rd-ink text-white font-geist font-bold text-body rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              Create account
            </button>
            <button
              onClick={onStartLogin}
              className="w-full h-14 bg-white text-rd-ink font-geist font-bold text-body rounded-full ring-1 ring-[#D5D8D6] active:scale-[0.98] transition-transform"
            >
              Log in
            </button>
            {onExploreAsGuest && (
              <button onClick={onExploreAsGuest} className="h-11 text-body font-bold text-primary">
                Explore as guest
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <button onClick={handleSkip} className="min-h-11 pr-4 text-body font-semibold text-rd-text-tertiary">
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
