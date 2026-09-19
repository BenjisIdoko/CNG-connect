import { BUILD_ID, checkForAppUpdate } from '../utils/appUpdate';
import React, { useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { UserProfile } from '../types';
import { ASSETS } from '../data/mockData';
import { Modal } from './common/Modal';
import { getDriverTier, DRIVER_TIERS } from '../utils/reputationEngine';

interface ProfileScreenProps {
  user: UserProfile;
  onOpenOnboarding: () => void;
  onOpenSignUp?: () => void;
  onSignOut?: () => void;
  onTriggerProximityAlert?: () => void;
  onUpdateState?: (newState: string) => void;
  onUpdateProfile?: (updatedUser: Partial<UserProfile>) => void;
  onUploadAvatar?: (file: File) => Promise<{ url?: string; error?: string }>;
  onOpenRoiCalculator?: () => void;
  onTogglePushNotifications?: () => void;
  isPushGranted?: boolean;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onOpenOnboarding,
  onOpenSignUp,
  onSignOut,
  onUpdateState,
  onUpdateProfile,
  onUploadAvatar,
  onOpenRoiCalculator,
  onTogglePushNotifications,
  isPushGranted,
}) => {
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const [notificationsEnabledLocal, setNotificationsEnabledLocal] = useState(true);
  // Prefer the real browser push-permission state when the parent wires it in;
  // fall back to a local toggle otherwise.
  const notificationsEnabled = onTogglePushNotifications ? Boolean(isPushGranted) : notificationsEnabledLocal;
  const handleToggleNotifications = onTogglePushNotifications ?? (() => setNotificationsEnabledLocal((v) => !v));
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

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || !onUploadAvatar) return;
    setIsUploadingAvatar(true);
    const res = await onUploadAvatar(file);
    setIsUploadingAvatar(false);
    showToast(res.error ? `Photo upload failed: ${res.error}` : 'Profile photo updated!');
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

  const points = user.communityPoints ?? 450;
  const tierProgress = getDriverTier(points);
  const openEdit = () => {
    setEditName(user.name);
    setEditPhone(user.phone);
    setEditEmail(user.email);
    setEditVehicle(user.vehicle || 'Toyota Corolla 1.8L (Dual Fuel CNG)');
    setEditState(user.state || 'Abuja FCT');
    setIsEditModalOpen(true);
  };

  const Row: React.FC<{
    icon: string;
    label: string;
    hint?: string;
    onClick?: () => void;
    right?: React.ReactNode;
    danger?: boolean;
  }> = ({ icon, label, hint, onClick, right, danger }) => (
    <div
      onClick={onClick}
      className={`px-4 py-3.5 flex items-center justify-between gap-3 ${onClick ? 'cursor-pointer active:bg-surface-container' : ''}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`material-symbols-outlined text-[20px] ${danger ? 'text-status-red' : 'text-outline'}`}>{icon}</span>
        <div className="min-w-0">
          <span className={`text-body font-semibold block leading-tight ${danger ? 'text-status-red' : 'text-on-surface'}`}>{label}</span>
          {hint && <span className="text-micro text-outline">{hint}</span>}
        </div>
      </div>
      {right ?? (onClick && <span className="material-symbols-outlined text-outline text-[18px]">chevron_right</span>)}
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-container text-on-surface pb-36 font-['Urbanist',sans-serif]">
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-on-surface/90 text-white text-caption font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      {/* Dark identity header */}
      <div className="bg-deep-teal text-white px-5 pt-[max(env(safe-area-inset-top,0px),2.75rem)] lg:pt-8 pb-5">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <img
                src={user.avatar || ASSETS.userAvatar}
                alt={user.name}
                className="w-14 h-14 rounded-full object-cover bg-white/10"
              />
              {onUploadAvatar ? (
                <>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    aria-label="Change profile photo"
                    className="absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] rounded-full bg-primary text-white border-2 border-deep-teal flex items-center justify-center active:scale-90 transition-transform disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {isUploadingAvatar ? 'progress_activity' : 'photo_camera'}
                    </span>
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
                </>
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-primary border-2 border-deep-teal" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-body-lg leading-tight truncate">{user.name || 'Driver'}</h2>
              <PopoverPrimitive.Root>
                <PopoverPrimitive.Trigger className="flex items-center gap-1 mt-0.5 text-micro text-[#B7CBB9] cursor-pointer text-left max-w-full">
                  <span className="truncate">{user.vehicle || 'Add your vehicle'}</span>
                  <span className="material-symbols-outlined text-[15px] shrink-0">chevron_right</span>
                </PopoverPrimitive.Trigger>
                <PopoverPrimitive.Portal>
                  <PopoverPrimitive.Content
                    sideOffset={5}
                    className="z-[150] w-64 bg-white rounded-2xl p-3 shadow-xl flex flex-col gap-1.5"
                  >
                    <span className="text-micro font-bold text-outline uppercase tracking-wider px-2">Switch active vehicle</span>
                    {[
                      'Toyota Corolla 1.8L (Dual Fuel CNG)',
                      'Hyundai Accent 1.6L (CNG Kit)',
                      'Qoray E-Trike (100% EV)',
                    ].map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          if (onUpdateProfile) {
                            onUpdateProfile({ vehicle: v });
                            showToast(`Active vehicle switched to ${v}`);
                          }
                        }}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-caption font-semibold flex items-center justify-between ${
                          user.vehicle === v ? 'bg-primary-container text-emerald-800' : 'text-slate-700 hover:bg-surface-container'
                        }`}
                      >
                        <span className="truncate">{v}</span>
                        {user.vehicle === v && <span className="material-symbols-outlined text-[15px] text-primary">check</span>}
                      </button>
                    ))}
                  </PopoverPrimitive.Content>
                </PopoverPrimitive.Portal>
              </PopoverPrimitive.Root>
            </div>
            <button
              onClick={openEdit}
              aria-label="Edit Profile"
              className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-95 transition-transform shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">edit</span>
            </button>
          </div>

          <div className="flex gap-2.5 mt-5">
            {[
              { v: points.toLocaleString(), l: 'Points', big: true },
              { v: String(user.reportsCount), l: 'Reports' },
              { v: String(user.reputationScore), l: 'Rating' },
            ].map((t) => (
              <div key={t.l} className="flex-1 bg-white/[0.06] rounded-[14px] py-2.5 text-center">
                <div className={`font-extrabold tracking-tight ${t.big ? 'text-[23px]' : 'text-[19px]'}`}>{t.v}</div>
                <div className="text-[12px] text-[#9FB8A3] mt-0.5">{t.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 pt-5 flex flex-col gap-4">
        {/* Tier + badges */}
        <div>
          <div className="flex items-center justify-between">
            <div className="font-bold text-caption">{tierProgress.currentTier.title}</div>
            {tierProgress.nextTier ? (
              <div className="text-micro text-outline">
                {tierProgress.pointsForNextTier} pts to {tierProgress.nextTier.title}
              </div>
            ) : (
              <div className="text-micro text-outline">Top tier reached</div>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-surface-container-highest mt-2 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${tierProgress.nextTier ? tierProgress.progressPercent : 100}%` }}
            />
          </div>
          <div className="flex gap-2 mt-3.5">
            {DRIVER_TIERS.map((t) => {
              const unlocked = points >= t.minPoints;
              return (
                <div
                  key={t.id}
                  title={`${t.title} · ${t.minPoints}+ pts`}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-[20px] ${
                    unlocked ? 'bg-primary-container' : 'bg-surface-dim/60 opacity-60 grayscale'
                  }`}
                >
                  {unlocked ? t.badgeIcon : <span className="material-symbols-outlined text-[16px] text-slate-500">lock</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Savings summary → canonical calculator */}
        <div
          onClick={onOpenRoiCalculator}
          className={`bg-white rounded-2xl p-4 shadow-[0_4px_14px_rgba(14,20,32,0.05)] ${onOpenRoiCalculator ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}`}
        >
          <div className="text-micro font-semibold text-outline">Estimated savings</div>
          <div className="font-extrabold text-[22px] text-primary mt-0.5 tracking-tight">
            ₦{monthlySavings.toLocaleString()}
            <span className="text-caption font-semibold text-outline">/mo</span>
          </div>
          {onOpenRoiCalculator && (
            <div className="text-micro font-bold text-emerald-700 mt-1">Open full calculator →</div>
          )}
        </div>

        {/* Settings */}
        <div className="bg-white rounded-2xl shadow-[0_4px_14px_rgba(14,20,32,0.05)] divide-y divide-surface-container overflow-hidden">
          <Row
            icon="location_on"
            label="Home state"
            hint="Alerts are scoped to this state"
            right={
              <select
                value={user.state || 'Abuja FCT'}
                onChange={(e) => {
                  const newState = e.target.value;
                  if (onUpdateState) onUpdateState(newState);
                  if (onUpdateProfile) onUpdateProfile({ state: newState });
                  showToast(`Home state updated to ${newState}`);
                }}
                className="bg-transparent text-outline font-semibold text-caption focus:outline-none"
              >
                {['Abuja FCT', 'Lagos', 'Ogun', 'Rivers', 'Kano', 'Edo', 'Delta', 'Oyo', 'Kaduna'].map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            }
          />
          <Row
            icon="notifications"
            label="Proximity alerts"
            right={
              <button
                onClick={handleToggleNotifications}
                aria-pressed={notificationsEnabled}
                aria-label="Toggle proximity alerts"
                className={`w-[34px] h-5 rounded-full transition-colors relative shrink-0 ${
                  notificationsEnabled ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                    notificationsEnabled ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            }
          />
          <Row
            icon="ios_share"
            label="Share app with drivers"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'CNG-Connect',
                  text: 'Find CNG stations across Nigeria with live pressure updates!',
                  url: window.location.href,
                });
              } else {
                showToast('App link copied!');
              }
            }}
          />
          <Row icon="help" label="Help & FAQ" onClick={() => showToast('Help Center')} />
          <Row icon="slideshow" label="Replay onboarding" onClick={onOpenOnboarding} />
          {onOpenSignUp && <Row icon="person_add" label="Sign up / switch account" onClick={onOpenSignUp} />}
          <Row
            icon="sync"
            label="Check for updates"
            hint={`Version ${BUILD_ID}`}
            onClick={async () => {
              showToast('Checking for updates…');
              const r = await checkForAppUpdate();
              if (r === 'current') showToast('You have the latest version');
              else if (r === 'unknown') showToast('Could not check right now');
            }}
          />
          <Row icon="logout" label="Sign out" danger onClick={onSignOut || onOpenOnboarding} />
        </div>
      </div>

      {/* Edit Profile Modal Dialog */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Driver Profile">
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 text-on-surface">
          <div>
            <label className="block text-caption font-bold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3 py-2 text-body font-semibold text-slate-900 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-caption font-bold text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3 py-2 text-body font-semibold text-slate-900 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-caption font-bold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3 py-2 text-body font-semibold text-slate-900 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-caption font-bold text-slate-700 mb-1">Vehicle Details &amp; Kit</label>
            <input
              type="text"
              placeholder="e.g. Toyota Corolla 1.8L (Dual Fuel CNG)"
              value={editVehicle}
              onChange={(e) => setEditVehicle(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3 py-2 text-body font-semibold text-slate-900 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-caption font-bold text-slate-700 mb-1">Registered State</label>
            <select
              value={editState}
              onChange={(e) => setEditState(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3 py-2 text-body font-semibold text-slate-900 outline-none focus:border-primary"
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
              className="px-4 py-2 rounded-full text-body font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-full text-body font-extrabold text-white bg-primary hover:bg-deep-teal shadow-sm"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
