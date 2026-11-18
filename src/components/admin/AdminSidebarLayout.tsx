import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminRoot } from './AdminRoot';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { cn } from '../../lib/utils';

export interface AdminNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Count of things waiting for the admin; shown as a gold chip when above 0. */
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
  /** Heading of the page area; defaults to the active nav item's label. */
  title?: string;
  children: React.ReactNode;
}

const sidebarButton =
  'rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-adm-foil outline-none';

/**
 * The one shell shared by the admin dashboard and the station manager page: a deep-green sidebar
 * on laptops (a drawer on phones) and a celadon work area. Which nav items appear is decided by the
 * caller; this component only draws them.
 */
export const AdminSidebarLayout: React.FC<AdminSidebarLayoutProps> = ({
  brand,
  navItems,
  activeKey,
  onSelect,
  userEmail,
  onSignOut,
  onExit,
  title,
  children,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeItem = navItems.find((n) => n.key === activeKey);

  const navList = (onNavigate: () => void) => (
    <nav aria-label="Dashboard sections" className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
      {navItems.map((item) => {
        const active = item.key === activeKey;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              onSelect(item.key);
              onNavigate();
            }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-adm-foil',
              active ? 'bg-adm-note-2 text-white' : 'text-adm-note-text hover:bg-adm-note-2/60 hover:text-white',
            )}
          >
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">{item.label}</span>
            {!!item.badge && (
              <span className="shrink-0 rounded-md bg-adm-note-text px-1.5 py-0.5 text-xs font-bold text-adm-note tabular-nums">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const brandBlock = (
    <div className="shrink-0 border-b border-white/15 px-5 pt-5 pb-4">
      <span className="font-geist text-lg font-bold tracking-tight text-white">{brand}</span>
    </div>
  );

  const footer = (
    <div className="shrink-0 border-t border-white/15 px-5 py-4">
      <p className="truncate text-xs text-adm-note-text" title={userEmail}>
        {userEmail}
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onSignOut} className={sidebarButton}>
          Sign out
        </button>
        <button type="button" onClick={onExit} className={sidebarButton}>
          Back to app
        </button>
      </div>
    </div>
  );

  return (
    <AdminRoot className="fixed inset-0 z-[200] flex min-h-0">
      <aside className="hidden w-60 shrink-0 flex-col bg-adm-note md:flex">
        {brandBlock}
        {navList(() => undefined)}
        {footer}
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="bg-adm-note text-white">
          <SheetTitle className="sr-only">{brand} menu</SheetTitle>
          <SheetDescription>Choose a dashboard section.</SheetDescription>
          {brandBlock}
          {navList(() => setDrawerOpen(false))}
          {footer}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-adm-line bg-adm-card px-4 md:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="-ml-1 rounded-md p-2 text-adm-ink outline-none hover:bg-adm-muted focus-visible:ring-2 focus-visible:ring-adm-note md:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <h1 className="truncate font-geist text-xl font-bold text-balance text-adm-ink">
            {title ?? activeItem?.label ?? brand}
          </h1>
        </header>
        {/* Each panel decides its own scrolling: the plain content panels scroll the whole
            area, while the Stations split-pane editor manages its own regions. */}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </AdminRoot>
  );
};
