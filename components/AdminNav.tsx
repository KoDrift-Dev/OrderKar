'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/admin/restaurants', label: 'Restaurants', icon: '🏪' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📈' },
  { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

export default function AdminNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  if (mobile) {
    return (
      <nav className="flex gap-1 overflow-x-auto">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`whitespace-nowrap rounded-[10px] px-3 py-1.5 text-[13px] font-bold transition-all ${
              isActive(n.href, n.exact) ? 'btn-3d text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {n.icon} {n.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1 p-4">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`flex items-center gap-3 rounded-[12px] px-4 py-2.5 text-[14px] font-bold transition-all ${
            isActive(n.href, n.exact)
              ? 'btn-3d text-white'
              : 'text-muted hover:bg-line/8 hover:text-ink'
          }`}
        >
          <span className="text-[18px]">{n.icon}</span>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
