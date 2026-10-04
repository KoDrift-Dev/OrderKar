'use client';

// Customer QR ordering: /r/[slug]/table/[n]. Public (no login). Menu +
// cart + live order tracker, all through anon-safe RLS policies.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTenant } from '@/components/TenantProvider';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { DiningTable } from '@/lib/types';
import MenuOrder from '@/components/MenuOrder';
import OrderTracker from '@/components/OrderTracker';
import ThemeToggle from '@/components/ThemeToggle';
import { Card, Empty } from '@/components/ui';
import Logo from '@/components/Logo';

interface PlacedOrder {
  id: string;
  number: number;
  at: number;
}

const PLACED_TTL_MS = 12 * 3600 * 1000; // keep today's orders across refreshes

// Animated table badge — a little cloche-on-table illustration with steam
// and the table number, instead of plain "Table N" text.
function TableBadge({ n }: { n: number }) {
  return (
    <div className="relative shrink-0" title={`Table ${n}`}>
      <svg viewBox="0 0 64 64" className="animate-float-y h-11 w-11" aria-hidden="true">
        <defs>
          <linearGradient id="ok-tbl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#6d28d9" />
          </linearGradient>
        </defs>
        <ellipse cx="32" cy="55" rx="17" ry="3.5" fill="#6d28d9" opacity="0.22" />
        <rect x="30" y="43" width="4" height="10" rx="2" fill="url(#ok-tbl)" />
        <ellipse cx="32" cy="54" rx="11" ry="2.6" fill="url(#ok-tbl)" />
        <ellipse cx="32" cy="42" rx="23" ry="6.5" fill="#7c3aed" />
        <ellipse cx="32" cy="40" rx="23" ry="6.5" fill="#a78bfa" />
        <path d="M15 38 A17 15 0 0 1 49 38 Z" fill="url(#ok-tbl)" />
        <circle cx="32" cy="21.5" r="2.8" fill="#c4b5fd" />
        <path d="M25 15 q2.5 -3 0 -6 q-2.5 -3 0 -6" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" className="animate-steam" />
        <path d="M33 16 q2.5 -3 0 -6 q-2.5 -3 0 -6" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" className="animate-steam" style={{ animationDelay: '0.8s' }} />
        <path d="M41 15 q2.5 -3 0 -6 q-2.5 -3 0 -6" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" className="animate-steam" style={{ animationDelay: '1.6s' }} />
      </svg>
      <span className="btn-3d absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1 font-mono text-[12px] font-bold text-white">
        {n}
      </span>
    </div>
  );
}

export default function TablePage({ params }: { params: { slug: string; id: string } }) {
  const tenant = useTenant();
  const tableNum = parseInt(params.id, 10);
  const [table, setTable] = useState<DiningTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [placed, setPlaced] = useState<PlacedOrder[]>([]);
  const [name, setName] = useState('');

  const placedKey = `orderkar:placed:${tenant.id}:${tableNum}`;

  // Restore this table's orders after a refresh (kept 12h).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(placedKey);
      if (!raw) return;
      const arr = JSON.parse(raw) as PlacedOrder[];
      const fresh = arr.filter((o) => o && o.id && Date.now() - (o.at || 0) < PLACED_TTL_MS);
      if (fresh.length > 0) setPlaced(fresh);
    } catch {
      /* ignore */
    }
  }, [placedKey]);

  // Persist every change so a refresh never loses the tracker.
  useEffect(() => {
    try {
      window.localStorage.setItem(placedKey, JSON.stringify(placed));
    } catch {
      /* ignore */
    }
  }, [placedKey, placed]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !Number.isFinite(tableNum)) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', tenant.id)
        .eq('table_number', tableNum)
        .eq('is_active', true)
        .maybeSingle();
      setTable((data as DiningTable | null) ?? null);
      setLoading(false);
    })();
  }, [tenant.id, tableNum]);

  const onPlaced = async (orderId: string) => {
    const supabase = createClient();
    const { data } = await supabase.from('orders').select('order_number').eq('id', orderId).maybeSingle();
    setPlaced((p) => [...p, { id: orderId, number: data?.order_number ?? 0, at: Date.now() }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const dismiss = (id: string) => setPlaced((p) => p.filter((o) => o.id !== id));

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 border-b border-line bg-[var(--c-surface)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href={`/r/${tenant.slug}`} className="flex items-center gap-2.5">
            <Logo size={36} />
            <p className="font-display text-[15px] font-extrabold text-ink">{tenant.name}</p>
          </Link>
          <div className="flex items-center gap-2.5">
            {Number.isFinite(tableNum) && <TableBadge n={tableNum} />}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        {loading ? (
          <Empty title="Loading menu…" />
        ) : !table ? (
          <Empty title="Table not found" sub="This QR code may be for a table that no longer exists. Ask your waiter for help." />
        ) : (
          <>
            {placed.length > 0 && (
              <div className="mb-6 space-y-3">
                {placed.map((o) => (
                  <OrderTracker
                    key={o.id}
                    orderId={o.id}
                    orderNumber={o.number}
                    tableNumber={tableNum}
                    onDismiss={() => dismiss(o.id)}
                  />
                ))}
              </div>
            )}
            <Card className="mb-5 p-4">
              <label className="mb-1.5 block text-[13px] font-bold text-body">
                Your name <span className="font-semibold text-muted">(optional — helps the waiter find you)</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ahmed"
                className="input-neu max-w-xs px-4 py-2.5 text-[15px] text-ink placeholder:text-muted"
              />
            </Card>
            <MenuOrder restaurantId={tenant.id} table={table} customerName={name} onPlaced={onPlaced} />
          </>
        )}
      </main>
    </div>
  );
}
