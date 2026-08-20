import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ASSETS } from '../data/mockData';

interface ProfileScreenProps {
  user: UserProfile;
  onOpenOnboarding: () => void;
  onOpenSignUp?: () => void;
  onTriggerProximityAlert: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onOpenOnboarding,
  onOpenSignUp,
  onTriggerProximityAlert,
}) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  return (
    <div className="min-h-screen bg-[#eef7f2] text-slate-900 pb-36 pt-4 font-['Plus_Jakarta_Sans',sans-serif]">
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-[12.5px] font-bold px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
          {toastMessage}
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 md:px-6 flex flex-col gap-5">
        {/* Profile Card */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/70 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src={user.avatar || ASSETS.userAvatar}
              alt={user.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
            />
            <div>
              <h2 className="font-extrabold text-[18px] text-slate-900 leading-tight">
                {user.name}
              </h2>
              <p className="text-[12.5px] text-slate-500 font-medium mt-0.5">
                {user.email || user.phone || 'driver@gasfinder.ng'}
              </p>
            </div>
          </div>

          <button
            onClick={() => showToast('Profile edit opened')}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all active:scale-95"
            aria-label="Edit Profile"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        </div>

        {/* General Settings Group */}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-extrabold text-slate-600 px-1">
            General
          </span>

          <div className="bg-white rounded-3xl p-1.5 shadow-sm border border-slate-200/70 flex flex-col divide-y divide-slate-100">
            {/* Payment Method */}
            <div
              onClick={() => showToast('Payment Methods')}
              className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">
                  account_balance_wallet
                </span>
                <span className="text-[14px] font-bold text-slate-800">
                  Payment Method
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-400 text-[18px]">
                chevron_right
              </span>
            </div>

            {/* Location */}
            <div
              onClick={() => showToast('City: Abuja FCT')}
              className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">
                  location_on
                </span>
                <span className="text-[14px] font-bold text-slate-800">
                  Location &amp; City
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="text-[12px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Abuja
                </span>
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </div>
            </div>

            {/* Language */}
            <div
              onClick={() => showToast('Language: English')}
              className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">
                  translate
                </span>
                <span className="text-[14px] font-bold text-slate-800">
                  Language
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-400 text-[18px]">
                chevron_right
              </span>
            </div>

            {/* Notifications */}
            <div className="p-3.5 flex items-center justify-between rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">
                  notifications
                </span>
                <span className="text-[14px] font-bold text-slate-800">
                  Proximity Alert Notifications
                </span>
              </div>

              {/* iOS style toggle switch */}
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  notificationsEnabled ? 'bg-[#00c853]' : 'bg-slate-300'
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
          <span className="text-[13px] font-extrabold text-slate-600 px-1">
            Support &amp; Community
          </span>

          <div className="bg-white rounded-3xl p-1.5 shadow-sm border border-slate-200/70 flex flex-col divide-y divide-slate-100">
            {/* Feedback */}
            <div
              onClick={() => showToast('Feedback screen')}
              className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">
                  chat_bubble
                </span>
                <span className="text-[14px] font-bold text-slate-800">
                  Feedback &amp; Suggestions
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-400 text-[18px]">
                chevron_right
              </span>
            </div>

            {/* Share */}
            <div
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'GasFinder CNG Locator',
                    text: 'Locate CNG refuelling stations across Nigeria with live pressure updates!',
                    url: window.location.href,
                  });
                } else {
                  showToast('App link copied!');
                }
              }}
              className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">
                  share
                </span>
                <span className="text-[14px] font-bold text-slate-800">
                  Share App with Drivers
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-400 text-[18px]">
                chevron_right
              </span>
            </div>

            {/* Help */}
            <div
              onClick={() => showToast('Help Center')}
              className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-700 text-[20px]">
                  help
                </span>
                <span className="text-[14px] font-bold text-slate-800">
                  Help &amp; FAQ
                </span>
              </div>
              <span className="material-symbols-outlined text-slate-400 text-[18px]">
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
              className="w-full py-3.5 px-4 bg-[#004D40] hover:bg-[#006c50] text-white font-extrabold text-[14px] rounded-2xl shadow-sm flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <span className="material-symbols-outlined text-[20px] text-[#00E676]">
                person_add
              </span>
              <span>Sign Up / Create Driver Account</span>
            </button>
          )}

          <button
            onClick={onOpenOnboarding}
            className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-[14px] rounded-2xl shadow-xs border border-slate-200/80 flex items-center justify-center gap-2 active:scale-98 transition-all"
          >
            <span className="material-symbols-outlined text-slate-500 text-[20px]">
              logout
            </span>
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
