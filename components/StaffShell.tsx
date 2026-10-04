'use client';

// Shared shell for staff pages: tenant brand, role nav, theme toggle, logout.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useTenant } from './TenantProvider';
import type { Role } from '@/lib/types';
import ThemeToggle from './ThemeToggle';

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: 'owner', label: 'Owner', roles: ['owner', 'super_admin'] },
  { href: 'manager', label: 'Manager', roles: ['owner', 'manager', 'super_admin'] },
  { href: 'kitchen', label: 'Kitchen', roles: ['owner', 'manager', 'kitchen', 'super_admin'] },
  { href: 'waiter', label: 'Waiter', roles: ['owner', 'manager', 'waiter', 'super_admin'] },
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

  const tabs = NAV.filter((n) => n.roles.includes(role));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-[var(--c-surface)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="btn-3d flex h-9 w-9 items-center justify-center rounded-[11px] font-display text-lg font-extrabold text-white">
              O
            </div>
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
        {tabs.length > 1 && (
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
            {tabs.map((t) => {
              const href = `/r/${tenant.slug}/${t.href}`;
              const active = pathname === href;
              return (
                <Link
                  key={t.href}
                  href={href}
                  className={`whitespace-nowrap rounded-[10px] px-3.5 py-1.5 text-[13.5px] font-bold transition-all ${
                    active ? 'btn-3d text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
