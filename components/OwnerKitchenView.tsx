'use client';

// Owner Operations → Kitchen command view (Pic 2 / Restora layout).
// LIVE: same realtime feed as the Kitchen Display.
// ACTIONABLE: the merged owner+manager console has full access — status can be
// advanced here (pending → preparing → ready), optimistic with rollback.
// Station pills filter by menu category; the detail panel shows the selected order.
// 100% real data — no dummy stations, counts, or ETAs.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus, OrderWithItems, OrderItem, Profile } from '@/lib/types';
import { fmtElapsed, fmtPKR } from '@/lib/format';
import { useMenuMap } from './useMenuMap';
import StatusPill from './StatusPill';
import { Empty } from './ui';
import OrderDetailModal from './OrderDetailModal';

const COLUMNS: { key: 'pending' | 'preparing' | 'ready'; label: string }[] = [
  { key: 'pending', label: 'New' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: 'Start Preparing',
  preparing: 'Mark as Ready',
};

// Distinct card/column colors per status (darker borders for clear separation)
const COL_STYLE: Record<'pending' | 'preparing' | 'ready', { col: string; card: string; header: string }> = {
  pending: {
    col: 'border-blue-500/30 bg-blue-500/[0.05]',
    card: 'border-blue-500/40 bg-blue-500/[0.05] hover:border-blue-500/60',
    header: 'text-blue-700 dark:text-blue-300',
  },
  preparing: {
    col: 'border-amber-500/30 bg-amber-500/[0.05]',
    card: 'border-amber-500/40 bg-amber-500/[0.05] hover:border-amber-500/60',
    header: 'text-amber-700 dark:text-amber-300',
  },
  ready: {
    col: 'border-emerald-500/30 bg-emerald-500/[0.05]',
    card: 'border-emerald-500/40 bg-emerald-500/[0.05] hover:border-emerald-500/60',
    header: 'text-emerald-700 dark:text-emerald-300',
  },
};

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

function catIcon(name: string): string {
  const n = name.toLowerCase();
  if (/grill|bbq|tandoor|kebab/.test(n)) return '\u{1F525}';
  if (/drink|beverage|juice|shake|tea|coffee|lassi/.test(n)) return '\u{1F964}';
  if (/dessert|sweet|cake|ice|kulfi/.test(n)) return '\u{1F370}';
  if (/salad/.test(n)) return '\u{1F957}';
  if (/pasta|noodle|chow/.test(n)) return '\u{1F35D}';
  if (/pizza/.test(n)) return '\u{1F355}';
  if (/burger|fast|fries/.test(n)) return '\u{1F354}';
  if (/rice|biryani|pulao/.test(n)) return '\u{1F35A}';
  if (/breakfast|paratha|halwa/.test(n)) return '\u{1F373}';
  if (/starter|appet/.test(n)) return '\u{1F362}';
  if (/soup/.test(n)) return '\u{1F35C}';
  return '\u{1F37D}\uFE0F';
}

export default function OwnerKitchenView({
  restaurantId,
  staff = [],
}: {
  restaurantId: string;
  staff?: Profile[];
}) {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const { thumbOf, stationOf, menuInfoById } = useMenuMap(restaurantId);
  const [station, setStation] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const now = useClock();

  // ── Live orders feed (realtime + poll fallback) ──
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
    const poll = window.setInterval(load, 5000);
    return () => {
      live = false;
      supabase.removeChannel(ch);
      window.clearInterval(poll);
    };
  }, [restaurantId]);

  // ── Station pills with real counts ──
  const stations = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of orders) {
      const touched = new Set(o.order_items.map(stationOf));
      for (const s of touched) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [orders, stationOf]);

  const visibleOrders = useMemo(
    () =>
      station === 'all'
        ? orders
        : orders.filter((o) => o.order_items.some((it) => stationOf(it) === station)),
    [orders, station, stationOf]
  );

  const groups = useMemo(() => {
    const g: Record<'pending' | 'preparing' | 'ready', OrderWithItems[]> = {
      pending: [],
      preparing: [],
      ready: [],
    };
    for (const o of visibleOrders) {
      const k = o.status as 'pending' | 'preparing' | 'ready';
      if (k === 'pending' || k === 'preparing' || k === 'ready') g[k].push(o);
    }
    return g;
  }, [visibleOrders]);

  // Keep selection valid as orders change
  useEffect(() => {
    if (selectedId && !visibleOrders.some((o) => o.id === selectedId)) setSelectedId(null);
  }, [visibleOrders, selectedId]);
  const selected = visibleOrders.find((o) => o.id === selectedId) ?? visibleOrders[0] ?? null;

  // ── Optimistic status advance (same pattern as KitchenApp) ──
  const advanceStatus = async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    const { error } = await createClient().from('orders').update({ status }).eq('id', orderId);
    setBusyId(null);
    if (error) {
      const { data } = await createClient()
        .from('orders')
        .select('*, order_items(*), tables(table_number)')
        .eq('id', orderId)
        .maybeSingle();
      if (data) setOrders((prev) => prev.map((o) => (o.id === orderId ? (data as OrderWithItems) : o)));
    }
  };

  // ── Collect payment (optimistic; order leaves the active kanban) ──
  const collectPayment = async (orderId: string, method: string) => {
    setBusyId(orderId);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: 'completed' as OrderStatus, payment_status: 'paid', payment_method: method }
          : o
      )
    );
    const { error } = await createClient()
      .from('orders')
      .update({ status: 'completed', payment_status: 'paid', payment_method: method })
      .eq('id', orderId);
    setBusyId(null);
    if (error) setModalId(null);
  };

  // ── Performance strip (real) ──
  const perf = useMemo(() => {
    const done = orders
      .filter((o) => (o.status === 'ready' || o.status === 'completed') && o.updated_at)
      .map((o) => ({
        at: new Date(o.updated_at).getTime(),
        mins: (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000,
      }))
      .filter((x) => x.mins > 2 && x.mins < 180);
    const avg = done.length ? done.reduce((s, x) => s + x.mins, 0) / done.length : null;
    const onTime = done.length
      ? Math.round((done.filter((x) => x.mins <= 25).length / done.length) * 100)
      : null;
    const delayed = orders.filter(
      (o) =>
        ['pending', 'preparing'].includes(o.status) &&
        (now.getTime() - new Date(o.created_at).getTime()) / 60000 >= 20
    ).length;
    const hr = Date.now() - 3600_000;
    const lastHr = done.filter((x) => x.at >= hr).length;
    const prevHr = done.filter((x) => x.at < hr && x.at >= hr - 3600_000).length;
    const deltaPct = prevHr > 0 ? Math.round(((lastHr - prevHr) / prevHr) * 100) : lastHr > 0 ? 100 : null;
    return { avg, onTime, delayed, deltaPct, lastHr };
  }, [orders, now]);

  const waiterNameOf = (o: OrderWithItems): string | null => {
    if (!o.waiter_id) return null;
    return staff.find((x) => x.id === o.waiter_id)?.name ?? null;
  };

  const elapsedMin = (o: OrderWithItems) => (now.getTime() - new Date(o.created_at).getTime()) / 60000;
  const etaMin =
    selected && perf.avg != null && selected.status !== 'ready'
      ? Math.max(1, Math.round(perf.avg - elapsedMin(selected)))
      : null;

  const stepIdx =
    !selected ? 0 : selected.status === 'ready' ? 1 : selected.status === 'completed' ? 2 : 0;
  const steps = ['Preparing', 'Ready', 'Completed'];

  return (
    <div className="p-4 sm:p-5">
      {/* ── Header + station pills ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[19px] sm:text-[21px] font-black tracking-tight text-ink">
            Kitchen Orders
          </h2>
          <p className="text-[12px] font-medium text-muted">Track and manage all kitchen orders in real time</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          onClick={() => setStation('all')}
          className={`shrink-0 rounded-[12px] px-3 py-1.5 text-[12px] font-extrabold transition-all ${
            station === 'all'
              ? 'bg-brand text-white shadow-lift'
              : 'border border-line/70 bg-[var(--c-surface-solid)] text-muted hover:text-ink'
          }`}
        >
          All Stations{' '}
          <span className={`ml-1 rounded-full px-1.5 text-[10.5px] ${station === 'all' ? 'bg-white/25' : 'bg-soft'}`}>
            {orders.length}
          </span>
        </button>
        {stations.map((s) => (
          <button
            key={s.name}
            onClick={() => setStation(s.name)}
            className={`shrink-0 rounded-[12px] px-3 py-1.5 text-[12px] font-extrabold transition-all ${
              station === s.name
                ? 'bg-brand text-white shadow-lift'
                : 'border border-line/70 bg-[var(--c-surface-solid)] text-muted hover:text-ink'
            }`}
          >
            <span className="mr-1">{catIcon(s.name)}</span>
            {s.name}{' '}
            <span className={`ml-1 rounded-full px-1.5 text-[10.5px] ${station === s.name ? 'bg-white/25' : 'bg-soft'}`}>
              {s.count}
            </span>
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="mt-4">
          <Empty title="No active kitchen orders" sub="New orders will appear here in real time." />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-12">
          {/* ── Kanban columns ── */}
          <div className="xl:col-span-8">
            <div className="grid gap-3 md:grid-cols-3">
              {COLUMNS.map((col) => (
                <div key={col.key} className={`rounded-[16px] border p-2.5 ${COL_STYLE[col.key].col}`}>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className={`text-[12.5px] font-extrabold ${COL_STYLE[col.key].header}`}>{col.label}</p>
                    <span className="rounded-full bg-soft px-2 py-0.5 font-mono text-[11px] font-bold text-muted">
                      {groups[col.key].length}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {groups[col.key].map((o) => {
                      const late = elapsedMin(o) >= 20 && o.status !== 'ready';
                      const isSel = selected?.id === o.id;
                      const n = o.order_items.reduce((s, i) => s + i.quantity, 0);
                      return (
                        <button
                          key={o.id}
                          onClick={() => {
                            setSelectedId(o.id);
                            setModalId(o.id);
                          }}
                          className={`w-full rounded-[14px] border p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${COL_STYLE[col.key].card} ${
                            isSel ? '!border-brand ring-2 ring-brand/25' : late ? '!border-danger/60' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-mono text-[15px] font-extrabold text-ink">#{o.order_number}</p>
                            <p className={`font-mono text-[11px] font-bold ${late ? 'text-danger' : 'text-muted'}`}>
                              {fmtElapsed(now.getTime() - new Date(o.created_at).getTime())}
                            </p>
                          </div>
                          <p className="mt-0.5 text-[11.5px] font-bold text-brand">
                            {o.tables ? `Table ${o.tables.table_number}` : o.order_type} · {n} item{n !== 1 ? 's' : ''}
                          </p>
                          <ul className="mt-2 space-y-1.5 border-t border-line pt-2">
                            {o.order_items.slice(0, 3).map((it) => {
                              const thumb = thumbOf(it);
                              return (
                                <li key={it.id} className="flex items-center gap-2">
                                  {thumb ? (
                                    <img src={thumb} alt="" className="h-8 w-8 shrink-0 rounded-[8px] object-cover" loading="lazy" />
                                  ) : (
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-soft text-[13px]">
                                      {catIcon(stationOf(it))}
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-body">
                                    <span className="mr-1 font-mono font-bold text-ink">{it.quantity}×</span>
                                    {it.item_name}
                                  </span>
                                </li>
                              );
                            })}
                            {o.order_items.length > 3 && (
                              <li className="text-[11px] font-bold text-muted">
                                +{o.order_items.length - 3} more
                              </li>
                            )}
                          </ul>
                        </button>
                      );
                    })}
                    {groups[col.key].length === 0 && (
                      <p className="px-1 py-4 text-center text-[11.5px] font-medium text-muted">Empty</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Detail panel ── */}
          <div className="xl:col-span-4">
            {selected ? (
              <div className="rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-4 shadow-sm lg:sticky lg:top-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-[16px] font-black text-ink">Order #{selected.order_number}</h3>
                  <StatusPill status={selected.status} />
                </div>
                <p className="mt-1 text-[11.5px] font-bold text-muted">
                  {selected.tables ? `Table ${selected.tables.table_number}` : selected.order_type} ·{' '}
                  {fmtElapsed(now.getTime() - new Date(selected.created_at).getTime())} ago
                </p>

                {/* Progress steps */}
                <div className="mt-3 flex items-center gap-1">
                  {steps.map((s, i) => (
                    <div key={s} className="flex flex-1 items-center gap-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black ${
                            i < stepIdx
                              ? 'bg-emerald-500 text-white'
                              : i === stepIdx
                              ? 'bg-brand text-white'
                              : 'bg-soft text-muted'
                          }`}
                        >
                          {i < stepIdx ? '✓' : i + 1}
                        </span>
                        <span className={`text-[9.5px] font-bold ${i <= stepIdx ? 'text-ink' : 'text-muted'}`}>{s}</span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`mb-4 h-0.5 flex-1 rounded ${i < stepIdx ? 'bg-emerald-500' : 'bg-line'}`} />
                      )}
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[12px] font-extrabold uppercase tracking-wider text-muted">Order Items</p>
                <ul className="mt-2 space-y-2">
                  {selected.order_items.map((it) => {
                    const thumb = thumbOf(it);
                    return (
                      <li key={it.id} className="flex items-center gap-2.5">
                        {thumb ? (
                          <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded-[10px] object-cover" loading="lazy" />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-soft text-[16px]">
                            {catIcon(stationOf(it))}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-bold text-ink">{it.item_name}</p>
                          {it.notes && <p className="truncate text-[11px] font-medium text-muted">· {it.notes}</p>}
                        </div>
                        <span className="font-mono text-[12px] font-bold text-muted">×{it.quantity}</span>
                      </li>
                    );
                  })}
                </ul>

                {selected.notes && (
                  <div className="mt-3 rounded-[12px] bg-soft/60 p-2.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Special Notes</p>
                    <p className="mt-0.5 text-[12.5px] font-medium text-body">{selected.notes}</p>
                  </div>
                )}

                {etaMin != null && (
                  <div className="mt-3 flex items-center gap-2.5 rounded-[12px] border border-amber-500/25 bg-amber-500/[0.07] p-2.5">
                    <span className="text-[18px]">⏱️</span>
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Est. ready in
                      </p>
                      <p className="font-mono text-[15px] font-black text-ink">≈ {etaMin} min</p>
                    </div>
                  </div>
                )}

                {NEXT_STATUS[selected.status] ? (
                  <button
                    onClick={() => advanceStatus(selected.id, NEXT_STATUS[selected.status]!)}
                    disabled={busyId === selected.id}
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-[13px] bg-brand px-4 py-2.5 text-[13px] font-black text-white shadow-lift transition-all hover:bg-brand-deep active:scale-[0.99] disabled:opacity-60"
                  >
                    {busyId === selected.id ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>✓</span>
                        <span>{NEXT_LABEL[selected.status]}</span>
                      </>
                    )}
                  </button>
                ) : (
                  <p className="mt-4 rounded-[13px] bg-emerald-500/10 px-4 py-2.5 text-center text-[12.5px] font-bold text-emerald-600 dark:text-emerald-400">
                    Ready — waiting for payment at POS
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-6 text-center">
                <p className="text-[13px] font-bold text-muted">Select an order to see details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Full order detail popup ── */}
      {(() => {
        const modalOrder = modalId ? orders.find((o) => o.id === modalId) ?? null : null;
        if (!modalOrder) return null;
        const menuById = new Map<string, { image_url: string | null; ingredients: string | null }>();
        for (const it of modalOrder.order_items) {
          if (it.menu_item_id && !menuById.has(it.menu_item_id)) {
            const info = menuInfoById(it.menu_item_id);
            if (info) menuById.set(it.menu_item_id, info);
          }
        }
        const next = NEXT_STATUS[modalOrder.status];
        return (
          <OrderDetailModal
            order={modalOrder}
            items={modalOrder.order_items}
            menuById={menuById}
            thumbOf={thumbOf}
            tableNo={modalOrder.tables?.table_number != null ? String(modalOrder.tables.table_number) : null}
            waiterName={waiterNameOf(modalOrder)}
            onClose={() => setModalId(null)}
            onAdvance={next ? () => advanceStatus(modalOrder.id, next) : undefined}
            advanceLabel={next ? NEXT_LABEL[modalOrder.status] : undefined}
            busy={busyId === modalOrder.id}
            onCollectPayment={(method) => collectPayment(modalOrder.id, method)}
            payBusy={busyId === modalOrder.id}
            restaurantId={restaurantId}
          />
        );
      })()}

      {/* ── Performance strip ── */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-4 sm:grid-cols-5">
        <div>
          <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">Kitchen Performance</p>
          <p className="mt-1 font-mono text-[17px] font-black text-ink">{orders.length} <span className="text-[11px] font-bold text-muted">active</span></p>
        </div>
        <div>
          <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">Avg. Prep Time</p>
          <p className="mt-1 font-mono text-[17px] font-black text-ink">
            {perf.avg != null ? <>{Math.round(perf.avg)} <span className="text-[11px] font-bold text-muted">min</span></> : <span className="text-muted">—</span>}
          </p>
        </div>
        <div>
          <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">On-Time Orders</p>
          <p className="mt-1 font-mono text-[17px] font-black text-ink">
            {perf.onTime != null ? <>{perf.onTime}<span className="text-[11px] font-bold text-muted">%</span></> : <span className="text-muted">—</span>}
          </p>
        </div>
        <div>
          <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">Delayed Orders</p>
          <p className="mt-1 font-mono text-[17px] font-black text-danger">{perf.delayed}</p>
        </div>
        <div>
          <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">Vs. Last Hour</p>
          <p className="mt-1 font-mono text-[17px] font-black text-ink">
            {perf.deltaPct != null ? (
              <span className={perf.deltaPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-danger'}>
                {perf.deltaPct >= 0 ? '+' : ''}{perf.deltaPct}%
              </span>
            ) : (
              <span className="text-muted">—</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
