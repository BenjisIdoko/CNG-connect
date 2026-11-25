import React, { useState } from 'react';
import { ArrowUpRight, LogOut, Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminRoot } from './AdminRoot';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../ui/sheet';
import { cn } from '../../lib/utils';

export interface AdminNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Count of things waiting for the admin; shown as a chip when above 0. */
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
  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-adm-line bg-adm-card px-2.5 py-1.5 max-md:min-h-11 text-xs font-semibold text-adm-ink transition-colors hover:bg-adm-muted focus-visible:ring-2 focus-visible:ring-adm-note outline-none';

/**
 * The one shell shared by the admin dashboard: a crisp white Sypher-inspired sidebar
 * on laptops (a drawer on phones) over a soft sage-grey work canvas.
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
  const totalBadges = navItems.reduce((sum, item) => sum + (item.badge || 0), 0);

  const navList = (onNavigate: () => void) => (
    <nav aria-label="Dashboard sections" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-adm-mute-text">
        Workspace
      </p>
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
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-adm-note',
              active
                ? 'bg-adm-ink text-white shadow-[0_1px_3px_rgba(17,24,20,0.12)]'
                : 'text-adm-mute-text hover:bg-adm-muted hover:text-adm-ink',
            )}
          >
            <Icon
              className={cn(
                'size-4 shrink-0 transition-colors',
                active ? 'text-adm-foil-hover' : 'text-adm-mute-text group-hover:text-adm-ink',
              )}
              aria-hidden="true"
            />
            <span className="flex-1 truncate">{item.label}</span>
            {!!item.badge && (
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                  active
                    ? 'bg-adm-note text-white'
                    : 'bg-adm-note-text text-adm-note',
                )}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const brandBlock = (
    <div className="shrink-0 border-b border-adm-line px-4 py-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-adm-ink font-geist text-xs font-extrabold tracking-tight text-white shadow-2xs"
        >
          C
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate font-geist text-sm font-bold tracking-tight text-adm-ink">{brand}</span>
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-adm-mute-text">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-adm-emerald" />
            Admin Operations
          </span>
        </div>
      </div>
    </div>
  );

  const footer = (
    <div className="shrink-0 border-t border-adm-line bg-adm-muted/40 px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-adm-note-text text-[11px] font-bold uppercase text-adm-note"
        >
          {(userEmail || 'A').slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-adm-ink" title={userEmail}>
            {userEmail}
          </p>
          <p className="text-[11px] text-adm-mute-text">Administrator</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onSignOut} className={sidebarButton}>
          <LogOut className="size-3.5" aria-hidden="true" />
          Sign out
        </button>
        <button type="button" onClick={onExit} className={sidebarButton}>
          Back to app
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return (
    <AdminRoot className="fixed inset-0 z-[200] flex min-h-0">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-adm-line bg-adm-card md:flex">
        {brandBlock}
        {navList(() => undefined)}
        {footer}
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="border-r border-adm-line bg-adm-card text-adm-ink">
          <SheetTitle className="sr-only">{brand} menu</SheetTitle>
          <SheetDescription>Choose a dashboard section.</SheetDescription>
          {brandBlock}
          {navList(() => setDrawerOpen(false))}
          {footer}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-adm-line bg-adm-card px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="-ml-1 rounded-md p-2 text-adm-ink outline-none hover:bg-adm-muted focus-visible:ring-2 focus-visible:ring-adm-note md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <h1 className="truncate font-geist text-lg font-bold tracking-tight text-balance text-adm-ink">
              {title ?? activeItem?.label ?? brand}
            </h1>
          </div>

          <div className="hidden items-center gap-3 text-xs text-adm-mute-text sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-adm-line bg-adm-muted/60 px-2.5 py-1 font-medium text-adm-ink">
              <span
                aria-hidden="true"
                className={cn('size-2 rounded-full', totalBadges > 0 ? 'bg-adm-warn' : 'bg-adm-emerald')}
              />
              {totalBadges > 0 ? `${totalBadges} pending review` : 'Queue clear'}
            </span>
          </div>
        </header>
        {/* Each panel decides its own scrolling: the plain content panels scroll the whole
            area, while the Stations split-pane editor manages its own regions. */}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </AdminRoot>
  );
};
