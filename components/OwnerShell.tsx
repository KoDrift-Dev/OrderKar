'use client';

// Owner console chrome: dark fixed sidebar (desktop), slide-in drawer
// (mobile), sticky topbar, full-width content. Replaces the old centered
// StaffShell + top tab strip for the owner page.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

export type OwnerTabKey =
  | 'dashboard'
  | 'sales'
  | 'operations'
  | 'previews'
  | 'menu'
  | 'team'
  | 'staff'
  | 'customers'
  | 'tables'
  | 'reports'
  | 'settings';

export const TAB_TITLES: Record<OwnerTabKey, string> = {
  dashboard: 'Dashboard',
  sales: 'Sales analytics',
  operations: 'Operations',
  previews: 'Role previews',
  menu: 'Menu',
  team: 'Team',
  staff: 'Staff',
  customers: 'Customers',
  tables: 'Tables',
  reports: 'Reports',
  settings: 'Settings',
};

const NAV_GROUPS: { label: string; items: { key: OwnerTabKey; label: string; icon: string }[] }[] = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: '📊' },
      { key: 'sales', label: 'Sales', icon: '💰' },
      { key: 'operations', label: 'Operations', icon: '🖥️' },
      { key: 'previews', label: 'Previews', icon: '👁️' },
      { key: 'reports', label: 'Reports', icon: '📑' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { key: 'menu', label: 'Menu', icon: '🍽️' },
      { key: 'team', label: 'Team', icon: '👥' },
      { key: 'staff', label: 'Staff', icon: '🏅' },
      { key: 'customers', label: 'Customers', icon: '⭐' },
      { key: 'tables', label: 'Tables', icon: '🪑' },
    ],
  },
  {
    label: 'System',
    items: [{ key: 'settings', label: 'Settings', icon: '⚙️' }],
  },
];

function NavList({
  tab,
  onGo,
}: {
  tab: OwnerTabKey;
  onGo: (k: OwnerTabKey) => void;
}) {
  return (
    <div className="space-y-6">
      {NAV_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-2 px-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">
            {g.label}
          </p>
          <div className="space-y-1">
            {g.items.map((n) => {
              const active = tab === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => onGo(n.key)}
                  className={`group flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left text-[13.5px] font-semibold transition-all ${
                    active ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[15px] transition-all ${
                      active
                        ? 'bg-gradient-to-br from-[#7c3aed] to-[#0d9488] shadow-[0_4px_14px_rgba(124,58,237,0.35)]'
                        : 'bg-white/[0.07] group-hover:bg-white/[0.12]'
                    }`}
                  >
                    {n.icon}
                  </span>
                  {n.label}
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OwnerShell({
  tab,
  setTab,
  subtitle,
  actions,
  restaurantName,
  userName,
  userRole,
  children,
}: {
  tab: OwnerTabKey;
  setTab: (t: OwnerTabKey) => void;
  subtitle: string;
  actions?: React.ReactNode;
  restaurantName: string;
  userName: string;
  userRole: string;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const router = useRouter();

  const logout = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const go = (k: OwnerTabKey) => {
    setTab(k);
    setNavOpen(false);
  };

  return (
    <div className="min-h-screen lg:flex">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden w-[272px] shrink-0 lg:block">
        <div className="fixed inset-y-0 flex w-[272px] flex-col overflow-hidden bg-[#181233] text-white">
          <div className="pointer-events-none absolute -top-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#7c3aed]/25 blur-[110px]" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-56 w-56 rounded-full bg-[#0d9488]/15 blur-[100px]" />

          <div className="relative flex items-center gap-3 px-5 pb-6 pt-6">
            <Logo size={42} />
            <div className="min-w-0">
              <p className="truncate font-display text-[16.5px] font-extrabold leading-tight">{restaurantName}</p>
              <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/45">
                Owner console
              </p>
            </div>
          </div>

          <nav className="relative flex-1 overflow-y-auto px-3.5 pb-4">
            <NavList tab={tab} onGo={go} />
          </nav>

          <div className="relative border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#0d9488] font-display text-[15px] font-extrabold">
                {(userName || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold leading-tight">{userName}</p>
                <p className="text-[11px] font-semibold capitalize text-white/50">{userRole.replace('_', ' ')}</p>
              </div>
              <button
                onClick={logout}
                title="Log out"
                aria-label="Log out"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.07] text-[15px] text-white/70 transition-all hover:bg-white/[0.14] hover:text-white"
              >
                ⎋
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────── */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-line bg-[var(--c-bg)]/85 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:px-6 lg:px-8">
            <button
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              className="glass flex h-10 w-10 shrink-0 items-center justify-center !rounded-[12px] text-[18px] text-ink lg:hidden"
            >
              ☰
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[20px] font-extrabold leading-tight text-ink sm:text-[22px]">
                {TAB_TITLES[tab]}
              </h1>
              <p className="truncate text-[12.5px] text-muted">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {actions}
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      {/* ── Mobile drawer ───────────────────────────────── */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => setNavOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-[300px] max-w-[86vw] animate-slide-in-left flex-col overflow-hidden bg-[#181233] text-white shadow-2xl">
            <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[#7c3aed]/25 blur-[100px]" />
            <div className="relative flex items-center justify-between px-5 pb-5 pt-5">
              <div className="flex min-w-0 items-center gap-3">
                <Logo size={38} />
                <div className="min-w-0">
                  <p className="truncate font-display text-[15px] font-extrabold leading-tight">{restaurantName}</p>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/45">Owner console</p>
                </div>
              </div>
              <button
                onClick={() => setNavOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[14px] text-white/80"
              >
                ✕
              </button>
            </div>
            <nav className="relative flex-1 overflow-y-auto px-3.5 pb-4">
              <NavList tab={tab} onGo={go} />
            </nav>
            <div className="relative border-t border-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#0d9488] font-display text-[15px] font-extrabold">
                  {(userName || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold leading-tight">{userName}</p>
                  <p className="text-[11px] font-semibold capitalize text-white/50">{userRole.replace('_', ' ')}</p>
                </div>
                <button
                  onClick={logout}
                  className="shrink-0 rounded-[10px] bg-white/[0.07] px-3.5 py-2 text-[12.5px] font-bold text-white/80 hover:bg-white/[0.14] hover:text-white"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
