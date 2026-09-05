import React, { useState, useEffect } from 'react';
import { ASSETS } from '../data/mockData';
import { validatePhoneNumber } from '../utils/phoneValidator';
import { validateEmail } from '../utils/emailValidator';
import { useAuth } from '../context/AuthContext';

interface SignUpScreenProps {
  /** Called once the driver is fully signed in — for a returning driver this fires right after OTP verification; for a new driver, after they complete their profile. */
  onComplete: () => void;
  onCancel?: () => void;
}

/**
 * Unified sign-in/sign-up: email + one-time code (Supabase Auth). There is no
 * separate "login" flow anymore — signInWithOtp transparently creates the
 * account on first verification, so the exact same two steps serve both a
 * new driver and a returning one. A brand-new driver additionally sees a
 * short "complete your profile" step; a returning driver skips straight in.
 */
export const SignUpScreen: React.FC<SignUpScreenProps> = ({ onComplete, onCancel }) => {
  const { sendLoginCode, verifyLoginCode, updateProfile } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: identity
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);

  // Step 2: verification code
  const [userCodeInput, setUserCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Step 3: profile completion (new drivers only)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [city, setCity] = useState('Abuja FCT');
  const [vehicleMake, setVehicleMake] = useState('Toyota Camry');
  const [vehicleYear, setVehicleYear] = useState('2018');
  const [vehicleType, setVehicleType] = useState<'private' | 'taxi' | 'keke' | 'truck'>('private');
  const [cngStatus, setCngStatus] = useState<'installed' | 'planning' | 'interested'>('installed');
  const [tankSize, setTankSize] = useState('15kg');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleStep1Submit = async () => {
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error || 'Please enter a valid email address.');
      return;
    }

    setEmailError(null);
    setIsSendingCode(true);
    const res = await sendLoginCode(emailValidation.normalized || email);
    setIsSendingCode(false);

    if (!res.success) {
      setEmailError(res.error || 'Failed to send verification email.');
      return;
    }

    setResendCooldown(60);
    setUserCodeInput('');
    setCodeError(null);
    setStep(2);
  };

  const handleStep2Submit = async () => {
    // Supabase's email OTP length is a project-level setting (6-10 digits,
    // 6 by default) — don't hard-code an exact length here, or a project
    // configured for e.g. 8 digits would have every code rejected client-side
    // before it ever reached verifyOtp.
    if (userCodeInput.trim().length < 6) {
      setCodeError('Please enter the verification code from your email.');
      return;
    }

    setIsVerifyingCode(true);
    setCodeError(null);
    const emailValidation = validateEmail(email);
    const res = await verifyLoginCode(emailValidation.normalized || email, userCodeInput.trim());
    setIsVerifyingCode(false);

    if (!res.success) {
      setCodeError(res.error || 'Verification failed. Please check your code.');
      return;
    }

    if (res.isNewDriver) {
      setStep(3);
    } else {
      onComplete();
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    const emailValidation = validateEmail(email);
    setIsSendingCode(true);
    const res = await sendLoginCode(emailValidation.normalized || email);
    setIsSendingCode(false);

    if (!res.success) {
      setCodeError(res.error || 'Failed to resend code.');
      return;
    }
    setResendCooldown(60);
    setUserCodeInput('');
    setCodeError(null);
  };

  const handleStep3Submit = async () => {
    const phoneValidation = validatePhoneNumber(phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error || 'Please enter a valid Nigerian phone number (0 + 10 digits, e.g. 0803 123 4567)');
      return;
    }

    setIsSavingProfile(true);
    await updateProfile({
      name: fullName.trim() || 'CNG Driver',
      phone: phoneValidation.formatted || phone.trim(),
      avatar: ASSETS.userAvatar,
      vehicle: `${vehicleYear} ${vehicleMake} (${cngStatus === 'installed' ? `CNG ${tankSize}` : 'Petrol'})`,
      cngInstalledDate: cngStatus === 'installed' ? 'Recently Installed' : 'Planning',
      monthlySavings: cngStatus === 'installed' ? 78500 : 0,
      reportsCount: 0,
      reputationScore: 5.0,
      communityPoints: 100,
      state: city.includes('Lagos') ? 'Lagos' : city.includes('Edo') ? 'Edo' : city.includes('Oyo') ? 'Oyo' : city.includes('Rivers') ? 'Rivers' : city.includes('Kano') ? 'Kano' : 'Abuja FCT',
    });
    setIsSavingProfile(false);
    onComplete();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) handleStep1Submit();
    else if (step === 2) handleStep2Submit();
    else handleStep3Submit();
  };

  const isBusy = isSendingCode || isVerifyingCode || isSavingProfile;

  return (
    <div className="min-h-screen bg-surface text-on-surface font-['Plus_Jakarta_Sans',sans-serif] flex flex-col justify-between p-4 max-w-xl mx-auto animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <img src={ASSETS.logo} alt="CNG-Connect Logo" className="h-7 w-auto object-contain" />
          <span className="font-extrabold text-[19px] text-primary">CNG-Connect</span>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>

      {/* Main Card Container */}
      <div className="bg-white rounded-3xl shadow-xl border border-outline-variant p-6 flex flex-col gap-5 my-2">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
          <div>
            <span className="text-[11px] font-semibold uppercase text-primary tracking-wider">
              {step === 3 ? 'Almost there' : 'Sign in or create your account'}
            </span>
            <h1 className="text-[20px] font-bold text-on-surface leading-tight">
              {step === 1 ? 'Enter your email' : step === 2 ? 'Check your email' : 'Complete your profile'}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-surface-container-high'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-surface-container-high'}`} />
            {step === 3 && <div className="w-3 h-3 rounded-full bg-primary" />}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {step === 1 && (
            <>
              <p className="text-[13px] text-on-surface-variant font-medium leading-relaxed">
                No password needed — we'll email you a verification code. New here? The same code creates your account.
              </p>
              <div>
                <label className="block text-[12.5px] font-semibold text-on-surface-variant mb-1">
                  Email Address
                </label>
                <div className={`flex items-center bg-surface border rounded-2xl px-3.5 h-12 transition-all ${
                  emailError ? 'border-status-red ring-2 ring-status-red/20' : 'border-outline-variant focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary'
                }`}>
                  <span className="material-symbols-outlined text-outline text-[20px] mr-2">mail</span>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    placeholder="tunde.drives@gmail.com"
                    className="flex-1 bg-transparent text-[14.5px] font-medium text-on-surface outline-none"
                  />
                </div>
                {emailError && (
                  <p className="text-[11.5px] font-medium text-status-red mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    <span>{emailError}</span>
                  </p>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4 py-2">
              <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 flex flex-col gap-1.5">
                <span className="text-[12px] font-black uppercase text-primary tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  Email Verification
                </span>
                <p className="text-[13px] text-on-surface-variant font-medium leading-relaxed">
                  We sent a verification code to <strong>{email}</strong>.
                </p>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-on-surface-variant mb-1.5">
                  Enter Verification Code
                </label>
                <div className={`flex items-center bg-surface border rounded-2xl px-4 h-14 transition-all ${
                  codeError ? 'border-status-red ring-2 ring-status-red/20' : 'border-outline-variant focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary'
                }`}>
                  <span className="material-symbols-outlined text-primary text-[24px] mr-3">verified_user</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={10}
                    required
                    autoFocus
                    value={userCodeInput}
                    onChange={(e) => {
                      setUserCodeInput(e.target.value.replace(/\D/g, ''));
                      if (codeError) setCodeError(null);
                    }}
                    placeholder="1 2 3 4 5 6"
                    className="flex-1 bg-transparent text-[22px] font-extrabold tracking-[0.3em] text-primary outline-none placeholder:tracking-normal placeholder:text-outline placeholder:text-[15px]"
                  />
                </div>
                {codeError && (
                  <p className="text-[12px] font-bold text-status-red mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">gpp_bad</span>
                    <span>{codeError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between text-[12.5px] pt-1">
                <span className="text-outline font-medium">Didn't receive the email?</span>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || isSendingCode}
                  className="text-primary font-extrabold hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>{resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Code'}</span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <>
              <p className="text-[13px] text-on-surface-variant font-medium leading-relaxed -mt-1">
                Just a few details so other drivers know who's reporting.
              </p>

              <div>
                <label className="block text-[12.5px] font-semibold text-on-surface-variant mb-1">Full Name</label>
                <div className="flex items-center bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
                  <span className="material-symbols-outlined text-outline text-[20px] mr-2">person</span>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Tunde Adebayo"
                    className="flex-1 bg-transparent text-[14.5px] font-medium text-on-surface outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-on-surface-variant mb-1">
                  Phone Number (contact info — Nigerian format: 0 + 10 digits or +234)
                </label>
                <div className={`flex items-center bg-surface border rounded-2xl px-3.5 h-12 transition-all ${
                  phoneError ? 'border-status-red ring-2 ring-status-red/20' : 'border-outline-variant focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary'
                }`}>
                  <span className="material-symbols-outlined text-outline text-[20px] mr-2">call</span>
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="0803 123 4567"
                    className="flex-1 bg-transparent text-[14.5px] font-medium text-on-surface outline-none"
                  />
                </div>
                {phoneError && (
                  <p className="text-[11.5px] font-medium text-status-red mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    <span>{phoneError}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-on-surface-variant mb-1">
                  Primary Location / State
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 text-[14px] font-medium text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="Abuja FCT">Abuja FCT</option>
                  <option value="Lagos State">Lagos State</option>
                  <option value="Edo State (Benin)">Edo State (Benin City)</option>
                  <option value="Oyo State (Ibadan)">Oyo State (Ibadan)</option>
                  <option value="Rivers State (PH)">Rivers State (Port Harcourt)</option>
                  <option value="Kano State">Kano State</option>
                </select>
              </div>

              <div>
                <label className="block text-[12.5px] font-bold text-on-surface-variant mb-2">Vehicle Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'private', label: '🚗 Private Car', sub: 'Personal drive' },
                    { id: 'taxi', label: '🚕 Taxi / E-Hailing', sub: 'Uber / Bolt / InDrive' },
                    { id: 'keke', label: '🛺 Keke / Minibus', sub: 'Commercial transit' },
                    { id: 'truck', label: '🚚 Heavy Truck / Bus', sub: 'Logistics' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVehicleType(v.id as 'private' | 'taxi' | 'keke' | 'truck')}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        vehicleType === v.id
                          ? 'bg-primary text-on-primary border-primary shadow-sm'
                          : 'bg-surface text-on-surface border-outline-variant hover:bg-surface-container'
                      }`}
                    >
                      <p className="font-bold text-[13.5px]">{v.label}</p>
                      <p className={`text-[11px] mt-0.5 ${vehicleType === v.id ? 'text-emerald-100' : 'text-outline'}`}>{v.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-bold text-on-surface-variant mb-1">Car Model</label>
                  <input
                    type="text"
                    required
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    placeholder="e.g. Toyota Camry"
                    className="w-full bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 text-[14px] font-bold text-on-surface outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-bold text-on-surface-variant mb-1">Year</label>
                  <input
                    type="text"
                    required
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    placeholder="2018"
                    className="w-full bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 text-[14px] font-bold text-on-surface outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-bold text-on-surface-variant mb-1.5">CNG Conversion Status</label>
                <div className="flex flex-col gap-2">
                  {[
                    { id: 'installed', label: '🟢 CNG Kit Already Installed', desc: 'Active AutoCNG driver' },
                    { id: 'planning', label: '🟡 Planning to Convert Soon', desc: 'Looking for Pi-CNG conversion center' },
                    { id: 'interested', label: '⚪ Interested in Conversion Grant', desc: 'Exploring presidential subsidy' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setCngStatus(st.id as 'installed' | 'planning' | 'interested')}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        cngStatus === st.id
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface text-on-surface border-outline-variant hover:bg-surface-container'
                      }`}
                    >
                      <p className="font-bold text-[13px]">{st.label}</p>
                      <p className={`text-[11px] ${cngStatus === st.id ? 'text-emerald-100' : 'text-outline'}`}>{st.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {cngStatus === 'installed' && (
                <div>
                  <label className="block text-[12.5px] font-bold text-on-surface-variant mb-1">CNG Cylinder Tank Size</label>
                  <select
                    value={tankSize}
                    onChange={(e) => setTankSize(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 text-[14px] font-bold text-on-surface outline-none"
                  >
                    <option value="12kg">12kg Cylinder</option>
                    <option value="15kg">15kg Cylinder (Standard Sedan)</option>
                    <option value="20kg">20kg Cylinder (SUV / Bus)</option>
                    <option value="60L Twin">60L Twin Tank System</option>
                  </select>
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-3.5 px-5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold text-[14px] rounded-full transition-all"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={isBusy}
              className="flex-1 py-3.5 bg-primary hover:opacity-95 text-on-primary font-extrabold text-[15px] rounded-full shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isBusy ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isSendingCode ? 'Sending code...' : isVerifyingCode ? 'Verifying...' : 'Saving...'}</span>
                </div>
              ) : (
                <>
                  <span className="whitespace-nowrap truncate">
                    {step === 1 ? 'Send Code' : step === 2 ? 'Verify & Continue' : 'Finish Setup'}
                  </span>
                  <span className="material-symbols-outlined text-[20px] shrink-0">
                    {step === 3 ? 'check_circle' : 'arrow_forward'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
