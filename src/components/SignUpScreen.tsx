import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ASSETS } from '../data/mockData';

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
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+234');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Abuja FCT');
  const [vehicleMake, setVehicleMake] = useState('Toyota Camry');
  const [vehicleYear, setVehicleYear] = useState('2018');
  const [vehicleType, setVehicleType] = useState<'private' | 'taxi' | 'keke' | 'truck'>('private');
  const [cngStatus, setCngStatus] = useState<'installed' | 'planning' | 'interested'>('installed');
  const [tankSize, setTankSize] = useState('15kg');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }

    const newUser: UserProfile = {
      name: fullName.trim() || 'CNG Driver',
      phone: `${countryCode} ${phone.trim()}`,
      email: email.trim() || 'driver@gasfinder.ng',
      avatar: ASSETS.userAvatar,
      vehicle: `${vehicleYear} ${vehicleMake} (${cngStatus === 'installed' ? `CNG ${tankSize}` : 'Petrol'})`,
      cngInstalledDate: cngStatus === 'installed' ? 'Recently Installed' : 'Planning',
      monthlySavings: cngStatus === 'installed' ? 78500 : 0,
      reportsCount: 1,
      reputationScore: 5.0,
    };

    onSignUpComplete(newUser);
  };

  return (
    <div className="min-h-screen bg-[#f2fcf5] text-[#141d19] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col justify-between p-4 max-w-xl mx-auto animate-fade-in">
      {/* Top Bar */}
      <div className="flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2">
          <img src={ASSETS.logo} alt="GasFinder Logo" className="h-7 w-auto object-contain" />
          <span className="font-extrabold text-[19px] text-[#006c50]">GasFinder</span>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            aria-label="Close sign up"
            className="w-9 h-9 rounded-full bg-slate-200/70 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>

      {/* Main Card Container */}
      <div className="bg-white rounded-3xl shadow-xl border border-[#dbe5de] p-6 flex flex-col gap-5 my-2">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[11px] font-black uppercase text-[#006c50] tracking-wider">
              Step {step} of 2
            </span>
            <h1 className="text-[20px] font-extrabold text-[#141d19] leading-tight">
              {step === 1 ? 'Create Driver Account' : 'Vehicle & CNG Details'}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-[#006c50]' : 'bg-slate-200'}`} />
            <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-[#006c50]' : 'bg-slate-200'}`} />
          </div>
        </div>

        {/* Welcome Bonus Callout */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#006c50] text-white flex items-center justify-center shrink-0 font-extrabold text-[14px]">
            🎁
          </div>
          <div>
            <p className="text-[13px] font-extrabold text-[#004D40]">100 Welcome Points</p>
            <p className="text-[11.5px] text-emerald-800 font-medium leading-tight">
              Earn community reputation points instantly upon registration!
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {step === 1 ? (
            <>
              {/* Full Name */}
              <div>
                <label className="block text-[12.5px] font-bold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="flex items-center bg-[#f2fcf5] border border-[#dbe5de] rounded-2xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-[#006c50]/30 focus-within:border-[#006c50] transition-all">
                  <span className="material-symbols-outlined text-[#6a7b72] text-[20px] mr-2">
                    person
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Tunde Adebayo"
                    className="flex-1 bg-transparent text-[14.5px] font-medium text-slate-900 outline-none"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-[12.5px] font-bold text-slate-700 mb-1">
                  Phone Number (WhatsApp)
                </label>
                <div className="flex items-center bg-[#f2fcf5] border border-[#dbe5de] rounded-2xl px-3 h-12 focus-within:ring-2 focus-within:ring-[#006c50]/30 focus-within:border-[#006c50] transition-all gap-2">
                  <span className="text-[14px] font-bold text-[#006c50] shrink-0 border-r border-[#dbe5de] pr-2">
                    🇳🇬 {countryCode}
                  </span>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0803 123 4567"
                    className="flex-1 bg-transparent text-[14.5px] font-medium text-slate-900 outline-none"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[12.5px] font-bold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="flex items-center bg-[#f2fcf5] border border-[#dbe5de] rounded-2xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-[#006c50]/30 focus-within:border-[#006c50] transition-all">
                  <span className="material-symbols-outlined text-[#6a7b72] text-[20px] mr-2">
                    mail
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tunde.drives@gmail.com"
                    className="flex-1 bg-transparent text-[14.5px] font-medium text-slate-900 outline-none"
                  />
                </div>
              </div>

              {/* Primary Operating City */}
              <div>
                <label className="block text-[12.5px] font-bold text-slate-700 mb-1">
                  Primary Location / City
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-[#f2fcf5] border border-[#dbe5de] rounded-2xl px-3.5 h-12 text-[14px] font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#006c50]/30"
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
                <label className="block text-[12.5px] font-bold text-slate-700 mb-1">
                  Password
                </label>
                <div className="flex items-center bg-[#f2fcf5] border border-[#dbe5de] rounded-2xl px-3.5 h-12 focus-within:ring-2 focus-within:ring-[#006c50]/30 focus-within:border-[#006c50] transition-all">
                  <span className="material-symbols-outlined text-[#6a7b72] text-[20px] mr-2">
                    lock
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-[14.5px] font-medium text-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[#6a7b72] hover:text-slate-900"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Vehicle Type Selector */}
              <div>
                <label className="block text-[12.5px] font-bold text-slate-700 mb-2">
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
                          ? 'bg-[#004D40] text-white border-[#004D40] shadow-sm'
                          : 'bg-[#f2fcf5] text-slate-800 border-[#dbe5de] hover:bg-emerald-50'
                      }`}
                    >
                      <p className="font-bold text-[13.5px]">{v.label}</p>
                      <p className={`text-[11px] mt-0.5 ${vehicleType === v.id ? 'text-emerald-200' : 'text-slate-500'}`}>
                        {v.sub}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle Make & Year */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12.5px] font-bold text-slate-700 mb-1">
                    Car Model
                  </label>
                  <input
                    type="text"
                    required
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    placeholder="e.g. Toyota Camry"
                    className="w-full bg-[#f2fcf5] border border-[#dbe5de] rounded-2xl px-3.5 h-12 text-[14px] font-bold text-slate-900 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-bold text-slate-700 mb-1">
                    Year
                  </label>
                  <input
                    type="text"
                    required
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    placeholder="2018"
                    className="w-full bg-[#f2fcf5] border border-[#dbe5de] rounded-2xl px-3.5 h-12 text-[14px] font-bold text-slate-900 outline-none"
                  />
                </div>
              </div>

              {/* CNG Kit Status */}
              <div>
                <label className="block text-[12.5px] font-bold text-slate-700 mb-1.5">
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
                          ? 'bg-[#006c50] text-white border-[#006c50]'
                          : 'bg-[#f2fcf5] text-slate-800 border-[#dbe5de] hover:bg-emerald-50'
                      }`}
                    >
                      <p className="font-bold text-[13px]">{st.label}</p>
                      <p className={`text-[11px] ${cngStatus === st.id ? 'text-emerald-100' : 'text-slate-500'}`}>
                        {st.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tank Size (if installed) */}
              {cngStatus === 'installed' && (
                <div>
                  <label className="block text-[12.5px] font-bold text-slate-700 mb-1">
                    CNG Cylinder Tank Size
                  </label>
                  <select
                    value={tankSize}
                    onChange={(e) => setTankSize(e.target.value)}
                    className="w-full bg-[#f2fcf5] border border-[#dbe5de] rounded-2xl px-3.5 h-12 text-[14px] font-bold text-slate-900 outline-none"
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
                className="py-3.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[14px] rounded-full transition-all"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-3.5 bg-[#004D40] hover:bg-[#006c50] text-white font-extrabold text-[15px] rounded-full shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>{step === 1 ? 'Next: Vehicle Details' : 'Complete Registration'}</span>
              <span className="material-symbols-outlined text-[20px]">
                {step === 1 ? 'arrow_forward' : 'check_circle'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Bottom Switch to Login Link */}
      <div className="text-center py-3">
        <p className="text-[13px] text-slate-600 font-medium">
          Already have a GasFinder account?{' '}
          {onSwitchToLogin ? (
            <button
              onClick={onSwitchToLogin}
              className="text-[#006c50] font-extrabold hover:underline"
            >
              Sign In
            </button>
          ) : (
            <span className="text-[#006c50] font-extrabold">Sign In</span>
          )}
        </p>
      </div>
    </div>
  );
};
