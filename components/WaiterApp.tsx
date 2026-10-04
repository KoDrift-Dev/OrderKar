'use client';

// Waiter app: table grid with live status, tableside ordering, and the
// waiter's own orders feed.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DiningTable, OrderWithItems } from '@/lib/types';
import { fmtPKR, fmtAgo } from '@/lib/format';
import MenuOrder from './MenuOrder';
import StatusPill from './StatusPill';
import { Card, Empty, PageHeader, Tabs } from './ui';

type View = 'tables' | 'myorders';

export default function WaiterApp({ restaurantId, waiterId }: { restaurantId: string; waiterId: string }) {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [view, setView] = useState<View>('tables');
  const [activeTable, setActiveTable] = useState<DiningTable | null>(null);
  const [placedTick, setPlacedTick] = useState(0);

  const load = async () => {
    const supabase = createClient();
    const [{ data: t }, { data: o }] = await Promise.all([
      supabase.from('tables').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('table_number'),
      supabase
        .from('orders')
        .select('*, order_items(*), tables(table_number)')
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false }),
    ]);
    if (t) setTables(t as DiningTable[]);
    if (o) setOrders(o as OrderWithItems[]);
  };

  useEffect(() => {
    load();
    const supabase = createClient();
    const ch = supabase
      .channel(`waiter-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, load)
      .subscribe();
    const t = window.setInterval(load, 8000);
    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, placedTick]);

  const tableStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) {
      if (o.table_id) m.set(o.table_id, (m.get(o.table_id) ?? 0) + 1);
    }
    return m;
  }, [orders]);

  const mine = orders.filter((o) => o.waiter_id === waiterId);

  return (
    <div className="pb-24">
      <PageHeader title="Waiter" sub="Tables, ordering and your live orders" />
      <div className="mb-5">
        <Tabs<View>
          active={view}
          onChange={setView}
          tabs={[
            { key: 'tables', label: `Tables (${tables.length})` },
            { key: 'myorders', label: `My orders (${mine.length})` },
          ]}
        />
      </div>

      {view === 'tables' && !activeTable && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((t) => {
            const n = tableStatus.get(t.id) ?? 0;
            return (
              <button key={t.id} onClick={() => setActiveTable(t)} className="text-left">
                <Card className="p-5 transition-transform hover:-translate-y-1">
                  <p className="font-display text-2xl font-extrabold text-ink">T{t.table_number}</p>
                  <p className="mt-0.5 text-[12.5px] font-semibold text-muted">
                    {t.floor_section} · {t.capacity} seats
                  </p>
                  <div className="mt-3">
                    {n > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/15 px-3 py-1 text-[12.5px] font-bold text-amber">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                        {n} active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-ok/10 px-3 py-1 text-[12.5px] font-bold text-ok">
                        Free
                      </span>
                    )}
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {view === 'tables' && activeTable && (
        <div>
          <button onClick={() => setActiveTable(null)} className="mb-4 text-sm font-bold text-brand hover:underline">
            ← Back to tables
          </button>
          <h2 className="mb-4 font-display text-xl font-extrabold text-ink">
            New order · Table {activeTable.table_number}
          </h2>
          <MenuOrder
            restaurantId={restaurantId}
            table={activeTable}
            waiterId={waiterId}
            onPlaced={() => {
              setPlacedTick((x) => x + 1);
              setActiveTable(null);
              setView('myorders');
            }}
          />
        </div>
      )}

      {view === 'myorders' && (
        <div className="space-y-3">
          {mine.length === 0 ? (
            <Empty title="No active orders" sub="Pick a table to start an order." />
          ) : (
            mine.map((o) => (
              <Card key={o.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-mono text-lg font-bold text-ink">
                    #{o.order_number} · {o.tables ? `Table ${o.tables.table_number}` : o.order_type}
                  </p>
                  <p className="text-[12.5px] text-muted">
                    {o.order_items.reduce((s, i) => s + i.quantity, 0)} items · {fmtPKR(o.total_amount)} · {fmtAgo(o.created_at)}
                  </p>
                </div>
                <StatusPill status={o.status} />
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
