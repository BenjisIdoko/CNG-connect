import { InviteCard } from './InviteCard';
import { FEATURES } from '../config/features';
import { validatePhoneNumber } from '../utils/phoneValidator';
import { BUILD_ID, checkForAppUpdate } from '../utils/appUpdate';
import React, { useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { UserProfile } from '../types';
import { ASSETS } from '../data/mockData';
import { Modal } from './common/Modal';
import { getDriverTier, DRIVER_TIERS } from '../utils/reputationEngine';
import { Icon } from './common/Icon';
import { TierBadge } from './common/TierBadge';
import { CountUp } from './common/CountUp';
import { isAnalyticsOptedOut, setAnalyticsEnabled } from '../services/analytics';
import { ThemePref, getThemePref, setThemePref } from '../utils/theme';
import { Avatar } from './common/Avatar';

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
  const [editVehicle, setEditVehicle] = useState(user.vehicle || 'Toyota Corolla 1.8L');
  const [editCngKit, setEditCngKit] = useState(user.cngKit || '');
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
    // A phone number is compulsory; a changed number must be a valid Nigerian one.
    let phone = user.phone;
    if (editPhone.trim() !== user.phone.trim()) {
      const check = validatePhoneNumber(editPhone);
      if (!check.isValid) {
        showToast(check.error || 'Enter a valid Nigerian phone number.');
        return;
      }
      phone = check.formatted || editPhone.trim();
    } else if (!phone.trim()) {
      showToast('A phone number is required.');
      return;
    }
    const updatedData: Partial<UserProfile> = {
      name: editName.trim() || user.name,
      phone,
      email: editEmail.trim() || user.email,
      vehicle: editVehicle.trim() || user.vehicle,
      cngKit: editCngKit.trim(),
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

  const [analyticsOn, setAnalyticsOn] = useState(() => !isAnalyticsOptedOut());
  const [themePref, setThemePrefState] = useState<ThemePref>(() => getThemePref());
  const points = user.communityPoints ?? 450;
  const tierProgress = getDriverTier(points);
  const openEdit = () => {
    setEditName(user.name);
    setEditPhone(user.phone);
    setEditEmail(user.email);
    setEditVehicle(user.vehicle || 'Toyota Corolla 1.8L');
    setEditCngKit(user.cngKit || '');
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
        <span aria-hidden="true" className={`material-symbols-outlined text-[20px] ${danger ? 'text-status-red' : 'text-outline'}`}>{icon}</span>
        <div className="min-w-0">
          <span className={`text-body font-semibold block leading-tight ${danger ? 'text-status-red' : 'text-on-surface'}`}>{label}</span>
          {hint && <span className="text-micro text-outline">{hint}</span>}
        </div>
      </div>
      {right ?? (onClick && <span aria-hidden="true" className="material-symbols-outlined text-outline text-[18px]">chevron_right</span>)}
    </div>
  );

  return (
    // data-theme="light": same reasoning as the other rebuilt screens — the handoff has no
    // dark-mode values yet.
    <div data-theme="light" className="min-h-screen bg-rd-bg text-rd-ink pb-36">
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-on-surface/90 text-white text-caption font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      {/* Dark identity card — design_handoff_cng_connect_mobile 3e: avatar/name/vehicle/edit,
          points/reports/rating, and tier progress all live together on the ink surface. */}
      <div className="bg-rd-ink text-white px-5 pt-[max(env(safe-area-inset-top,0px),2.75rem)] lg:pt-8 pb-5 rounded-b-[26px]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <Avatar src={user.avatar} name={user.name} className="w-14 h-14 text-[1.25rem]" />
              {onUploadAvatar ? (
                <>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    aria-label="Change profile photo"
                    className="absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] rounded-full bg-primary text-white border-2 border-rd-ink flex items-center justify-center active:scale-90 transition-transform disabled:opacity-60"
                  >
                    <span aria-hidden="true" className="material-symbols-outlined text-[13px]">
                      {isUploadingAvatar ? 'progress_activity' : 'photo_camera'}
                    </span>
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
                </>
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-primary border-2 border-rd-ink" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-geist font-bold text-[1.1875rem] leading-tight truncate">{user.name || 'Driver'}</h2>
              <PopoverPrimitive.Root>
                <PopoverPrimitive.Trigger className="flex items-center gap-1 mt-0.5 text-micro text-[#B7CBB9] cursor-pointer text-left max-w-full">
                  <span className="truncate">
                    {[user.vehicle, user.cngKit].filter(Boolean).join(' · ') || 'Add your vehicle'}
                  </span>
                  <span aria-hidden="true" className="material-symbols-outlined text-[15px] shrink-0">chevron_right</span>
                </PopoverPrimitive.Trigger>
                <PopoverPrimitive.Portal>
                  <PopoverPrimitive.Content
                    sideOffset={5}
                    className="z-[150] w-64 bg-surface-container-high rounded-2xl p-3 shadow-xl flex flex-col gap-1.5"
                  >
                    <span className="text-micro font-bold text-outline uppercase tracking-wider px-2">Switch active vehicle</span>
                    {['Toyota Corolla 1.8L', 'Hyundai Accent 1.6L', 'Qoray E-Trike (EV)'].map((v) => (
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
                        {user.vehicle === v && <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-primary">check</span>}
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
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">edit</span>
            </button>
          </div>

          <div className="flex gap-2.5 mt-5">
            {[
              { v: <CountUp value={points} format={(n) => n.toLocaleString()} />, l: 'Points' },
              { v: <CountUp value={user.reportsCount} />, l: 'Reports' },
              { v: String(user.reputationScore), l: 'Rating' },
            ].map((t) => (
              <div key={t.l} className="flex-1 text-center">
                <div className="font-geist font-bold text-[1.5rem] tracking-tight">{t.v}</div>
                <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-[#A9AFBA] mt-0.5">{t.l}</div>
              </div>
            ))}
          </div>

          <div className="h-px bg-[#2A3830] mt-4" />

          {/* Tier progress — on the ink surface, per the handoff */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <div className="font-geist font-bold text-caption">{tierProgress.currentTier.title}</div>
              {tierProgress.nextTier ? (
                <div className="text-micro text-[#A9AFBA]">
                  {tierProgress.pointsForNextTier} pts to {tierProgress.nextTier.title}
                </div>
              ) : (
                <div className="text-micro text-[#A9AFBA]">Top tier reached</div>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-[#2A3830] mt-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${tierProgress.nextTier ? tierProgress.progressPercent : 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 pt-5 flex flex-col gap-4">
        {/* Tier badges — kept as a real, existing feature even though it's not shown in the
            handoff's one 3e screenshot; not removing working functionality on that basis. */}
        <div className="flex gap-2">
          {DRIVER_TIERS.map((t) => {
            const unlocked = points >= t.minPoints;
            return (
              <div
                key={t.id}
                title={`${t.title} · ${t.minPoints}+ pts`}
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-[1.25rem] ${
                  unlocked ? 'bg-primary-container' : 'bg-surface-dim/60 opacity-60 grayscale'
                }`}
              >
                {unlocked ? <TierBadge tierId={t.id} size={24} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-slate-500">lock</span>}
              </div>
            );
          })}
        </div>

        {/* Nudge: first-report incentive, shown only before any report */}
        {user.reportsCount === 0 && (
          <div className="rounded-2xl bg-rd-available-container px-4 py-3 flex items-center gap-3">
            <span aria-hidden="true" className="material-symbols-outlined text-rd-on-available-container text-[20px] shrink-0">bolt</span>
            <p className="flex-1 text-caption font-semibold text-rd-on-available-container">
              Your first station report is worth +10 pts. It's the fastest way to Verified Reporter.
            </p>
          </div>
        )}

        {FEATURES.ENABLE_REFERRALS && (
          <InviteCard onSignIn={onOpenSignUp} onToast={showToast} />
        )}

        {/* Savings summary → canonical calculator */}
        <div
          onClick={onOpenRoiCalculator}
          className={`bg-surface-container-high rounded-2xl p-4 shadow-[0_4px_14px_rgba(14,20,32,0.05)] ${onOpenRoiCalculator ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}`}
        >
          <div className="text-micro font-semibold text-outline">Estimated savings</div>
          <div className="font-extrabold text-[1.375rem] text-primary mt-0.5 tracking-tight">
            ₦{monthlySavings.toLocaleString()}
            <span className="text-caption font-semibold text-outline">/mo</span>
          </div>
          {onOpenRoiCalculator && (
            <div className="text-micro font-bold text-emerald-700 mt-1"><span className="inline-flex items-center gap-1">Open full calculator <Icon name="arrow_forward" size={14} /></span></div>
          )}
        </div>

        {/* Settings */}
        <div className="bg-surface-container-high rounded-2xl shadow-[0_4px_14px_rgba(14,20,32,0.05)] divide-y divide-surface-container overflow-hidden">
          <Row
            icon="dark_mode"
            label="Appearance"
            right={
              <div role="radiogroup" aria-label="Appearance" className="flex gap-0.5 bg-surface-container rounded-full p-0.5">
                {(
                  [
                    ['system', 'Auto'],
                    ['light', 'Light'],
                    ['dark', 'Dark'],
                  ] as const
                ).map(([pref, label]) => (
                  <button
                    key={pref}
                    role="radio"
                    aria-checked={themePref === pref}
                    onClick={() => {
                      setThemePref(pref);
                      setThemePrefState(pref);
                    }}
                    className={`px-3 py-1.5 rounded-full text-[0.75rem] font-bold transition-colors ${
                      themePref === pref ? 'bg-rd-ink text-white' : 'text-outline'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          />
          <Row
            icon="location_on"
            label="Home state"
            hint="Alerts follow this state"
            right={
              <select aria-label="Home state"
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
            icon="tune"
            label="Anonymous usage data"
            hint="Helps us fix and improve the app. No name, email or location."
            right={
              <button
                onClick={() => {
                  const next = !analyticsOn;
                  setAnalyticsOn(next);
                  setAnalyticsEnabled(next);
                  showToast(next ? 'Thanks — anonymous usage data is on' : 'Anonymous usage data is off');
                }}
                aria-pressed={analyticsOn}
                aria-label="Toggle anonymous usage data"
                className={`w-[34px] h-5 rounded-full transition-colors relative shrink-0 ${
                  analyticsOn ? 'bg-primary' : 'bg-surface-container-highest'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                    analyticsOn ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            }
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
            <label className="block text-caption font-bold text-slate-700 mb-1">Vehicle Details</label>
            <input
              type="text"
              placeholder="e.g. Toyota Corolla 1.8L"
              value={editVehicle}
              onChange={(e) => setEditVehicle(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3 py-2 text-body font-semibold text-slate-900 outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-caption font-bold text-slate-700 mb-1">CNG Kit</label>
            <select
              aria-label="CNG Kit"
              value={editCngKit}
              onChange={(e) => setEditCngKit(e.target.value)}
              className="w-full bg-surface border border-surface-container-highest rounded-xl px-3 py-2 text-body font-semibold text-slate-900 outline-none focus:border-primary"
            >
              <option value="">Not installed yet</option>
              <option value="12kg cylinder, installed">12kg cylinder, installed</option>
              <option value="15kg cylinder, installed">15kg cylinder, installed</option>
              <option value="20kg cylinder, installed">20kg cylinder, installed</option>
              <option value="60L Twin Tank, installed">60L Twin Tank, installed</option>
              <option value="Planning to convert soon">Planning to convert soon</option>
              <option value="Interested in Pi-CNG conversion grant">Interested in Pi-CNG conversion grant</option>
              {/* Keeps an older free-typed value selectable instead of silently discarding it. */}
              {editCngKit &&
                ![
                  '',
                  '12kg cylinder, installed',
                  '15kg cylinder, installed',
                  '20kg cylinder, installed',
                  '60L Twin Tank, installed',
                  'Planning to convert soon',
                  'Interested in Pi-CNG conversion grant',
                ].includes(editCngKit) && <option value={editCngKit}>{editCngKit}</option>}
            </select>
          </div>

          <div>
            <label className="block text-caption font-bold text-slate-700 mb-1">Registered State</label>
            <select aria-label="Registered State"
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
