import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { ASSETS } from '../data/mockData';
import { validatePhoneNumber } from '../utils/phoneValidator';
import { otpService } from '../services/otpService';

interface SignUpScreenProps {
  onSignUpComplete: (newUserProfile: UserProfile) => void;
  onSwitchToLogin?: () => void;
  onCancel?: () => void;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({
  onSignUpComplete,
  onSwitchToLogin,
  onCancel,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+234');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Abuja FCT');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Step 2 OTP Verification State
  const [devCode, setDevCode] = useState<string | null>(null);
  const [userOtpInput, setUserOtpInput] = useState<string>('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [expiryCountdown, setExpiryCountdown] = useState<number>(300); // 5 minutes (300s)
  const [otpNotice, setOtpNotice] = useState<string | null>(null);

  // Step 3 Vehicle Details
  const [vehicleMake, setVehicleMake] = useState('Toyota Camry');
  const [vehicleYear, setVehicleYear] = useState('2018');
  const [vehicleType, setVehicleType] = useState<'private' | 'taxi' | 'keke' | 'truck'>('private');
  const [cngStatus, setCngStatus] = useState<'installed' | 'planning' | 'interested'>('installed');
  const [tankSize, setTankSize] = useState('15kg');

  // Cooldown & Expiry Countdown Timers for OTP Step
  useEffect(() => {
    let cooldownTimer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      cooldownTimer = setInterval(() => {
        setResendCooldown((c) => Math.max(0, c - 1));
      }, 1000);
    }
    return () => clearInterval(cooldownTimer);
  }, [resendCooldown]);

  useEffect(() => {
    let expiryTimer: NodeJS.Timeout;
    if (step === 2 && expiryCountdown > 0) {
      expiryTimer = setInterval(() => {
        setExpiryCountdown((e) => Math.max(0, e - 1));
      }, 1000);
    }
    return () => clearInterval(expiryTimer);
  }, [step, expiryCountdown]);

  // Step 1: Validate Phone Format & Call Serverless /api/otp/send
  const handleStep1Submit = async () => {
    const phoneValidation = validatePhoneNumber(phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error || 'Please enter a valid Nigerian phone number (0 + 10 digits, e.g. 0803 123 4567)');
      return;
    }

    setPhoneError(null);
    setIsSendingOtp(true);

    const res = await otpService.sendOtp(phoneValidation.normalized || phone);
    setIsSendingOtp(false);

    if (!res.success) {
      setPhoneError(res.error || 'Failed to send SMS verification code.');
      return;
    }

    if (res.devCode) {
      setDevCode(res.devCode);
    }

    setResendCooldown(res.cooldownSeconds || 60);
    setExpiryCountdown(300); // 5 minutes
    setUserOtpInput('');
    setOtpError(null);
    setOtpNotice(res.message || 'SMS verification code dispatched!');
    setStep(2);
  };

  // Step 2: Call Serverless /api/otp/verify (Server-Side Verification Gate)
  const handleStep2Submit = async () => {
    if (userOtpInput.trim().length !== 6) {
      setOtpError('Please enter a 6-digit verification code.');
      return;
    }

    if (expiryCountdown <= 0) {
      setOtpError('OTP code has expired (5 minute limit). Tap "Resend Code" to get a new code.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError(null);

    const phoneValidation = validatePhoneNumber(phone);
    const targetPhone = phoneValidation.normalized || phone;

    const res = await otpService.verifyOtp(targetPhone, userOtpInput.trim());
    setIsVerifyingOtp(false);

    if (!res.verified) {
      setOtpError(res.error || 'Verification failed. Please check your OTP code.');
      return;
    }

    // Verified server-side! Proceed to Step 3 (Vehicle details)
    setStep(3);
  };

  // Resend OTP Handler (Rate-Limited 60s)
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;

    const phoneValidation = validatePhoneNumber(phone);
    const targetPhone = phoneValidation.normalized || phone;

    setIsSendingOtp(true);
    const res = await otpService.sendOtp(targetPhone);
    setIsSendingOtp(false);

    if (!res.success) {
      setOtpError(res.error || 'Failed to resend SMS code.');
      return;
    }

    if (res.devCode) {
      setDevCode(res.devCode);
    }

    setResendCooldown(res.cooldownSeconds || 60);
    setExpiryCountdown(300); // Reset 5 min timer
    setUserOtpInput('');
    setOtpError(null);
    setOtpNotice(`New SMS code sent! ${res.devCode ? `(Dev Code: ${res.devCode})` : ''}`);
    setTimeout(() => setOtpNotice(null), 4000);
  };

  // Step 3: Create Profile & Complete Signup
  const handleStep3Submit = () => {
    const phoneValidation = validatePhoneNumber(phone);
    const formattedPhone = phoneValidation.formatted || `${countryCode} ${phone.trim()}`;

    const newUser: UserProfile = {
      name: fullName.trim() || 'CNG Driver',
      phone: formattedPhone,
      email: email.trim() || 'driver@gasfinder.ng',
      avatar: ASSETS.userAvatar,
      vehicle: `${vehicleYear} ${vehicleMake} (${cngStatus === 'installed' ? `CNG ${tankSize}` : 'Petrol'})`,
      cngInstalledDate: cngStatus === 'installed' ? 'Recently Installed' : 'Planning',
      monthlySavings: cngStatus === 'installed' ? 78500 : 0,
      reportsCount: 1,
      reputationScore: 5.0,
      communityPoints: 100,
      state: city.includes('Lagos') ? 'Lagos' : city.includes('Edo') ? 'Edo' : city.includes('Oyo') ? 'Oyo' : city.includes('Rivers') ? 'Rivers' : city.includes('Kano') ? 'Kano' : 'Abuja FCT',
    };

    onSignUpComplete(newUser);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      handleStep1Submit();
    } else if (step === 2) {
      handleStep2Submit();
    } else {
      handleStep3Submit();
    }
  };

  const formatExpiryMinutes = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface font-['Plus_Jakarta_Sans',sans-serif] flex flex-col justify-between p-4 max-w-xl mx-auto animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <img src={ASSETS.logo} alt="GasFinder Logo" className="h-7 w-auto object-contain" />
          <span className="font-extrabold text-[19px] text-primary">GasFinder</span>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            aria-label="Close sign up"
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
              Step {step} of 3
            </span>
            <h1 className="text-[20px] font-bold text-on-surface leading-tight">
              {step === 1
                ? 'Create Driver Account'
                : step === 2
                ? 'SMS OTP Verification'
                : 'Vehicle & CNG Details'}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-surface-container-high'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-surface-container-high'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-surface-container-high'}`} />
          </div>
        </div>

        {/* Welcome Bonus Callout */}
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 font-bold text-[14px]">
            🎁
          </div>
          <div>
            <p className="text-[13px] font-semibold text-primary">100 Welcome Points</p>
            <p className="text-[11.5px] text-on-surface-variant font-normal leading-tight">
              Earn community reputation points instantly upon registration!
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {step === 1 && (
            <>
              {/* Full Name */}
              <div>
                <label className="block text-[12.5px] font-semibold text-on-surface-variant mb-1">
                  Full Name
                </label>
                <div className="flex items-center bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
                  <span className="material-symbols-outlined text-outline text-[20px] mr-2">
                    person
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Tunde Adebayo"
                    className="flex-1 bg-transparent text-[14.5px] font-medium text-on-surface outline-none"
                  />
                </div>
              </div>

              {/* Phone Number with Format Validation */}
              <div>
                <label className="block text-[12.5px] font-semibold text-on-surface-variant mb-1">
                  Phone Number (Nigerian Format: 0 + 10 digits or +234)
                </label>
                <div className={`flex items-center bg-surface border rounded-2xl px-3 h-12 transition-all gap-2 ${
                  phoneError ? 'border-status-red ring-2 ring-status-red/20' : 'border-outline-variant focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary'
                }`}>
                  <span className="text-[14px] font-semibold text-primary shrink-0 border-r border-outline-variant pr-2">
                    🇳🇬 {countryCode}
                  </span>
                  <input
                    type="tel"
                    required
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

              {/* Email Address */}
              <div>
                <label className="block text-[12.5px] font-semibold text-on-surface-variant mb-1">
                  Email Address
                </label>
                <div className="flex items-center bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
                  <span className="material-symbols-outlined text-outline text-[20px] mr-2">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tunde.drives@gmail.com"
                    className="flex-1 bg-transparent text-[14.5px] font-medium text-on-surface outline-none"
                  />
                </div>
              </div>

              {/* Primary Operating City */}
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

              {/* Password */}
              <div>
                <label className="block text-[12.5px] font-semibold text-on-surface-variant mb-1">
                  Password
                </label>
                <div className="flex items-center bg-surface border border-outline-variant rounded-2xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
                  <span className="material-symbols-outlined text-outline text-[20px] mr-2">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-[14.5px] font-medium text-on-surface outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-outline hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4 py-2">
              {/* SMS Code Banner Callout */}
              <div className="bg-surface-container border border-outline-variant rounded-2xl p-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-black uppercase text-primary tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">sms</span>
                    Serverless SMS OTP Verification
                  </span>
                  {devCode && (
                    <span className="bg-primary text-status-green text-[10.5px] font-black px-2.5 py-0.5 rounded-full border border-status-green/40">
                      Dev mode — use code {devCode}
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-on-surface-variant font-medium leading-relaxed">
                  We triggered a 6-digit verification code to <strong>{phone}</strong> via serverless function.
                </p>
                <div className="flex items-center justify-between text-[11.5px] font-bold text-primary pt-1">
                  <span>Code expires in: <strong className="text-status-red">{formatExpiryMinutes(expiryCountdown)}</strong></span>
                  <span className="text-primary font-black">⚙️ Dev mode — use code 123456</span>
                </div>
              </div>

              {otpNotice && (
                <div className="p-3 bg-primary text-on-primary text-[12.5px] font-bold rounded-2xl animate-fade-in flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-status-green">mark_email_read</span>
                  <span>{otpNotice}</span>
                </div>
              )}

              {/* 6-Digit OTP Code Input */}
              <div>
                <label className="block text-[13px] font-bold text-on-surface-variant mb-1.5">
                  Enter 6-Digit Verification Code
                </label>
                <div className={`flex items-center bg-surface border rounded-2xl px-4 h-14 transition-all ${
                  otpError ? 'border-status-red ring-2 ring-status-red/20' : 'border-outline-variant focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary'
                }`}>
                  <span className="material-symbols-outlined text-primary text-[24px] mr-3">
                    verified_user
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={userOtpInput}
                    onChange={(e) => {
                      setUserOtpInput(e.target.value.replace(/\D/g, ''));
                      if (otpError) setOtpError(null);
                    }}
                    placeholder="1 2 3 4 5 6"
                    className="flex-1 bg-transparent text-[22px] font-extrabold tracking-[0.3em] text-primary outline-none placeholder:tracking-normal placeholder:text-outline placeholder:text-[15px]"
                  />
                </div>

                {otpError && (
                  <p className="text-[12px] font-bold text-status-red mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">gpp_bad</span>
                    <span>{otpError}</span>
                  </p>
                )}
              </div>

              {/* Rate-Limited Resend Action (60s Cooldown) */}
              <div className="flex items-center justify-between text-[12.5px] pt-1">
                <span className="text-outline font-medium">Didn't receive SMS?</span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || isSendingOtp}
                  className="text-primary font-extrabold hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                  <span>
                    {resendCooldown > 0
                      ? `Resend Code in ${resendCooldown}s`
                      : 'Resend Code'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <>
              {/* Vehicle Type Selector */}
              <div>
                <label className="block text-[12.5px] font-bold text-on-surface-variant mb-2">
                  Vehicle Category
                </label>
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
                      onClick={() => setVehicleType(v.id as any)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        vehicleType === v.id
                          ? 'bg-primary text-on-primary border-primary shadow-sm'
                          : 'bg-surface text-on-surface border-outline-variant hover:bg-surface-container'
                      }`}
                    >
                      <p className="font-bold text-[13.5px]">{v.label}</p>
                      <p className={`text-[11px] mt-0.5 ${vehicleType === v.id ? 'text-status-green' : 'text-outline'}`}>
                        {v.sub}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle Make & Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-bold text-on-surface-variant mb-1">
                    Car Model
                  </label>
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
                  <label className="block text-[12.5px] font-bold text-on-surface-variant mb-1">
                    Year
                  </label>
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

              {/* CNG Kit Status */}
              <div>
                <label className="block text-[12.5px] font-bold text-on-surface-variant mb-1.5">
                  CNG Conversion Status
                </label>
                <div className="flex flex-col gap-2">
                  {[
                    { id: 'installed', label: '🟢 CNG Kit Already Installed', desc: 'Active AutoCNG driver' },
                    { id: 'planning', label: '🟡 Planning to Convert Soon', desc: 'Looking for Pi-CNG conversion center' },
                    { id: 'interested', label: '⚪ Interested in Conversion Grant', desc: 'Exploring presidential subsidy' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setCngStatus(st.id as any)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        cngStatus === st.id
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface text-on-surface border-outline-variant hover:bg-surface-container'
                      }`}
                    >
                      <p className="font-bold text-[13px]">{st.label}</p>
                      <p className={`text-[11px] ${cngStatus === st.id ? 'text-status-green' : 'text-outline'}`}>
                        {st.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tank Size (if installed) */}
              {cngStatus === 'installed' && (
                <div>
                  <label className="block text-[12.5px] font-bold text-on-surface-variant mb-1">
                    CNG Cylinder Tank Size
                  </label>
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
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                className="py-3.5 px-5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold text-[14px] rounded-full transition-all"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={isSendingOtp || isVerifyingOtp}
              className="flex-1 py-3.5 bg-primary hover:opacity-95 text-on-primary font-extrabold text-[15px] rounded-full shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSendingOtp || isVerifyingOtp ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isSendingOtp ? 'Sending SMS OTP...' : 'Verifying Code...'}</span>
                </div>
              ) : (
                <>
                  <span className="whitespace-nowrap truncate">
                    {step === 1
                      ? 'Next: Verify Phone'
                      : step === 2
                      ? 'Verify & Continue'
                      : 'Complete Signup'}
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

      {/* Bottom Switch to Login Link */}
      <div className="text-center py-3">
        <p className="text-[13px] text-on-surface-variant font-medium">
          Already have a GasFinder account?{' '}
          {onSwitchToLogin ? (
            <button
              onClick={onSwitchToLogin}
              className="text-primary font-extrabold hover:underline"
            >
              Sign In
            </button>
          ) : (
            <span className="text-primary font-extrabold">Sign In</span>
          )}
        </p>
      </div>
    </div>
  );
};
