'use client';

// Superadmin sidebar — matches OwnerApp dark sidebar style.

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';

const NAV_GROUPS = [
  {
    group: 'Platform',
    items: [
      { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
      { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
    ],
  },
  {
    group: 'Manage',
    items: [
      { href: '/admin/restaurants', label: 'Restaurants', icon: '🏪' },
      { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

export default function AdminSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line/12 bg-[var(--c-surface)] px-4 py-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line/12 text-ink"
          aria-label="Open menu"
        >
          ☰
        </button>
        <div className="flex items-center gap-2">
          <Logo size={30} />
          <p className="font-display text-[14px] font-extrabold text-ink">Super Admin</p>
        </div>
        <ThemeToggle />
      </header>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#141122] text-white transition-all duration-300 dark:bg-[#0d0a17] ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-[264px]'
        } ${mobileOpen ? 'w-[264px] translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Header */}
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3 overflow-hidden">
            <Logo size={38} />
            {(!collapsed || mobileOpen) && (
              <div className="min-w-0">
                <p className="truncate font-display text-[17px] font-black leading-tight tracking-tight text-white">
                  OrderKar
                </p>
                <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/50">
                  Platform Admin
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-white/70 transition-colors hover:text-white lg:flex"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/[0.1] hover:text-white lg:hidden"
          >
            ✕
          </button>
        </div>

        {/* Nav */}
        <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-3.5 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.group}>
              {(!collapsed || mobileOpen) && (
                <div className="mb-2 px-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/40">
                    {group.group}
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const active = isActive(item.href, (item as { exact?: boolean }).exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed && !mobileOpen ? item.label : undefined}
                      className={`flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[13.5px] transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-r from-brand to-brand-deep font-black text-white shadow-[0_4px_16px_rgba(109,40,217,0.35)]'
                          : 'font-medium text-white/65 hover:bg-white/[0.07] hover:text-white'
                      } ${collapsed && !mobileOpen ? 'justify-center px-0 py-3' : ''}`}
                    >
                      <span className={`shrink-0 text-[18px] ${active ? 'text-white' : ''}`}>
                        {item.icon}
                      </span>
                      {(!collapsed || mobileOpen) && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {active && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-white" />}
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 bg-white/[0.02] p-3">
          {(!collapsed || mobileOpen) ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 rounded-[16px] border border-white/10 bg-white/[0.05] p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-brand to-brand-deep text-base text-white shadow-sm">
                  👑
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-extrabold leading-tight text-white">{adminName}</p>
                  <p className="truncate text-[10.5px] font-medium text-white/50">Super Admin</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-1">
                <Link href="/" className="text-[12px] font-bold text-white/50 hover:text-white">
                  ← Back to Site
                </Link>
                <ThemeToggle />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white/[0.06] text-white/70"
                title={adminName}
              >
                👑
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
