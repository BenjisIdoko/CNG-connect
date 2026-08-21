import React, { useState } from 'react';
import { ASSETS } from '../data/mockData';

interface OnboardingScreenProps {
  onStartSignUp: () => void;
  onStartLogin: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onStartSignUp,
  onStartLogin,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      id: 'stations',
      title: '90 Accredited CNG Refuelling Stations',
      subtitle: 'Real-Time Availability & Pressure',
      description:
        'Locate accredited CNG stations across Nigeria. Check live pump pressure (bar), queue wait times, and verified stock updates reported directly by drivers.',
      icon: 'local_gas_station',
      badge: 'Live Station Finder',
      accentColor: 'from-[#006c50] to-[#004D40]',
      image:
        'https://images.unsplash.com/photo-1545454675-3531b543be5d?q=80&w=1000&auto=format&fit=crop',
    },
    {
      id: 'gps',
      title: 'District-Accurate GPS & Live Distances',
      subtitle: 'Automatic Nearest Station Sorting',
      description:
        'Get exact physical distances (km) and drive times to Dutse-Bwari, Wuse 2, Ikeja, Oyo, and all major hubs nationwide, sorted by proximity.',
      icon: 'near_me',
      badge: 'Live Geolocation',
      accentColor: 'from-[#004D40] to-[#00281F]',
      image:
        'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=1000&auto=format&fit=crop',
    },
    {
      id: 'community',
      title: 'State Alerts & Proximity Chat',
      subtitle: 'Connected CNG Driver Network',
      description:
        'Receive instant state-wide push notifications when gas is restocked, and join physical proximity chats when refuelling at station hubs.',
      icon: 'campaign',
      badge: 'Driver Community',
      accentColor: 'from-[#007255] to-[#003828]',
      image:
        'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=1000&auto=format&fit=crop',
    },
    {
      id: 'workshops',
      title: '451 Pi-CNG Conversion Centres',
      subtitle: 'Certified Technicians & Workshops',
      description:
        'Browse Pi-CNG accredited conversion workshops in all 36 states. Verify registration codes, call technicians directly, and schedule cylinder inspections.',
      icon: 'build_circle',
      badge: 'Pi-CNG Accredited',
      accentColor: 'from-[#006c50] to-[#00E676]',
      image:
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=1000&auto=format&fit=crop',
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
    <div className="fixed inset-0 z-50 bg-[#0c1411] text-white flex flex-col justify-between overflow-hidden font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[#00E676] selection:text-[#004D40]">
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
      <div className="relative z-10 p-5 pt-8 max-w-xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-white/90 p-1 shadow-md flex items-center justify-center">
            <img src={ASSETS.logo} alt="GasFinder Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-[20px] font-extrabold text-white tracking-tight">
            Gas<span className="text-[#00E676]">Finder</span>
          </span>
        </div>

        <button
          onClick={onStartLogin}
          className="text-[13px] font-bold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3.5 py-1.5 rounded-full backdrop-blur-md transition-all active:scale-95 border border-white/15 flex items-center gap-1"
        >
          <span>Log In</span>
          <span className="material-symbols-outlined text-[16px]">login</span>
        </button>
      </div>

      {/* Main Slide Content Card */}
      <div className="relative z-10 max-w-xl mx-auto w-full px-6 flex-1 flex flex-col justify-end pb-8">
        <div className="animate-fade-in space-y-4">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 bg-[#00E676]/20 border border-[#00E676]/40 px-3 py-1 rounded-full text-[#00E676] text-[11px] font-extrabold uppercase tracking-wider backdrop-blur-md">
            <span className="material-symbols-outlined text-[15px]">{activeSlide.icon}</span>
            <span>{activeSlide.badge}</span>
          </div>

          {/* Title & Subtitle */}
          <div>
            <span className="text-[#00E676] text-[13px] font-bold block mb-1">
              {activeSlide.subtitle}
            </span>
            <h1 className="text-[26px] sm:text-[30px] font-extrabold text-white leading-tight tracking-tight">
              {activeSlide.title}
            </h1>
          </div>

          {/* Description */}
          <p className="text-[14px] font-normal text-slate-300 leading-relaxed max-w-md">
            {activeSlide.description}
          </p>

          {/* Slide Indicator Dots */}
          <div className="flex items-center gap-2 pt-2">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentSlide === idx ? 'w-8 bg-[#00E676]' : 'w-2 bg-white/30 hover:bg-white/50'
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
                className="w-full h-13 bg-[#00E676] hover:bg-[#00c853] text-[#09140f] font-extrabold text-[15px] rounded-full flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all"
              >
                <span>Create Free Account</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>

              <button
                onClick={onStartLogin}
                className="w-full h-12 bg-white/10 hover:bg-white/20 text-white font-bold text-[14px] rounded-full border border-white/20 backdrop-blur-md flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
              >
                <span>I already have an account</span>
              </button>
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
                className="flex-1 h-12 bg-[#006c50] hover:bg-[#004D40] text-white font-extrabold text-[14px] rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
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
