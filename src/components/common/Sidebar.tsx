import React from 'react';
import { UserProfile } from '../../types';
import { ASSETS } from '../../data/mockData';

interface SidebarProps {
  activeTab: 'map' | 'conversions' | 'community' | 'profile';
  setActiveTab: (tab: 'map' | 'conversions' | 'community' | 'profile') => void;
  userProfile?: UserProfile;
  onOpenAiAssistant?: () => void;
  onOpenRoiCalculator?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  userProfile,
  onOpenAiAssistant,
  onOpenRoiCalculator,
}) => {
  const navItems = [
    { id: 'map' as const, label: 'Map & Stations', icon: 'map', badge: 'Live' },
    { id: 'conversions' as const, label: 'Conversion Centres', icon: 'build_circle' },
    { id: 'community' as const, label: 'Driver Community', icon: 'forum' },
    { id: 'profile' as const, label: 'My Profile', icon: 'person' },
  ];

  return (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200/80 z-40 shadow-xs select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-700 via-primary to-emerald-500 text-white flex items-center justify-center font-black shadow-md shadow-emerald-700/20">
          <span className="material-symbols-outlined text-[24px]">local_gas_station</span>
        </div>
        <div>
          <h1 className="font-extrabold text-[17px] text-slate-900 leading-tight">
            CNG-Connect
          </h1>
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            🇳🇬 Clean Mobility
          </span>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto">
        <span className="px-3 text-micro font-bold text-slate-400 uppercase tracking-wider mb-1">
          Navigation
        </span>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full py-3 px-3.5 rounded-2xl font-extrabold text-[14px] flex items-center justify-between transition-all active:scale-98 ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                    isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Quick Tools Section */}
        <span className="px-3 text-micro font-bold text-slate-400 uppercase tracking-wider mt-6 mb-1">
          Smart Tools
        </span>

        {onOpenRoiCalculator && (
          <button
            onClick={onOpenRoiCalculator}
            className="w-full py-2.5 px-3.5 rounded-2xl font-extrabold text-[13px] bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-3 transition-all"
          >
            <span className="material-symbols-outlined text-[20px] text-emerald-600">calculate</span>
            <span>CNG & EV Savings</span>
          </button>
        )}

        {onOpenAiAssistant && (
          <button
            onClick={onOpenAiAssistant}
            className="w-full py-2.5 px-3.5 rounded-2xl font-extrabold text-[13px] bg-gradient-to-r from-emerald-50 to-sky-50 hover:from-emerald-100 hover:to-sky-100 text-primary border border-emerald-200 flex items-center gap-3 transition-all mt-1"
          >
            <span className="material-symbols-outlined text-[20px] text-primary">smart_toy</span>
            <span>CNG Copilot AI</span>
          </button>
        )}
      </div>

      {/* Bottom User Card */}
      {userProfile && (
        <div className="p-3 m-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
          <img
            src={userProfile.avatar || ASSETS.userAvatar}
            alt={userProfile.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-primary"
          />
          <div className="flex-1 min-w-0">
            <h4 className="font-extrabold text-[13px] text-slate-900 truncate leading-tight">
              {userProfile.name}
            </h4>
            <p className="text-[11px] font-semibold text-slate-500 truncate">
              {userProfile.vehicle || 'Verified Driver'}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};
