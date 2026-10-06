'use client';

// Shared shell for staff pages: tenant brand, role nav, theme toggle, logout.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from './TenantProvider';
import type { Role } from '@/lib/types';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';

const ROLE_TABS: { href: string; label: string; roles: Role[] }[] = [
  { href: 'owner', label: 'Owner', roles: ['owner', 'super_admin'] },
  { href: 'manager', label: 'Manager', roles: ['owner', 'manager', 'super_admin'] },
  { href: 'kitchen', label: 'Kitchen', roles: ['owner', 'manager', 'kitchen', 'super_admin'] },
  { href: 'waiter', label: 'Waiter', roles: ['owner', 'manager', 'waiter', 'super_admin'] },
];

// Management sections — separate from the dashboard, for owner/manager.
const MANAGE_TABS: { href: string; label: string; icon: string; roles: Role[] }[] = [
  { href: 'menu', label: 'Menu', icon: '🍽️', roles: ['owner', 'manager', 'super_admin'] },
  { href: 'team', label: 'Team', icon: '👥', roles: ['owner', 'manager', 'super_admin'] },
];

export default function StaffShell({
  role,
  name,
  children,
}: {
  role: Role;
  name: string;
  children: React.ReactNode;
}) {
  const tenant = useTenant();
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const roleTabs = ROLE_TABS.filter((n) => n.roles.includes(role));
  // On the owner page, Manager/Kitchen/Waiter live as in-page previews
  // (👁️ Previews tab) — don't navigate away to their dedicated URLs.
  const onOwnerPage = pathname.endsWith('/owner');
  const visibleRoleTabs = onOwnerPage ? roleTabs.filter((n) => n.href === 'owner') : roleTabs;
  const manageTabs = MANAGE_TABS.filter((n) => n.roles.includes(role));

  const renderTab = (t: { href: string; label: string; icon?: string }) => {
    const href = `/r/${tenant.slug}/${t.href}`;
    const active = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        key={t.href}
        href={href}
        prefetch
        className={`whitespace-nowrap rounded-[10px] px-3.5 py-1.5 text-[13.5px] font-bold transition-all ${
          active ? 'btn-3d text-white' : 'text-muted hover:text-ink'
        }`}
      >
        {t.icon ? `${t.icon} ` : ''}{t.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-[var(--c-surface)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-extrabold text-ink">{tenant.name}</p>
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted">
                {name} · {role.replace('_', ' ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={logout}
              className="rounded-btn border border-line bg-[var(--c-surface-solid)] px-3.5 py-2 text-[13px] font-bold text-muted hover:text-ink"
            >
              Log out
            </button>
          </div>
        </div>
        {(visibleRoleTabs.length > 1 || manageTabs.length > 0) && (
          <nav className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
            {visibleRoleTabs.map(renderTab)}
            {visibleRoleTabs.length > 1 && manageTabs.length > 0 && (
              <span className="mx-1.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
            )}
            {manageTabs.map(renderTab)}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
