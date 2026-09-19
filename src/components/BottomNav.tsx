import React from 'react';

export type TabType = 'map' | 'conversions' | 'community' | 'profile';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadNotifications?: number;
}

const TABS: { id: TabType; label: string; icon: string; aria: string }[] = [
  { id: 'map', label: 'Map', icon: 'near_me', aria: 'Map' },
  { id: 'conversions', label: 'Kits', icon: 'propane_tank', aria: 'CNG Kit Centers' },
  { id: 'community', label: 'Community', icon: 'forum', aria: 'Community' },
  { id: 'profile', label: 'Profile', icon: 'person', aria: 'Profile' },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadNotifications = 0,
}) => {
  return (
    <nav className="lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-[380px] bg-white rounded-[28px] shadow-[0_10px_32px_rgba(31,41,35,0.18)] grid grid-cols-4 items-end px-2 pb-2 pt-2 font-['Urbanist',sans-serif]">
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.aria}
            aria-current={active ? 'page' : undefined}
            className="relative flex flex-col items-center active:scale-95 transition-transform"
          >
            <span
              className={`flex items-center justify-center rounded-full transition-all duration-200 ${
                active
                  ? 'w-11 h-11 -mt-7 bg-primary text-white shadow-[0_8px_16px_rgba(49,154,63,0.4)]'
                  : 'w-11 h-9 text-slate-400'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${active ? 'material-symbols-fill' : ''}`}>
                {tab.icon}
              </span>
            </span>
            {tab.id === 'community' && unreadNotifications > 0 && (
              <span className="absolute top-0 right-[22%] min-w-[16px] h-4 px-1 bg-status-red text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {unreadNotifications}
              </span>
            )}
            <span
              className={`text-[11px] leading-none mt-1 ${
                active ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-400'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
