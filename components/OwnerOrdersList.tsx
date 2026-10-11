'use client';

// Owner Sales → Orders list (Pic 3 / Restora layout).
// Status tabs (All / In Progress / Ready / Delayed) with real counts,
// order rows with thumbnails, table numbers, elapsed times, and a working
// action menu (advance status / view in kitchen). No dummy data.

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DiningTable, MenuItem, Order, OrderItem, OrderStatus, Profile } from '@/lib/types';
import { fmtElapsed, fmtPKR } from '@/lib/format';
import StatusPill from './StatusPill';
import { useMenuMap } from './useMenuMap';
import { Empty } from './ui';
import OrderDetailModal from './OrderDetailModal';

type ListTab = 'all' | 'active' | 'ready' | 'delayed';

const TABS: { key: ListTab; label: string }[] = [
  { key: 'all', label: 'All Orders' },
  { key: 'active', label: 'In Progress' },
  { key: 'ready', label: 'Ready' },
  { key: 'delayed', label: 'Delayed' },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
};
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: 'Start Preparing',
  preparing: 'Mark as Ready',
};

const isDelayed = (o: Order) =>
  ['pending', 'preparing'].includes(o.status) &&
  (Date.now() - new Date(o.created_at).getTime()) / 60000 >= 20;

export default function OwnerOrdersList({
  restaurantId,
  orders,
  items,
  tables,
  menu = [],
  staff = [],
  onNavigate,
  onRefresh,
}: {
  restaurantId: string;
  orders: Order[];
  items: OrderItem[];
  tables: DiningTable[];
  menu?: MenuItem[];
  staff?: Profile[];
  onNavigate?: (tab: any) => void;
  onRefresh?: () => void;
}) {
  const [tab, setTab] = useState<ListTab>('all');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { thumbOf } = useMenuMap(restaurantId);

  const tableNoById = useMemo(() => new Map(tables.map((t) => [t.id, t.table_number])), [tables]);
  const menuById = useMemo(
    () =>
      new Map(
        menu.map((m) => [m.id, { image_url: m.image_url ?? null, ingredients: m.ingredients ?? null }])
      ),
    [menu]
  );
  const waiterNameById = useMemo(() => new Map(staff.map((x) => [x.id, x.name])), [staff]);
  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItem[]>();
    for (const it of items) {
      const arr = m.get(it.order_id) ?? [];
      arr.push(it);
      m.set(it.order_id, arr);
    }
    return m;
  }, [items]);

  const counts = useMemo(
    () => ({
      all: orders.length,
      active: orders.filter((o) => ['pending', 'preparing'].includes(o.status)).length,
      ready: orders.filter((o) => o.status === 'ready').length,
      delayed: orders.filter(isDelayed).length,
    }),
    [orders]
  );

  const visible = useMemo(() => {
    const list =
      tab === 'all'
        ? orders
        : tab === 'active'
        ? orders.filter((o) => ['pending', 'preparing'].includes(o.status))
        : tab === 'ready'
        ? orders.filter((o) => o.status === 'ready')
        : orders.filter(isDelayed);
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, tab]);

  const delayedCount = counts.delayed;

  const advance = async (o: Order) => {
    const next = NEXT_STATUS[o.status];
    if (!next) return;
    setBusyId(o.id);
    setMenuOpenId(null);
    const { error } = await createClient().from('orders').update({ status: next }).eq('id', o.id);
    setBusyId(null);
    if (!error) onRefresh?.();
  };

  const collectPayment = async (orderId: string, method: string) => {
    setBusyId(orderId);
    const { error } = await createClient()
      .from('orders')
      .update({ status: 'completed', payment_status: 'paid', payment_method: method })
      .eq('id', orderId);
    setBusyId(null);
    if (!error) onRefresh?.();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[19px] sm:text-[21px] font-black tracking-tight text-ink">Orders</h2>
          <p className="text-[12px] font-medium text-muted">Track and manage all orders in real time</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-[12px] px-3.5 py-1.5 text-[12.5px] font-extrabold transition-all ${
              tab === t.key
                ? 'bg-brand text-white shadow-lift'
                : 'border border-line/70 bg-[var(--c-surface-solid)] text-muted hover:text-ink'
            }`}
          >
            {t.label}{' '}
            <span className={`ml-1 rounded-full px-1.5 text-[10.5px] ${tab === t.key ? 'bg-white/25' : 'bg-soft'}`}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-12">
        {/* ── Order rows ── */}
        <div className="xl:col-span-8">
          {visible.length === 0 ? (
            <Empty title="No orders here" sub="Orders matching this filter will appear in this list." />
          ) : (
            <div className="overflow-hidden rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] shadow-sm">
              {/* header (desktop) */}
              <div className="hidden grid-cols-12 gap-2 border-b border-line px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-wider text-muted md:grid">
                <p className="col-span-2">Order #</p>
                <p className="col-span-2">Table</p>
                <p className="col-span-4">Items</p>
                <p className="col-span-2">Status</p>
                <p className="col-span-1">Time</p>
                <p className="col-span-1 text-right">Actions</p>
              </div>
              <div className="max-h-[600px] divide-y divide-line/50 overflow-y-auto">
                {visible.map((o) => {
                  const oItems = itemsByOrder.get(o.id) ?? [];
                  const tbl = o.table_id ? tableNoById.get(o.table_id) : null;
                  const late = isDelayed(o);
                  const next = NEXT_STATUS[o.status];
                  return (
                    <div
                      key={o.id}
                      onClick={() => setModalId(o.id)}
                      className="grid cursor-pointer grid-cols-12 items-center gap-2 px-4 py-3 transition-colors hover:bg-brand/[0.04]"
                    >
                      <div className="col-span-6 md:col-span-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-brand/10 text-[15px]">
                            {o.order_type === 'takeaway' ? '🥡' : '🍽️'}
                          </span>
                          <div className="min-w-0">
                            <p className="font-mono text-[13px] font-extrabold text-ink">#{o.order_number}</p>
                            <p className="text-[10.5px] font-medium capitalize text-muted">
                              {o.order_type.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-6 md:col-span-2">
                        <p className="font-mono text-[13px] font-bold text-ink">
                          {tbl != null ? `Table ${tbl}` : '—'}
                        </p>
                        <p className="text-[10.5px] font-medium text-muted">{fmtPKR(Number(o.total_amount || 0))}</p>
                      </div>
                      <div className="col-span-10 md:col-span-4">
                        <div className="flex items-center gap-1.5">
                          <div className="flex -space-x-1.5">
                            {oItems.slice(0, 3).map((it) => {
                              const th = thumbOf(it);
                              return th ? (
                                <img key={it.id} src={th} alt="" className="h-7 w-7 rounded-full border-2 border-[var(--c-surface-solid)] object-cover" loading="lazy" />
                              ) : (
                                <span key={it.id} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--c-surface-solid)] bg-soft text-[11px]">
                                  🍽️
                                </span>
                              );
                            })}
                          </div>
                          <p className="min-w-0 truncate text-[12px] font-medium text-body">
                            {oItems.slice(0, 2).map((it) => `${it.item_name} ×${it.quantity}`).join(', ')}
                            {oItems.length > 2 && ` +${oItems.length - 2}`}
                            {oItems.length === 0 && '—'}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2 md:col-span-2">
                        <StatusPill status={o.status} />
                        {late && <p className="mt-0.5 text-[10px] font-extrabold text-danger">DELAYED</p>}
                      </div>
                      <div className="hidden md:col-span-1 md:block">
                        <p className="font-mono text-[12px] font-bold text-ink">
                          {fmtElapsed(Date.now() - new Date(o.created_at).getTime())}
                        </p>
                        <p className="text-[10px] font-medium text-muted">
                          {new Date(o.created_at).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="col-span-2 flex justify-end md:col-span-1">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === o.id ? null : o.id);
                            }}
                            className="rounded-[10px] p-1.5 text-[16px] font-black text-muted transition-colors hover:bg-soft hover:text-ink"
                            aria-label="Order actions"
                          >
                            ⋮
                          </button>
                          {menuOpenId === o.id && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setMenuOpenId(null)} />
                              <div className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-[14px] border border-line bg-[var(--c-surface-solid)] p-1 shadow-xl">
                                {next && (
                                  <button
                                    onClick={() => advance(o)}
                                    disabled={busyId === o.id}
                                    className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[12.5px] font-bold text-ink transition-colors hover:bg-brand/10 hover:text-brand disabled:opacity-60"
                                  >
                                    {busyId === o.id ? (
                                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                                    ) : (
                                      <span>✓</span>
                                    )}
                                    {NEXT_LABEL[o.status]}
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    onNavigate?.('operations');
                                  }}
                                  className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[12.5px] font-bold text-ink transition-colors hover:bg-brand/10 hover:text-brand"
                                >
                                  <span>👨‍🍳</span> View in Kitchen
                                </button>
                                {o.payment_status !== 'paid' && o.status !== 'cancelled' && (
                                  <button
                                    onClick={() => {
                                      setMenuOpenId(null);
                                      setModalId(o.id);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[12.5px] font-bold text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300"
                                  >
                                    <span>💰</span> Collect Payment
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Full order detail popup ── */}
        {(() => {
          const modalOrder = modalId ? orders.find((o) => o.id === modalId) ?? null : null;
          if (!modalOrder) return null;
          const next = NEXT_STATUS[modalOrder.status];
          return (
            <OrderDetailModal
              order={modalOrder}
              items={itemsByOrder.get(modalOrder.id) ?? []}
              menuById={menuById}
              thumbOf={thumbOf}
              tableNo={
                modalOrder.table_id && tableNoById.get(modalOrder.table_id) != null
                  ? String(tableNoById.get(modalOrder.table_id))
                  : null
              }
              waiterName={modalOrder.waiter_id ? waiterNameById.get(modalOrder.waiter_id) ?? null : null}
              onClose={() => setModalId(null)}
              onAdvance={
                next
                  ? async () => {
                      setBusyId(modalOrder.id);
                      const { error } = await createClient()
                        .from('orders')
                        .update({ status: next })
                        .eq('id', modalOrder.id);
                      setBusyId(null);
                      if (!error) onRefresh?.();
                    }
                  : undefined
              }
              advanceLabel={next ? NEXT_LABEL[modalOrder.status] : undefined}
              busy={busyId === modalOrder.id}
              onCollectPayment={(method) => collectPayment(modalOrder.id, method)}
              payBusy={busyId === modalOrder.id}
            />
          );
        })()}

        {/* ── Right rail ── */}
        <div className="space-y-4 xl:col-span-4">
          <div className="rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-4 shadow-sm">
            <h3 className="font-display text-[14px] font-extrabold text-ink">Quick Actions</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: 'New Order', icon: '➕', tab: 'pos' },
                { label: 'View All Tables', icon: '🪑', tab: 'tables' },
                { label: 'Kitchen View', icon: '👨‍🍳', tab: 'operations' },
                { label: 'View Reports', icon: '📊', tab: 'reports' },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={() => onNavigate?.(a.tab)}
                  className="flex items-center gap-2 rounded-[13px] border border-line/70 bg-soft/40 px-3 py-2.5 text-left text-[12px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-brand/40"
                >
                  <span className="text-[15px]">{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {delayedCount > 0 && (
            <div className="rounded-[18px] border border-rose-500/30 bg-gradient-to-br from-rose-500/[0.08] to-transparent p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-[16px]">⚠️</span>
                <h3 className="font-display text-[14px] font-extrabold text-rose-600 dark:text-rose-400">
                  Kitchen Delay Detected
                </h3>
              </div>
              <p className="mt-2 text-[12.5px] font-medium text-muted leading-relaxed">
                {delayedCount} order{delayedCount > 1 ? 's have' : ' has'} exceeded the expected preparation time
                (&gt; 20 min).
              </p>
              <button
                onClick={() => onNavigate?.('operations')}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-brand px-4 py-2 text-[12.5px] font-black text-white shadow-lift transition-all hover:bg-brand-deep active:scale-[0.99]"
              >
                Open Kitchen <span>→</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
