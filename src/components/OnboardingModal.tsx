import React, { useState } from 'react';
import { ASSETS } from '../data/mockData';
import { Modal } from './common/Modal';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (phoneNumber: string) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+234');
  const [countryFlag, setCountryFlag] = useState('🇳🇬');
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [email, setEmail] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const countries = [
    { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
    { code: '+233', flag: '🇬🇭', name: 'Ghana' },
    { code: '+254', flag: '🇰🇪', name: 'Kenya' },
    { code: '+27', flag: '🇿🇦', name: 'South Africa' },
    { code: '+44', flag: '🇬🇧', name: 'United Kingdom' },
    { code: '+1', flag: '🇺🇸', name: 'United States' },
  ];

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    let formatted = value;
    if (value.length > 4) {
      formatted = value.slice(0, 4) + ' ' + value.slice(4);
    }
    if (value.length > 7) {
      formatted =
        value.slice(0, 4) +
        ' ' +
        value.slice(4, 7) +
        ' ' +
        value.slice(7);
    }
    setPhoneNumber(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess(isEmailMode ? email : `${countryCode} ${phoneNumber}`);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Welcome to CNG-Connect" className="max-w-md min-h-screen sm:min-h-0 bg-surface border border-outline-variant flex flex-col justify-between">
      <div className="w-full max-w-md min-h-screen sm:min-h-0 bg-surface sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col justify-between border border-outline-variant">
        {/* Top Graphic Illustration Header */}
        <div className="w-full flex-shrink-0 relative overflow-hidden bg-surface-container rounded-b-[36px] pt-8 pb-6 border-b border-outline-variant/60">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-20 w-11 h-11 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-on-surface hover:bg-white active:scale-95 transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div className="relative w-full h-56 max-w-sm mx-auto px-4">
            <img
              src={ASSETS.onboardingIllustration}
              alt="CNG-Connect Ultra Realistic CNG Car"
              className="w-full h-full object-cover rounded-2xl shadow-xl border border-white/40"
            />
          </div>
        </div>

        {/* Form Body */}
        <div className="flex-1 flex flex-col px-6 pt-6 pb-8">
          <div className="text-center mb-6">
            <h1 className="text-[28px] font-bold text-on-surface tracking-tight leading-tight mb-2">
              Never guess where the gas is.
            </h1>
            <p className="text-[16px] font-normal text-on-surface-variant max-w-[280px] mx-auto leading-snug">
              Live station status from drivers near you.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
            {!isEmailMode ? (
              <div className="relative w-full">
                <div className="flex items-center h-[56px] bg-surface-container rounded-2xl overflow-hidden shadow-xs border border-outline-variant focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
                  <button
                    type="button"
                    onClick={() => setShowCountryPicker(!showCountryPicker)}
                    className="flex items-center gap-1.5 px-3.5 h-full border-r border-outline-variant/50 text-on-surface font-semibold text-[15px] hover:bg-surface-container-high transition-colors"
                  >
                    <span className="text-xl">{countryFlag}</span>
                    <span>{countryCode}</span>
                    <span className="material-symbols-outlined text-outline text-[18px]">
                      expand_more
                    </span>
                  </button>

                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="0800 000 0000"
                    className="flex-1 h-full bg-transparent px-4 text-[16px] font-medium text-on-surface placeholder:text-outline focus:outline-none w-full"
                  />
                </div>

                {/* Country Picker Dropdown */}
                {showCountryPicker && (
                  <div className="absolute top-16 left-0 w-64 bg-white rounded-2xl shadow-xl border border-outline-variant z-30 p-2 max-h-52 overflow-y-auto">
                    {countries.map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          setCountryCode(c.code);
                          setCountryFlag(c.flag);
                          setShowCountryPicker(false);
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-surface text-[14px] font-medium text-on-surface"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-lg">{c.flag}</span>
                          <span>{c.name}</span>
                        </span>
                        <span className="text-primary font-bold">{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-full">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="driver@example.com"
                  className="w-full h-[56px] bg-surface-container rounded-2xl px-4 text-[16px] font-medium text-on-surface placeholder:text-outline border border-outline-variant focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            )}

            {/* Continue Button */}
            <button
              type="submit"
              className="w-full h-[56px] rounded-full bg-primary text-on-primary font-bold text-[16px] shadow-md hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
            >
              <span>Continue</span>
              <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </button>

            {/* Toggle Mode */}
            <button
              type="button"
              onClick={() => setIsEmailMode(!isEmailMode)}
              className="w-full py-2 text-primary font-semibold text-[14px] hover:underline underline-offset-4 rounded-lg"
            >
              {isEmailMode ? 'Continue with phone number' : 'Continue with email'}
            </button>
          </form>

          {/* Legal Disclaimer */}
          <div className="mt-auto pt-6 text-center">
            <p className="text-[12px] text-outline leading-relaxed max-w-[280px] mx-auto">
              By continuing, you agree to CNG-Connect{' '}
              <a href="#" className="text-primary underline font-medium">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-primary underline font-medium">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
