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
}

export default function TablePage({ params }: { params: { slug: string; id: string } }) {
  const tenant = useTenant();
  const tableNum = parseInt(params.id, 10);
  const [table, setTable] = useState<DiningTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [placed, setPlaced] = useState<PlacedOrder[]>([]);
  const [name, setName] = useState('');

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
    setPlaced((p) => [...p, { id: orderId, number: data?.order_number ?? 0 }]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-40 border-b border-line bg-[var(--c-surface)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href={`/r/${tenant.slug}`} className="flex items-center gap-2.5">
            <Logo size={36} />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-extrabold text-ink">{tenant.name}</p>
              <p className="text-[11.5px] font-bold text-muted">
                {Number.isFinite(tableNum) ? `Table ${tableNum}` : 'Menu'}
              </p>
            </div>
          </Link>
          <ThemeToggle />
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
                  <OrderTracker key={o.id} orderId={o.id} orderNumber={o.number} />
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
