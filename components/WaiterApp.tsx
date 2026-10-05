'use client';

// Waiter app: table grid with live status, tableside ordering, and the
// waiter's own orders feed.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DiningTable, OrderWithItems } from '@/lib/types';
import { fmtPKR, fmtAgo } from '@/lib/format';
import MenuOrder from './MenuOrder';
import TableCard, { tableState } from './TableCard';
import StatusPill from './StatusPill';
import { Card, Empty, PageHeader, Tabs } from './ui';

type View = 'tables' | 'myorders';

export default function WaiterApp({ restaurantId, waiterId }: { restaurantId: string; waiterId: string }) {
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [view, setView] = useState<View>('tables');
  const [activeTable, setActiveTable] = useState<DiningTable | null>(null);
  const [placedTick, setPlacedTick] = useState(0);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState('cash');

  const collectPayment = async (orderId: string) => {
    const supabase = createClient();
    await supabase
      .from('orders')
      .update({ status: 'completed', payment_status: 'paid', payment_method: payMethod })
      .eq('id', orderId);
    setPayFor(null);
    load();
  };

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
          {tables.map((t) => (
            <TableCard key={t.id} table={t} state={tableState(t.id, orders)} onClick={() => setActiveTable(t)} />
          ))}
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
              <Card key={o.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-bold text-ink">
                      #{o.order_number} · {o.tables ? `Table ${o.tables.table_number}` : o.order_type}
                    </p>
                    <p className="text-[12.5px] text-muted">
                      {o.order_items.reduce((s, i) => s + i.quantity, 0)} items · {fmtPKR(o.total_amount)} · {fmtAgo(o.created_at)}
                    </p>
                  </div>
                  <StatusPill status={o.status} />
                </div>
                {o.status === 'ready' && o.payment_status !== 'paid' &&
                  (payFor === o.id ? (
                    <div className="mt-3 flex gap-2">
                      <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="min-w-0 flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-3 py-2.5 text-[13px] font-bold text-ink">
                        <option value="cash">💵 Cash</option>
                        <option value="card">💳 Card</option>
                        <option value="jazzcash">📱 JazzCash</option>
                        <option value="easypaisa">📱 EasyPaisa</option>
                      </select>
                      <button onClick={() => collectPayment(o.id)} className="btn-3d shrink-0 rounded-btn px-4 py-2.5 text-[13px] font-extrabold text-white">
                        Paid ✓
                      </button>
                      <button onClick={() => setPayFor(null)} className="shrink-0 rounded-btn border border-line px-3 py-2.5 text-[13px] font-bold text-muted">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setPayFor(o.id); setPayMethod('cash'); }} className="mt-3 w-full rounded-btn bg-ok/10 py-2.5 text-[13.5px] font-extrabold text-ok hover:bg-ok/20">
                      Collect payment · {fmtPKR(o.total_amount)}
                    </button>
                  ))}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
