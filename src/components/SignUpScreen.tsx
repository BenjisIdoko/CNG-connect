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

  const codeBoxes = Math.min(10, Math.max(6, userCodeInput.length));
  const fmtCooldown = `0:${String(resendCooldown).padStart(2, '0')}`;

  return (
    <div className="min-h-[100dvh] bg-white text-on-surface flex flex-col p-6 pt-[max(env(safe-area-inset-top,0px),1.75rem)] max-w-xl mx-auto animate-fade-in">
      {/* Top bar: back / step */}
      <div className="flex items-center gap-3.5 min-h-[36px]">
        {step === 2 ? (
          <button type="button" onClick={() => setStep(1)} aria-label="Back" className="text-slate-900 -ml-1 p-1">
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
          </button>
        ) : onCancel ? (
          <button type="button" onClick={onCancel} aria-label="Close" className="text-slate-900 -ml-1 p-1">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        ) : null}
        <span className="text-[13px] font-semibold text-outline">
          {step === 3 ? 'Almost there' : `Step ${step} of 2`}
        </span>
      </div>

      <h1 className="text-[26px] font-bold tracking-tight mt-6">
        {step === 1 ? 'Sign in or sign up' : step === 2 ? 'Enter code' : 'Complete your profile'}
      </h1>
      {step === 1 && (
        <p className="text-[15px] text-on-surface-variant leading-relaxed mt-2">
          No password needed — we&apos;ll email you a code. New here? The same code creates your account.
        </p>
      )}
      {step === 2 && (
        <p className="text-[15px] text-on-surface-variant leading-relaxed mt-2">
          We sent a code to
          <br />
          <strong className="text-slate-900">{email}</strong>
        </p>
      )}
      {step === 3 && (
        <p className="text-[15px] text-on-surface-variant leading-relaxed mt-2">
          Just a few details so other drivers know who&apos;s reporting.
        </p>
      )}

      <div className="flex-1 flex flex-col mt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
          {step === 1 && (
            <div>
              <div className={`flex items-center bg-surface rounded-2xl px-4 h-14 transition-all ${
                emailError ? 'ring-2 ring-status-red/40' : 'focus-within:ring-2 focus-within:ring-primary/40'
              }`}>
                <span className="material-symbols-outlined text-outline text-[20px] mr-2.5">mail</span>
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
                  placeholder="Email address"
                  className="flex-1 bg-transparent text-[15px] font-medium text-on-surface outline-none placeholder:text-outline"
                />
              </div>
              {emailError && (
                <p className="text-[13px] font-medium text-status-red mt-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[15px]">error</span>
                  <span>{emailError}</span>
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col">
              <label className="relative block cursor-text">
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
                  aria-label="Verification code"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-text"
                />
                <div className="flex gap-2">
                  {Array.from({ length: codeBoxes }).map((_, i) => {
                    const ch = userCodeInput[i];
                    const isActive = i === userCodeInput.length;
                    return (
                      <div
                        key={i}
                        className={`flex-1 max-w-[46px] h-[54px] rounded-xl flex items-center justify-center text-[22px] font-bold transition-colors ${
                          ch
                            ? 'bg-primary-container text-slate-900'
                            : isActive
                            ? 'bg-surface border-2 border-primary'
                            : 'bg-surface'
                        }`}
                      >
                        {ch}
                      </div>
                    );
                  })}
                </div>
              </label>
              {codeError && (
                <p className="text-[13px] font-bold text-status-red mt-3 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">gpp_bad</span>
                  <span>{codeError}</span>
                </p>
              )}
              <div className="mt-5 text-[14px] text-outline">
                Didn&apos;t get a code?{' '}
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0 || isSendingCode}
                  className="font-bold text-primary disabled:text-outline disabled:font-medium"
                >
                  {resendCooldown > 0 ? `Resend in ${fmtCooldown}` : 'Resend code'}
                </button>
              </div>
              <p className="mt-1.5 text-[13px] text-outline italic">A confirmation link may arrive instead, in some cases.</p>
            </div>
          )}

          {step === 3 && (
            <>
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
                  <p className="text-[12.5px] font-medium text-status-red mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px]">error</span>
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
                  className="w-full bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 text-[15px] font-medium text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
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
                      <p className={`text-[12px] mt-0.5 ${vehicleType === v.id ? 'text-emerald-100' : 'text-outline'}`}>{v.sub}</p>
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
                    className="w-full bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 text-[15px] font-bold text-on-surface outline-none"
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
                    className="w-full bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 text-[15px] font-bold text-on-surface outline-none"
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
                      <p className="font-bold text-[14px]">{st.label}</p>
                      <p className={`text-[12px] ${cngStatus === st.id ? 'text-emerald-100' : 'text-outline'}`}>{st.desc}</p>
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
                    className="w-full bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 text-[15px] font-bold text-on-surface outline-none"
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

          {/* Action button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isBusy}
              className="w-full py-4 bg-slate-900 text-white font-semibold text-[15px] rounded-full active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isBusy ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isSendingCode ? 'Sending code…' : isVerifyingCode ? 'Verifying…' : 'Saving…'}</span>
                </div>
              ) : (
                <span>{step === 1 ? 'Send code' : step === 2 ? 'Verify & continue' : 'Finish setup'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
