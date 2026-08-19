import React from 'react';

export type TabType = 'map' | 'community' | 'profile';

interface BottomNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  unreadNotifications?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  unreadNotifications = 0,
}) => {
  return (
    <nav className="fixed bottom-0 w-full z-50 bg-[#f2fcf5]/90 backdrop-blur-xl pb-safe shadow-[0_-2px_12px_rgba(0,0,0,0.06)] border-t border-[#dbe5de]/70">
      <div className="h-18 max-w-xl mx-auto flex justify-around items-center px-4">
        {/* Map Tab */}
        <button
          onClick={() => onTabChange('map')}
          className={`flex flex-col items-center justify-center min-w-[70px] py-1.5 transition-all duration-200 ${
            activeTab === 'map'
              ? 'text-[#006c50] scale-105 font-bold'
              : 'text-[#3a4a43] hover:text-[#006c50] opacity-80'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[26px] ${
              activeTab === 'map' ? 'material-symbols-fill' : ''
            }`}
          >
            map
          </span>
          <span className="text-[12px] tracking-wide mt-0.5">Map</span>
        </button>

        {/* Community Tab */}
        <button
          onClick={() => onTabChange('community')}
          className={`flex flex-col items-center justify-center min-w-[70px] py-1.5 transition-all duration-200 relative ${
            activeTab === 'community'
              ? 'text-[#006c50] scale-105 font-bold'
              : 'text-[#3a4a43] hover:text-[#006c50] opacity-80'
          }`}
        >
          <div className="relative">
            <span
              className={`material-symbols-outlined text-[26px] ${
                activeTab === 'community' ? 'material-symbols-fill' : ''
              }`}
            >
              groups
            </span>
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-[#ba1a1a] text-white text-[9px] font-extrabold rounded-full flex items-center justify-center border-2 border-[#f2fcf5]">
                {unreadNotifications}
              </span>
            )}
          </div>
          <span className="text-[12px] tracking-wide mt-0.5">Community</span>
        </button>

        {/* Profile Tab */}
        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center justify-center min-w-[70px] py-1.5 transition-all duration-200 ${
            activeTab === 'profile'
              ? 'text-[#006c50] scale-105 font-bold'
              : 'text-[#3a4a43] hover:text-[#006c50] opacity-80'
          }`}
        >
          <span
            className={`material-symbols-outlined text-[26px] ${
              activeTab === 'profile' ? 'material-symbols-fill' : ''
            }`}
          >
            person
          </span>
          <span className="text-[12px] tracking-wide mt-0.5">Profile</span>
        </button>
      </div>
    </nav>
  );
};
