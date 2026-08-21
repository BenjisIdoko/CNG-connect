import React from 'react';

export type TabType = 'map' | 'conversions' | 'community' | 'profile';

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
    <nav className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-[360px] bg-white/90 backdrop-blur-2xl rounded-full p-2 shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-white/80 flex items-center justify-around font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Map Tab */}
      <button
        onClick={() => onTabChange('map')}
        aria-label="Map"
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
          activeTab === 'map'
            ? 'bg-primary text-on-primary shadow-md shadow-primary/30 scale-105'
            : 'text-outline hover:text-on-surface hover:bg-surface-container/60'
        }`}
      >
        <span
          className={`material-symbols-outlined text-[22px] ${
            activeTab === 'map' ? 'material-symbols-fill' : ''
          }`}
        >
          map
        </span>
      </button>

      {/* Conversion Centers Tab */}
      <button
        onClick={() => onTabChange('conversions')}
        aria-label="CNG Kit Centers"
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
          activeTab === 'conversions'
            ? 'bg-primary text-on-primary shadow-md shadow-primary/30 scale-105'
            : 'text-outline hover:text-on-surface hover:bg-surface-container/60'
        }`}
      >
        <span
          className={`material-symbols-outlined text-[22px] ${
            activeTab === 'conversions' ? 'material-symbols-fill' : ''
          }`}
        >
          build_circle
        </span>
      </button>

      {/* Community Tab */}
      <button
        onClick={() => onTabChange('community')}
        aria-label="Community"
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 relative active:scale-90 ${
          activeTab === 'community'
            ? 'bg-primary text-on-primary shadow-md shadow-primary/30 scale-105'
            : 'text-outline hover:text-on-surface hover:bg-surface-container/60'
        }`}
      >
        <div className="relative flex items-center justify-center">
          <span
            className={`material-symbols-outlined text-[22px] ${
              activeTab === 'community' ? 'material-symbols-fill' : ''
            }`}
          >
            groups
          </span>
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-status-red text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white">
              {unreadNotifications}
            </span>
          )}
        </div>
      </button>

      {/* Profile Tab */}
      <button
        onClick={() => onTabChange('profile')}
        aria-label="Profile"
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 ${
          activeTab === 'profile'
            ? 'bg-primary text-on-primary shadow-md shadow-primary/30 scale-105'
            : 'text-outline hover:text-on-surface hover:bg-surface-container/60'
        }`}
      >
        <span
          className={`material-symbols-outlined text-[22px] ${
            activeTab === 'profile' ? 'material-symbols-fill' : ''
          }`}
        >
          person
        </span>
      </button>
    </nav>
  );
};
