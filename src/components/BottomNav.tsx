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
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.id === activeTab));
  return (
    <nav aria-label="Primary" className="lg:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-[380px] bg-white rounded-[28px] shadow-[0_10px_32px_rgba(31,41,35,0.18)] grid grid-cols-4 px-2 pb-2 pt-2">
      {/* The green bubble slides between tabs (one column = 25% of the inner width) */}
      <div aria-hidden className="absolute top-0 left-2 right-2 pointer-events-none">
        <div
          className="w-1/4 flex justify-center transition-transform duration-300 ease-[cubic-bezier(0.3,1.25,0.5,1)]"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        >
          <span className="block w-11 h-11 -mt-4 rounded-full bg-primary shadow-[0_8px_16px_rgba(40,132,53,0.4)]" />
        </div>
      </div>
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
              className={`flex items-center justify-center w-11 h-9 transition-all duration-300 ${
                active ? '-translate-y-5 text-white' : 'text-slate-400'
              }`}
            >
              <span aria-hidden="true" className={`material-symbols-outlined text-[22px] ${active ? 'material-symbols-fill' : ''}`}>
                {tab.icon}
              </span>
            </span>
            {tab.id === 'community' && unreadNotifications > 0 && (
              <span className="absolute top-0 right-[22%] min-w-[16px] h-4 px-1 bg-status-red text-white text-[0.75rem] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {unreadNotifications}
              </span>
            )}
            <span
              className={`text-[0.75rem] leading-none mt-1 transition-colors ${
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
