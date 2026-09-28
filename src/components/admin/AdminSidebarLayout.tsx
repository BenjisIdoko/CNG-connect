import React, { useState } from 'react';
import { Icon } from '../common/Icon';

export interface AdminNavItem {
  key: string;
  label: string;
  icon: string;
  /** Small count badge, e.g. "3 need review" — omitted when 0/undefined. */
  badge?: number;
}

interface AdminSidebarLayoutProps {
  brand: string;
  navItems: AdminNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  userEmail: string;
  onSignOut: () => void;
  onExit: () => void;
  children: React.ReactNode;
}

/**
 * The one dashboard shell shared by every admin/manager screen: a fixed sidebar on
 * desktop (a slide-over drawer on phones) plus a main content area. Which nav items
 * are passed in — and therefore what a given signed-in visitor can reach — is decided
 * by the caller (AdminScreen), based on their role.
 */
export const AdminSidebarLayout: React.FC<AdminSidebarLayoutProps> = ({
  brand,
  navItems,
  activeKey,
  onSelect,
  userEmail,
  onSignOut,
  onExit,
  children,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeItem = navItems.find((n) => n.key === activeKey);

  const navList = (onNavigate: () => void) => (
    <nav className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-0.5">
      {navItems.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            onClick={() => {
              onSelect(item.key);
              onNavigate();
            }}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
              active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon name={item.icon} size={20} className="shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
            {!!item.badge && (
              <span className="shrink-0 rounded-full bg-status-orange px-1.5 py-0.5 text-[0.6875rem] font-bold text-white">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const sidebarFooter = (
    <div className="shrink-0 border-t border-white/10 px-4 py-3">
      <p className="truncate text-xs text-white/50">{userEmail}</p>
      <div className="mt-2 flex gap-2">
        <button onClick={onSignOut} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
          Sign out
        </button>
        <button onClick={onExit} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
          Exit
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex bg-surface-container-low">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-deep-teal">
        <div className="shrink-0 px-4 pt-5 pb-3">
          <span className="font-headline font-extrabold text-white text-body-lg tracking-tight">{brand}</span>
        </div>
        {navList(() => {})}
        {sidebarFooter}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-[210] flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-72 max-w-[80vw] flex flex-col bg-deep-teal shadow-xl">
            <div className="shrink-0 flex items-center justify-between px-4 pt-safe pt-5 pb-3">
              <span className="font-headline font-extrabold text-white text-body-lg tracking-tight">{brand}</span>
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="text-white/70 hover:text-white">
                <Icon name="close" size={22} />
              </button>
            </div>
            {navList(() => setDrawerOpen(false))}
            {sidebarFooter}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 flex items-center gap-3 border-b border-slate-200 bg-white px-4 pt-safe h-14">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="md:hidden -ml-1 p-2 text-slate-700 hover:bg-slate-100 rounded-full"
          >
            <Icon name="menu" size={22} />
          </button>
          <h1 className="font-headline font-extrabold text-heading text-slate-900 truncate">{activeItem?.label ?? brand}</h1>
        </header>
        {/* Each panel decides its own scrolling — the plain content panels scroll the
            whole page, while the Stations split-pane editor manages its own regions. */}
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
    </div>
  );
};
