'use client';

// Live Kitchen Display System. Realtime order queue with timers, new-order
// beep + card flash, one-tap status buttons.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus, OrderWithItems } from '@/lib/types';
import { fmtElapsed, fmtPKR } from '@/lib/format';
import StatusPill from './StatusPill';
import { Card, Empty, PageHeader, Tabs } from './ui';

type Filter = 'all' | OrderStatus;

function beep(): void {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [0, 0.25, 0.5].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch {
    /* audio unavailable — visual flash still fires */
  }
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearTimeout(t);
  }, []);
  return now;
}

async function setStatus(orderId: string, status: OrderStatus) {
  const supabase = createClient();
  await supabase.from('orders').update({ status }).eq('id', orderId);
}

async function cancelOrder(orderId: string, reason: string) {
  const supabase = createClient();
  await supabase.from('orders').update({ status: 'cancelled', cancel_reason: reason }).eq('id', orderId);
}

const CANCEL_REASONS = ['customer request', 'kitchen error', 'long wait', 'item unavailable', 'duplicate order'];

function OrderCard({ order, flash }: { order: OrderWithItems; flash: boolean }) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const now = useClock();
  const elapsedMs = now.getTime() - new Date(order.created_at).getTime();
  const late = elapsedMs > 20 * 60000 && order.status !== 'ready';

  return (
    <Card className={`p-5 ${flash ? 'animate-flash-new ring-2 ring-brand' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-2xl font-bold text-ink">#{order.order_number}</p>
          <p className="mt-0.5 text-[15px] font-bold text-brand">
            {order.tables ? `Table ${order.tables.table_number}` : order.order_type}
          </p>
        </div>
        <div className="text-right">
          <StatusPill status={order.status} size="lg" />
          <p className={`mt-1.5 font-mono text-xl font-bold ${late ? 'animate-pulse text-danger' : 'text-body'}`}>
            {fmtElapsed(elapsedMs)}
          </p>
          {late && <p className="text-[11px] font-bold uppercase tracking-wide text-danger">Running late</p>}
        </div>
      </div>

      {order.notes && (
        <p className="mt-3 rounded-btn bg-amber/10 px-3.5 py-2 text-[13px] font-semibold text-amber">
          Note: {order.notes}
        </p>
      )}
      {order.customer_name && <p className="mt-2 text-[13px] text-muted">Guest: {order.customer_name}</p>}

      <ul className="mt-3 space-y-2 border-t border-line pt-3">
        {order.order_items.map((it) => (
          <li key={it.id} className="flex items-start justify-between gap-3">
            <span className="text-[14.5px] leading-snug text-body">
              <span className="mr-2 inline-flex h-7 min-w-7 items-center justify-center rounded-[9px] bg-brand px-2 font-mono text-[13px] font-bold text-white">
                {it.quantity}
              </span>
              <span className="font-bold text-ink">{it.item_name}</span>
              {it.notes && <span className="block pl-9 text-[12.5px] text-muted">↳ {it.notes}</span>}
            </span>
            <span className="font-mono text-[13px] font-bold text-muted">{fmtPKR(it.unit_price * it.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2">
        {order.status === 'pending' && (
          <button onClick={() => setStatus(order.id, 'preparing')} className="btn-3d flex-1 rounded-btn py-3 font-display text-[15px] font-bold text-white">
            Start preparing
          </button>
        )}
        {order.status === 'preparing' && (
          <button onClick={() => setStatus(order.id, 'ready')} className="flex-1 rounded-btn bg-gradient-to-br from-teal to-emerald-600 py-3 font-display text-[15px] font-bold text-white shadow-lift transition-all hover:-translate-y-px active:translate-y-0">
            Mark ready
          </button>
        )}
        {order.status === 'ready' && (
          <p className="flex-1 rounded-btn bg-ok/10 py-3 text-center font-display text-[15px] font-bold text-ok">
            Waiting for pickup
          </p>
        )}
      </div>
      {order.status !== 'ready' &&
        (cancelling ? (
          <div className="mt-2 flex gap-2">
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="min-w-0 flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-3 py-2 text-[13px] font-bold text-ink">
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button onClick={() => cancelOrder(order.id, reason)} className="shrink-0 rounded-btn bg-danger px-4 py-2 text-[13px] font-extrabold text-white">
              Confirm
            </button>
            <button onClick={() => setCancelling(false)} className="shrink-0 rounded-btn border border-line px-3 py-2 text-[13px] font-bold text-muted">
              ✕
            </button>
          </div>
        ) : (
          <button onClick={() => setCancelling(true)} className="mt-2 w-full rounded-btn py-2 text-[12.5px] font-bold text-danger/80 hover:bg-danger/10 hover:text-danger">
            Cancel order
          </button>
        ))}
    </Card>
  );
}

export default function KitchenApp({ restaurantId }: { restaurantId: string }) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
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
      .channel(`kds-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => load(),
      )
      .subscribe();

    // Poll as a belt-and-braces fallback (5s)
    const t = window.setInterval(load, 5000);
    return () => {
      live = false;
      supabase.removeChannel(ch);
      window.clearInterval(t);
    };
  }, [restaurantId]);

  // New-order alert
  useEffect(() => {
    const seen = seenRef.current;
    const fresh = orders.filter((o) => !seen.has(o.id) && o.status === 'pending');
    orders.forEach((o) => seen.add(o.id));
    if (fresh.length > 0) {
      beep();
      setFlashIds(new Set(fresh.map((o) => o.id)));
      const t = window.setTimeout(() => setFlashIds(new Set()), 4000);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [orders]);

  const visible = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length, pending: 0, preparing: 0, ready: 0 };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  return (
    <div>
      <PageHeader
        title="Kitchen display"
        sub="Live order queue — updates in realtime"
        right={
          <p className="font-mono text-xl font-bold text-ink">
            {now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </p>
        }
      />
      <div className="mb-5">
        <Tabs<Filter>
          active={filter}
          onChange={setFilter}
          tabs={[
            { key: 'all', label: `All (${counts.all})` },
            { key: 'pending', label: `New (${counts.pending})` },
            { key: 'preparing', label: `Preparing (${counts.preparing})` },
            { key: 'ready', label: `Ready (${counts.ready})` },
          ]}
        />
      </div>
      {visible.length === 0 ? (
        <Empty title="All clear 🎉" sub="New orders will appear here automatically." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((o) => (
            <OrderCard key={o.id} order={o} flash={flashIds.has(o.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
