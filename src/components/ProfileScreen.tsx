import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ASSETS } from '../data/mockData';
import { Modal } from './common/Modal';

interface ProfileScreenProps {
  user: UserProfile;
  onOpenOnboarding: () => void;
  onOpenSignUp?: () => void;
  onSignOut?: () => void;
  onTriggerProximityAlert?: () => void;
  onUpdateState?: (newState: string) => void;
  onUpdateProfile?: (updatedUser: Partial<UserProfile>) => void;
  onOpenRoiCalculator?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onOpenOnboarding,
  onOpenSignUp,
  onSignOut,
  onUpdateState,
  onUpdateProfile,
  onOpenRoiCalculator,
}) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(user.name);
  const [editPhone, setEditPhone] = useState(user.phone);
  const [editEmail, setEditEmail] = useState(user.email);
  const [editVehicle, setEditVehicle] = useState(user.vehicle || 'Toyota Corolla 1.8L (Dual Fuel CNG)');
  const [editState, setEditState] = useState(user.state || 'Abuja FCT');

  // Embedded ROI Calculator sliders state
  const [dailyKm, setDailyKm] = useState<number>(80);
  const [kmPerLiter, setKmPerLiter] = useState<number>(10);
  const [petrolPrice, setPetrolPrice] = useState<number>(1050);
  const [cngPrice, setCngPrice] = useState<number>(230);
  const [isCommercialGrant, setIsCommercialGrant] = useState<boolean>(true);

  // ROI Calculations
  const dailyPetrolLiters = dailyKm / (kmPerLiter || 1);
  const dailyCngKg = dailyPetrolLiters / 1.35;
  const dailyPetrolCost = dailyPetrolLiters * petrolPrice;
  const dailyCngCost = dailyCngKg * cngPrice;
  const dailySavings = Math.max(0, dailyPetrolCost - dailyCngCost);
  const monthlySavings = Math.round(dailySavings * 30);
  const annualSavings = Math.round(dailySavings * 365);
  const savingsPercent = dailyPetrolCost > 0 ? Math.round((dailySavings / dailyPetrolCost) * 100) : 0;
  const annualCo2SavedTons = ((dailyPetrolLiters * 365 * 2.31 * 0.25) / 1000).toFixed(1);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedData: Partial<UserProfile> = {
      name: editName.trim() || user.name,
      phone: editPhone.trim() || user.phone,
      email: editEmail.trim() || user.email,
      vehicle: editVehicle.trim() || user.vehicle,
      state: editState,
    };

    if (onUpdateProfile) {
      onUpdateProfile(updatedData);
    }
    if (onUpdateState && editState !== user.state) {
      onUpdateState(editState);
    }

    setIsEditModalOpen(false);
    showToast('Profile updated successfully!');
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-36 pt-4 font-['Plus_Jakarta_Sans',sans-serif]">
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-on-surface/90 text-white text-[12.5px] font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 md:px-6 flex flex-col gap-5">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-outline-variant flex items-center justify-between">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <img
              src={user.avatar || ASSETS.userAvatar}
              alt={user.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-primary shadow-xs shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-[18px] text-on-surface leading-tight truncate">
                {user.name}
              </h2>
              <p className="text-[12.5px] text-on-surface-variant font-normal mt-0.5 truncate">
                {user.email || user.phone || 'driver@cngconnect.ng'}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-primary">
                <span className="material-symbols-outlined text-[14px]">directions_car</span>
                <span className="truncate">{user.vehicle || 'Toyota Corolla 1.8L (CNG)'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setEditName(user.name);
              setEditPhone(user.phone);
              setEditEmail(user.email);
              setEditVehicle(user.vehicle || 'Toyota Corolla 1.8L (Dual Fuel CNG)');
              setEditState(user.state || 'Abuja FCT');
              setIsEditModalOpen(true);
            }}
            className="w-11 h-11 rounded-full bg-emerald-50 hover:bg-emerald-100 text-primary flex items-center justify-center transition-all active:scale-95 shrink-0 ml-2 border border-emerald-200"
            aria-label="Edit Profile"
          >
            <span className="material-symbols-outlined text-[19px]">edit</span>
          </button>
        </div>

        {/* Driver Stats & Community Points Card */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Points */}
          <div className="bg-primary text-on-primary rounded-2xl p-3 flex flex-col justify-between shadow-xs border border-primary">
            <div className="flex items-center justify-between text-status-green">
              <span className="material-symbols-outlined text-[18px]">emoji_events</span>
              <span className="text-[9px] font-black uppercase tracking-wider bg-black/20 px-1.5 py-0.5 rounded-full border border-status-green/30">
                PTS
              </span>
            </div>
            <div className="mt-2">
              <span className="text-[20px] font-black text-status-green leading-none block">
                {user.communityPoints ?? 450}
              </span>
              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wider">
                Points
              </span>
            </div>
          </div>

          {/* Reports */}
          <div className="bg-white rounded-2xl p-3 border border-outline-variant shadow-xs flex flex-col justify-between">
            <span className="material-symbols-outlined text-primary text-[18px]">
              edit_document
            </span>
            <div className="mt-2">
              <span className="text-[20px] font-black text-on-surface leading-none block">
                {user.reportsCount}
              </span>
              <span className="text-[10px] font-semibold text-outline uppercase tracking-wider">
                Reports
              </span>
            </div>
          </div>

          {/* Reputation */}
          <div className="bg-white rounded-2xl p-3 border border-outline-variant shadow-xs flex flex-col justify-between">
            <span className="material-symbols-outlined text-secondary text-[18px]">
              star
            </span>
            <div className="mt-2">
              <span className="text-[20px] font-black text-on-surface leading-none block">
                {user.reputationScore}
              </span>
              <span className="text-[10px] font-semibold text-outline uppercase tracking-wider">
                Rating
              </span>
            </div>
          </div>
        </div>

        {/* Embedded Interactive CNG ROI & Savings Calculator Card */}
        <div className="bg-gradient-to-br from-deep-teal via-primary to-emerald-950 rounded-3xl p-4 sm:p-5 text-white shadow-lg border border-emerald-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-emerald-400/20 text-status-green flex items-center justify-center border border-status-green/30">
                <span className="material-symbols-outlined text-[18px]">calculate</span>
              </span>
              <h3 className="font-extrabold text-[15px] sm:text-[16px] text-white">
                CNG Fuel Savings &amp; ROI Calculator
              </h3>
            </div>
            <span className="bg-status-green/20 text-status-green text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-status-green/30">
              Interactive
            </span>
          </div>

          {/* Real-time Display Hero */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15">
            <span className="text-[11px] text-emerald-200 font-semibold block uppercase tracking-wider">Estimated Monthly Fuel Savings</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-[28px] sm:text-[32px] font-black text-white leading-none">
                ₦{monthlySavings.toLocaleString()}
              </span>
              <span className="text-[13px] font-extrabold text-status-green">
                ({savingsPercent}% Saved vs Petrol)
              </span>
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-3 bg-black/20 p-3.5 rounded-2xl border border-white/10">
            <div>
              <div className="flex justify-between text-[11.5px] font-bold text-emerald-100 mb-1">
                <span>Daily Driving Distance</span>
                <span className="text-status-green">{dailyKm} km / day</span>
              </div>
              <input
                type="range"
                min="20"
                max="300"
                step="5"
                value={dailyKm}
                onChange={(e) => setDailyKm(Number(e.target.value))}
                className="w-full accent-status-green h-1.5 bg-white/20 rounded-lg cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
              <div>
                <label className="block text-[10.5px] font-bold text-emerald-200 mb-1">Petrol Price (₦/L)</label>
                <input
                  type="number"
                  value={petrolPrice}
                  onChange={(e) => setPetrolPrice(Number(e.target.value))}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-2.5 py-1.5 text-[12px] font-bold text-white outline-none focus:border-status-green"
                />
              </div>
              <div>
                <label className="block text-[10.5px] font-bold text-emerald-200 mb-1">CNG Price (₦/kg)</label>
                <input
                  type="number"
                  value={cngPrice}
                  onChange={(e) => setCngPrice(Number(e.target.value))}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-2.5 py-1.5 text-[12px] font-bold text-white outline-none focus:border-status-green"
                />
              </div>
            </div>
          </div>

          {/* Key Metrics Pill Bar */}
          <div className="grid grid-cols-2 gap-2 text-center text-[12px]">
            <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
              <span className="text-[10px] text-emerald-200 block uppercase font-bold">Annual Savings</span>
              <span className="font-extrabold text-white text-[14px]">₦{annualSavings.toLocaleString()}</span>
            </div>
            <div className="bg-white/10 rounded-xl p-2.5 border border-white/10">
              <span className="text-[10px] text-emerald-200 block uppercase font-bold">CO₂ Reduced / Year</span>
              <span className="font-extrabold text-status-green text-[14px]">{annualCo2SavedTons} Tons</span>
            </div>
          </div>

          {onOpenRoiCalculator && (
            <button
              onClick={onOpenRoiCalculator}
              className="w-full py-2.5 bg-white/15 hover:bg-white/25 text-white text-[12.5px] font-extrabold rounded-xl border border-white/20 transition-all flex items-center justify-center gap-1.5 active:scale-98"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_full</span>
              <span>Open Detailed Kit Payback Calculator Modal</span>
            </button>
          )}
        </div>

        {/* General Settings Group */}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-on-surface-variant px-1">
            General &amp; Preferences
          </span>

          <div className="bg-white rounded-3xl p-1.5 shadow-sm border border-outline-variant flex flex-col divide-y divide-outline-variant/30">
            {/* Registered State for Push Notification Scoping */}
            <div className="p-3.5 flex items-center justify-between hover:bg-surface transition-colors rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                  location_on
                </span>
                <div>
                  <span className="text-[14px] font-medium text-on-surface block leading-tight">
                    Registered State
                  </span>
                  <span className="text-[11px] text-outline font-normal">
                    Push notifications are scoped to this state
                  </span>
                </div>
              </div>
              <select
                value={user.state || 'Abuja FCT'}
                onChange={(e) => {
                  const newState = e.target.value;
                  if (onUpdateState) {
                    onUpdateState(newState);
                  }
                  if (onUpdateProfile) {
                    onUpdateProfile({ state: newState });
                  }
                  showToast(`Registered state updated to ${newState}`);
                }}
                className="bg-surface-container text-primary border border-outline-variant font-semibold text-[12.5px] rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="Abuja FCT">Abuja FCT</option>
                <option value="Lagos">Lagos</option>
                <option value="Ogun">Ogun</option>
                <option value="Rivers">Rivers</option>
                <option value="Kano">Kano</option>
                <option value="Edo">Edo</option>
                <option value="Delta">Delta</option>
                <option value="Oyo">Oyo</option>
                <option value="Kaduna">Kaduna</option>
              </select>
            </div>

            {/* Notifications */}
            <div className="p-3.5 flex items-center justify-between rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                  notifications
                </span>
                <span className="text-[14px] font-medium text-on-surface">
                  Proximity Alert Notifications
                </span>
              </div>

              {/* iOS style toggle switch */}
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  notificationsEnabled ? 'bg-primary' : 'bg-surface-container-high'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                    notificationsEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Support & Actions Group */}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-on-surface-variant px-1">
            Support &amp; Community
          </span>

          <div className="bg-white rounded-3xl p-1.5 shadow-sm border border-outline-variant flex flex-col divide-y divide-outline-variant/30">
            {/* Share */}
            <div
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'CNG-Connect Locator',
                    text: 'Locate CNG refuelling stations across Nigeria with live pressure updates!',
                    url: window.location.href,
                  });
                } else {
                  showToast('App link copied!');
                }
              }}
              className="p-3.5 flex items-center justify-between hover:bg-surface transition-colors cursor-pointer rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                  share
                </span>
                <span className="text-[14px] font-medium text-on-surface">
                  Share App with Drivers
                </span>
              </div>
              <span className="material-symbols-outlined text-outline text-[18px]">
                chevron_right
              </span>
            </div>

            {/* Help */}
            <div
              onClick={() => showToast('Help Center')}
              className="p-3.5 flex items-center justify-between hover:bg-surface transition-colors cursor-pointer rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                  help
                </span>
                <span className="text-[14px] font-medium text-on-surface">
                  Help &amp; FAQ
                </span>
              </div>
              <span className="material-symbols-outlined text-outline text-[18px]">
                chevron_right
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 pt-1">
          {onOpenSignUp && (
            <button
              onClick={onOpenSignUp}
              className="w-full py-3.5 px-4 bg-primary hover:opacity-95 text-on-primary font-bold text-[14px] rounded-2xl shadow-xs flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <span className="material-symbols-outlined text-status-green text-[20px] shrink-0">
                person_add
              </span>
              <span className="whitespace-nowrap">Sign Up / Switch Account</span>
            </button>
          )}

          <button
            onClick={onOpenOnboarding}
            className="w-full py-3.5 px-4 bg-white hover:bg-surface text-on-surface font-semibold text-[14px] rounded-2xl shadow-xs border border-outline-variant flex items-center justify-center gap-2 active:scale-98 transition-all"
          >
            <span className="material-symbols-outlined text-primary text-[20px] shrink-0">
              slideshow
            </span>
            <span className="whitespace-nowrap">Replay Onboarding Guide</span>
          </button>

          <button
            onClick={onSignOut || onOpenOnboarding}
            className="w-full py-3.5 px-4 bg-status-orange-container hover:opacity-90 text-secondary font-semibold text-[14px] rounded-2xl border border-secondary/30 flex items-center justify-center gap-2 active:scale-98 transition-all min-h-[44px]"
          >
            <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">
              logout
            </span>
            <span className="whitespace-nowrap">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Edit Profile Modal Dialog */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Driver Profile">
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 text-on-surface">
          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold text-slate-900 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold text-slate-900 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold text-slate-900 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1">Vehicle Details &amp; Kit</label>
            <input
              type="text"
              placeholder="e.g. Toyota Corolla 1.8L (Dual Fuel CNG)"
              value={editVehicle}
              onChange={(e) => setEditVehicle(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold text-slate-900 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1">Registered State</label>
            <select
              value={editState}
              onChange={(e) => setEditState(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3.5 py-2.5 text-[13.5px] font-semibold text-slate-900 outline-none focus:border-primary"
            >
              <option value="Abuja FCT">Abuja FCT</option>
              <option value="Lagos">Lagos</option>
              <option value="Ogun">Ogun</option>
              <option value="Rivers">Rivers</option>
              <option value="Kano">Kano</option>
              <option value="Edo">Edo</option>
              <option value="Delta">Delta</option>
              <option value="Oyo">Oyo</option>
              <option value="Kaduna">Kaduna</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2.5 rounded-full text-[13px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-full text-[13px] font-extrabold text-white bg-primary hover:bg-deep-teal shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
