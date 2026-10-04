'use client';

// Restaurant home — what a guest sees at /r/[slug]. Links into table
// ordering (via QR normally) and the public feedback page.

import Link from 'next/link';
import { useTenant } from '@/components/TenantProvider';
import { Btn, Card } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';
import Logo from '@/components/Logo';

export default function RestaurantHome() {
  const tenant = useTenant();
  const theme = (tenant.theme_config ?? {}) as { address?: string; phone?: string };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <Logo size={40} />
          <span className="font-display text-xl font-extrabold text-ink">OrderKar</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <div className="pt-10 text-center">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-brand">Powered by OrderKar</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-6xl">
            {tenant.name}
          </h1>
          {(theme.address || theme.phone) && (
            <p className="mt-3 text-muted">
              {[theme.address, theme.phone].filter(Boolean).join(' · ')}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={`/r/${tenant.slug}/table/1`}>
              <Btn size="lg">View menu & order</Btn>
            </Link>
            <Link href={`/r/${tenant.slug}/feedback`}>
              <Btn size="lg" variant="secondary">Leave a review</Btn>
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {[
            { icon: '📱', t: 'Scan the QR', d: 'Every table has its own QR code. Scan it to open this menu for your table.' },
            { icon: '🍽️', t: 'Order from your phone', d: 'Browse the full menu, customise, and send your order straight to the kitchen.' },
            { icon: '⚡', t: 'Track it live', d: 'Watch your order go from received to preparing to ready — no flagging down waiters.' },
          ].map((s) => (
            <Card key={s.t} className="p-6">
              <div className="glass flex h-12 w-12 items-center justify-center !rounded-[14px] text-2xl">{s.icon}</div>
              <h3 className="mt-4 font-display text-lg font-extrabold text-ink">{s.t}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.d}</p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
