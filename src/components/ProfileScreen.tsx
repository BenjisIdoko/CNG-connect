import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ASSETS } from '../data/mockData';

interface ProfileScreenProps {
  user: UserProfile;
  onOpenOnboarding: () => void;
  onTriggerProximityAlert: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onOpenOnboarding,
  onTriggerProximityAlert,
}) => {
  const [dailyDistanceKm, setDailyDistanceKm] = useState(45);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Calculations for CNG vs Petrol in Nigeria
  // Petrol @ ₦1,050/liter, 10km/liter -> ₦105 per km
  // CNG @ ₦230/kg, 13km/kg -> ₦17.7 per km
  // Savings per km = ₦87.3
  const monthlyPetrolCost = Math.round(dailyDistanceKm * 30 * 105);
  const monthlyCngCost = Math.round(dailyDistanceKm * 30 * 17.7);
  const calculatedSavings = monthlyPetrolCost - monthlyCngCost;

  return (
    <div className="min-h-screen bg-[#f2fcf5] text-[#141d19] pb-32">
      <div className="max-w-xl mx-auto px-4 md:px-6 pt-4 flex flex-col gap-4">
        {/* User Profile Card */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-[#dbe5de] flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={user.avatar || ASSETS.userAvatar}
                alt={user.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#006c50]"
              />
              <span
                className="absolute bottom-0 right-0 w-5 h-5 bg-[#006c50] text-white rounded-full flex items-center justify-center border-2 border-white shadow-xs"
                title="Verified Driver"
              >
                <span
                  className="material-symbols-outlined text-[13px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-[20px] font-extrabold text-[#141d19] truncate">
                  {user.name}
                </h1>
              </div>
              <p className="text-[13px] text-[#3a4a43] font-medium">
                {user.phone}
              </p>
              <span className="inline-flex items-center gap-1 bg-[#00ffc2]/20 text-[#007255] text-[11px] font-extrabold px-2.5 py-0.5 rounded-full mt-1">
                <span
                  className="material-symbols-outlined text-[13px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  military_tech
                </span>
                Gold Contributor
              </span>
            </div>

            <button
              onClick={onOpenOnboarding}
              className="p-2 rounded-xl bg-[#e6f0e9] text-[#006c50] hover:bg-[#dbe5de] transition-colors"
              title="Account Options"
            >
              <span className="material-symbols-outlined text-[20px]">
                sync_alt
              </span>
            </button>
          </div>

          {/* Vehicle info pill */}
          <div className="bg-[#ecf6ef] rounded-2xl p-3.5 border border-[#dbe5de]/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#006c50] text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">
                directions_car
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-extrabold text-[#6a7b72] uppercase tracking-wider block">
                Primary Vehicle
              </span>
              <p className="text-[14px] font-extrabold text-[#141d19] truncate">
                {user.vehicle}
              </p>
            </div>
          </div>
        </div>

        {/* Live Fuel Savings Calculator */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-[#dbe5de] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006c50] text-[22px]">
                savings
              </span>
              <h2 className="text-[18px] font-extrabold text-[#141d19]">
                CNG Monthly Savings
              </h2>
            </div>
            <span className="text-[11px] font-bold bg-[#00E676]/20 text-[#007255] px-2 py-0.5 rounded-full">
              Live Tracker
            </span>
          </div>

          <div className="bg-[#ecf6ef] rounded-2xl p-4 flex items-baseline justify-between border border-[#dbe5de]/60">
            <div>
              <span className="text-[11px] font-extrabold text-[#6a7b72] uppercase">
                Estimated Monthly Savings
              </span>
              <div className="text-[32px] font-black text-[#004D40] leading-tight">
                ₦{calculatedSavings.toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[#6a7b72] block">vs. Petrol</span>
              <span className="text-[13px] font-bold text-[#00E676]">
                ~83% Cheaper
              </span>
            </div>
          </div>

          {/* Daily driving distance slider */}
          <div className="mt-1">
            <div className="flex justify-between text-[13px] font-bold text-[#3a4a43] mb-1">
              <span>Daily driving: {dailyDistanceKm} km/day</span>
              <span className="text-[#006c50]">{dailyDistanceKm * 30} km/mo</span>
            </div>
            <input
              type="range"
              min="10"
              max="150"
              step="5"
              value={dailyDistanceKm}
              onChange={(e) => setDailyDistanceKm(Number(e.target.value))}
              className="w-full accent-[#006c50]"
            />
            <div className="flex justify-between text-[11px] text-[#6a7b72] mt-1">
              <span>Short commute (10km)</span>
              <span>Ride-hailing (150km)</span>
            </div>
          </div>
        </div>

        {/* Community Stats Bento */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white rounded-2xl p-3.5 border border-[#dbe5de] text-center shadow-xs">
            <div className="text-[22px] font-black text-[#006c50]">
              {user.reportsCount}
            </div>
            <span className="text-[11px] font-bold text-[#6a7b72] leading-tight block mt-0.5">
              Reports Filed
            </span>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-[#dbe5de] text-center shadow-xs">
            <div className="text-[22px] font-black text-[#FFB800] flex items-center justify-center gap-0.5">
              <span>{user.reputationScore}</span>
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#6a7b72] leading-tight block mt-0.5">
              Trust Rating
            </span>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-[#dbe5de] text-center shadow-xs">
            <div className="text-[22px] font-black text-[#fe9400]">100%</div>
            <span className="text-[11px] font-bold text-[#6a7b72] leading-tight block mt-0.5">
              Accuracy
            </span>
          </div>
        </div>

        {/* Demo Simulation Controls */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-[#dbe5de] flex flex-col gap-3">
          <h2 className="text-[16px] font-extrabold text-[#141d19] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#006c50] text-[20px]">
              touch_app
            </span>
            <span>App Features &amp; Screen Simulation</span>
          </h2>

          <div className="flex flex-col gap-2">
            <button
              onClick={onTriggerProximityAlert}
              className="w-full p-3 rounded-2xl bg-[#ecf6ef] hover:bg-[#e0ebe4] border border-[#dbe5de] flex items-center justify-between text-left transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#006c50] text-[22px]">
                  near_me
                </span>
                <div>
                  <span className="text-[14px] font-bold text-[#141d19] block">
                    Simulate Proximity Station Alert
                  </span>
                  <span className="text-[11px] text-[#6a7b72]">
                    Shows the iOS push banner when near Wuse 2
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[#6a7b72] text-[18px]">
                play_arrow
              </span>
            </button>

            <button
              onClick={onOpenOnboarding}
              className="w-full p-3 rounded-2xl bg-[#ecf6ef] hover:bg-[#e0ebe4] border border-[#dbe5de] flex items-center justify-between text-left transition-all active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#006c50] text-[22px]">
                  smartphone
                </span>
                <div>
                  <span className="text-[14px] font-bold text-[#141d19] block">
                    View Onboarding / Login Screen
                  </span>
                  <span className="text-[11px] text-[#6a7b72]">
                    Phone number formatting &amp; intro illustration
                  </span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[#6a7b72] text-[18px]">
                chevron_right
              </span>
            </button>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#ecf6ef] border border-[#dbe5de]">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#006c50] text-[22px]">
                  notifications_active
                </span>
                <div>
                  <span className="text-[14px] font-bold text-[#141d19] block">
                    Station Proximity Notifications
                  </span>
                  <span className="text-[11px] text-[#6a7b72]">
                    Notify when passing near low stock stations
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="w-5 h-5 accent-[#006c50] rounded-md cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
