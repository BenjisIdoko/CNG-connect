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
    <nav className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-[370px] bg-white/95 backdrop-blur-2xl rounded-full p-1.5 px-3 shadow-[0_12px_36px_rgba(0,0,0,0.15)] border border-slate-200/80 flex items-center justify-between font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Map Tab */}
      <button
        onClick={() => onTabChange('map')}
        aria-label="Map"
        className={`flex-1 py-1 px-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-95 ${
          activeTab === 'map'
            ? 'bg-primary text-on-primary shadow-md shadow-primary/30'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
        }`}
      >
        <span
          className={`material-symbols-outlined text-[20px] ${
            activeTab === 'map' ? 'material-symbols-fill' : ''
          }`}
        >
          ev_station
        </span>
        <span className="text-[10px] font-extrabold tracking-tight leading-none">Map</span>
      </button>

      {/* Conversion Centers Tab */}
      <button
        onClick={() => onTabChange('conversions')}
        aria-label="CNG Kit Centers"
        className={`flex-1 py-1 px-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-95 ${
          activeTab === 'conversions'
            ? 'bg-primary text-on-primary shadow-md shadow-primary/30'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
        }`}
      >
        <span
          className={`material-symbols-outlined text-[20px] ${
            activeTab === 'conversions' ? 'material-symbols-fill' : ''
          }`}
        >
          propane_tank
        </span>
        <span className="text-[10px] font-extrabold tracking-tight leading-none">Kits</span>
      </button>

      {/* Community Tab */}
      <button
        onClick={() => onTabChange('community')}
        aria-label="Community"
        className={`flex-1 py-1 px-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all duration-200 relative active:scale-95 ${
          activeTab === 'community'
            ? 'bg-primary text-on-primary shadow-md shadow-primary/30'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
        }`}
      >
        <div className="relative flex items-center justify-center">
          <span
            className={`material-symbols-outlined text-[20px] ${
              activeTab === 'community' ? 'material-symbols-fill' : ''
            }`}
          >
            groups
          </span>
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-2 w-4 h-4 bg-status-red text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
              {unreadNotifications}
            </span>
          )}
        </div>
        <span className="text-[10px] font-extrabold tracking-tight leading-none">Community</span>
      </button>

      {/* Profile Tab */}
      <button
        onClick={() => onTabChange('profile')}
        aria-label="Profile"
        className={`flex-1 py-1 px-1.5 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-95 ${
          activeTab === 'profile'
            ? 'bg-primary text-on-primary shadow-md shadow-primary/30'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
        }`}
      >
        <span
          className={`material-symbols-outlined text-[20px] ${
            activeTab === 'profile' ? 'material-symbols-fill' : ''
          }`}
        >
          person
        </span>
        <span className="text-[10px] font-extrabold tracking-tight leading-none">Profile</span>
      </button>
    </nav>
  );
};
