'use client';

// Owner's READ-ONLY live kitchen monitor. Same realtime feed as the Kitchen
// Display, but no status buttons — the owner watches, the kitchen acts.
// Kanban (columns) ↔ List (table) toggle.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus, OrderWithItems } from '@/lib/types';
import { fmtElapsed, fmtPKR } from '@/lib/format';
import StatusPill from './StatusPill';
import { Card, Empty, SectionHead, Tabs } from './ui';
import { useT, type TKey } from '@/lib/i18n';

type View = 'kanban' | 'list';

const COLUMNS: { key: OrderStatus; label: string }[] = [
  { key: 'pending', label: '🆕 New' },
  { key: 'preparing', label: '👨‍🍳 Preparing' },
  { key: 'ready', label: '🔔 Ready' },
];

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

function KanbanCard({ order, now }: { order: OrderWithItems; now: Date }) {
  const t = useT();
  const elapsedMs = now.getTime() - new Date(order.created_at).getTime();
  const late = elapsedMs > 20 * 60000 && order.status !== 'ready';
  const itemCount = order.order_items.reduce((s, i) => s + i.quantity, 0);
  return (
    <div className={`rounded-[14px] border bg-[var(--c-surface-solid)] p-3.5 ${late ? 'border-danger/50' : 'border-line'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[16px] font-extrabold text-ink">#{order.order_number}</p>
        <p className={`font-mono text-[12px] font-bold ${late ? 'text-danger' : 'text-muted'}`}>{fmtElapsed(elapsedMs)}</p>
      </div>
      <p className="mt-0.5 text-[12.5px] font-bold text-brand">
        {order.tables ? `Table ${order.tables.table_number}` : order.order_type} · {itemCount} items
      </p>
      {late && <p className="mt-1 text-[11px] font-extrabold uppercase tracking-wide text-danger">{t('own_ktn_late' as TKey)}</p>}
      <ul className="mt-2 space-y-1 border-t border-line pt-2">
        {order.order_items.slice(0, 4).map((it) => (
          <li key={it.id} className="flex justify-between gap-2 text-[12.5px]">
            <span className="truncate text-body">
              <span className="mr-1.5 font-mono font-bold text-ink">{it.quantity}×</span>
              {it.item_name}
            </span>
          </li>
        ))}
        {order.order_items.length > 4 && (
          <li className="text-[11.5px] font-bold text-muted">{t('own_ktn_more' as TKey, { n: order.order_items.length - 4 })}</li>
        )}
      </ul>
      <p className="mt-2 text-right font-mono text-[12.5px] font-bold text-ink">{fmtPKR(order.total_amount)}</p>
    </div>
  );
}

export default function OwnerKitchenView({ restaurantId }: { restaurantId: string }) {
  const t = useT();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [view, setView] = useState<View>('kanban');
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(new Set());
  const now = useClock();

  useEffect(() => {
    const supabase = createClient();
    let live = true;
    const load = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, order_items(*), tables(table_number)')
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: true });
      if (live && data) {
        setOrders(data as OrderWithItems[]);
        (data as OrderWithItems[]).forEach((o) => seenRef.current.add(o.id));
      }
    };
    load();
    const ch = supabase
      .channel(`owner-kds-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => load())
      .subscribe();
    const t = window.setInterval(load, 5000);
    return () => {
      live = false;
      supabase.removeChannel(ch);
      window.clearInterval(t);
    };
  }, [restaurantId]);

  // Flash new orders (no beep — this is a monitor, not the KDS)
  useEffect(() => {
    const seen = seenRef.current;
    const fresh = orders.filter((o) => !seen.has(o.id) && o.status === 'pending');
    orders.forEach((o) => seen.add(o.id));
    if (fresh.length > 0) {
      setFlashIds(new Set(fresh.map((o) => o.id)));
      const t = window.setTimeout(() => setFlashIds(new Set()), 4000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [orders]);

  const byStatus = useMemo(() => {
    const m = new Map<OrderStatus, OrderWithItems[]>();
    for (const c of COLUMNS) m.set(c.key, []);
    for (const o of orders) m.get(o.status as OrderStatus)?.push(o);
    return m;
  }, [orders]);

  return (
    <div>
      <SectionHead
        title="Live kitchen"
        sub={t('own_ktn_sub' as TKey, { n: orders.length })}
        action={
          <Tabs<View>
            active={view}
            onChange={setView}
            tabs={[
              { key: 'kanban', label: '🗂 Kanban' },
              { key: 'list', label: '☰ List' },
            ]}
          />
        }
      />
      {orders.length === 0 ? (
        <Empty title={t('own_ktn_no_orders' as TKey)} sub={t('own_ktn_no_orders_sub' as TKey)} />
      ) : view === 'kanban' ? (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = byStatus.get(col.key) ?? [];
            return (
              <div key={col.key} className="rounded-[20px] border border-line bg-soft/60 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="font-display text-[14px] font-extrabold text-ink">{col.label}</p>
                  <span className="rounded-full bg-ink px-2.5 py-0.5 font-mono text-[12px] font-bold text-white">{list.length}</span>
                </div>
                <div className="max-h-[440px] space-y-2.5 overflow-y-auto pr-1">
                  {list.length === 0 && <p className="px-1 py-4 text-center text-[12.5px] text-muted">—</p>}
                  {list.map((o) => (
                    <div key={o.id} className={flashIds.has(o.id) ? 'animate-flash-new rounded-[14px] ring-2 ring-brand' : ''}>
                      <KanbanCard order={o} now={now} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">{t('own_ktn_col_elapsed' as TKey)}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const elapsedMs = now.getTime() - new Date(o.created_at).getTime();
                const late = elapsedMs > 20 * 60000 && o.status !== 'ready';
                return (
                  <tr key={o.id} className={`border-b border-line last:border-0 ${flashIds.has(o.id) ? 'animate-flash-new' : ''}`}>
                    <td className="px-4 py-3 font-mono font-extrabold text-ink">#{o.order_number}</td>
                    <td className="px-4 py-3 font-bold text-body">{o.tables ? `Table ${o.tables.table_number}` : o.order_type}</td>
                    <td className="px-4 py-3 text-muted">{o.order_items.reduce((s, i) => s + i.quantity, 0)} items</td>
                    <td className="px-4 py-3 font-mono font-bold text-ink">{fmtPKR(o.total_amount)}</td>
                    <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                    <td className={`px-4 py-3 font-mono font-bold ${late ? 'text-danger' : 'text-muted'}`}>{fmtElapsed(elapsedMs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
