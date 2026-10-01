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

/**
 * Floating bottom nav, redesign spec (design_handoff_cng_connect_mobile):
 * frosted-glass pill, 68pt tall, with the active tab's icon in a raised
 * 60x60 green circle popping 34pt above the bar. Icon weight/fill is set via
 * inline font-variation-settings rather than the shared .material-symbols-fill
 * class — that class hardcodes wght 600, the spec wants 500 here.
 */
export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadNotifications = 0,
}) => {
  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed left-3.5 right-3.5 bottom-4 z-50 mx-auto max-w-[380px] h-[68px] rounded-[34px] bg-[rgba(232,233,232,0.94)] backdrop-blur-lg grid grid-cols-4"
      style={{ boxShadow: '0 10px 30px rgba(20,32,26,.14), inset 0 1px 0 rgba(255,255,255,.7)' }}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        const badge =
          tab.id === 'community' && unreadNotifications > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D92D20] text-white text-[11px] font-bold flex items-center justify-center">
              {unreadNotifications}
            </span>
          ) : null;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.aria}
            aria-current={active ? 'page' : undefined}
            className="relative flex flex-col items-center justify-end h-full pb-2.5 gap-1"
          >
            {active ? (
              <span
                className="absolute left-1/2 -translate-x-1/2 -top-[34px] w-[60px] h-[60px] rounded-full bg-primary flex items-center justify-center"
                style={{ boxShadow: '0 6px 16px rgba(40,132,53,.32)' }}
              >
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-white text-[28px]"
                  style={{ fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
                >
                  {tab.icon}
                </span>
                {badge}
              </span>
            ) : (
              <span className="relative flex items-center justify-center w-11 h-7">
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined text-[27px] text-[#3F4642]"
                  style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24" }}
                >
                  {tab.icon}
                </span>
                {badge}
              </span>
            )}
            <span
              className={`font-geist text-[12px] leading-none ${
                active ? 'font-bold text-rd-ink' : 'font-medium text-[#6B706D]'
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
