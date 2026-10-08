'use client';

// Live Kitchen Display System. Sections per status (New / Preparing / Ready),
// Kanban / Rows / Column views, expandable cards with full item details,
// optimistic one-tap status buttons, NEW-item badges for appended items.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus, OrderWithItems } from '@/lib/types';
import { fmtElapsed, fmtPKR } from '@/lib/format';
import { LangProvider, normalizeLang, useT, type Lang } from '@/lib/i18n';
import StatusPill from './StatusPill';
import { Card, Empty, PageHeader } from './ui';

type KView = 'kanban' | 'rows' | 'column';

const STATUS_TINT: Record<string, string> = {
  pending: '!border-amber-500/40 bg-amber-500/[0.06]',
  preparing: '!border-sky-500/40 bg-sky-500/[0.06]',
  ready: '!border-emerald-500/40 bg-emerald-500/[0.06]',
};

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

// Items added after the order was fired (appended by customer/waiter).
function isNewItem(orderCreatedAt: string, itemCreatedAt?: string): boolean {
  if (!itemCreatedAt) return false;
  return new Date(itemCreatedAt).getTime() - new Date(orderCreatedAt).getTime() > 120000;
}

function OrderCard({
  order,
  flash,
  expanded,
  onToggle,
  onStatus,
  busy,
  menuMap,
}: {
  order: OrderWithItems;
  flash: boolean;
  expanded: boolean;
  onToggle: () => void;
  onStatus: (id: string, status: OrderStatus) => void;
  busy: boolean;
  menuMap: Record<string, { ingredients?: string | null; description?: string | null }>;
}) {
  const t = useT();
  const [cancelling, setCancelling] = useState(false);
  const reasonOpts = [
    { value: 'customer request', label: t('ktn_reason_customer') },
    { value: 'kitchen error', label: t('ktn_reason_kitchen') },
    { value: 'long wait', label: t('ktn_reason_wait') },
    { value: 'item unavailable', label: t('ktn_reason_unavailable') },
    { value: 'duplicate order', label: t('ktn_reason_duplicate') },
  ];
  const [reason, setReason] = useState(reasonOpts[0].value);
  const now = useClock();
  const elapsedMs = now.getTime() - new Date(order.created_at).getTime();
  const late = elapsedMs > 20 * 60000 && order.status !== 'ready';
  const newCount = order.order_items.filter((it) => isNewItem(order.created_at, it.created_at)).length;
  const tint = STATUS_TINT[order.status] ?? '';

  const cancelOrder = async () => {
    const supabase = createClient();
    await supabase.from('orders').update({ status: 'cancelled', cancel_reason: reason }).eq('id', order.id);
  };

  return (
    <Card className={`overflow-hidden p-4 sm:p-5 ${tint} ${flash ? 'animate-flash-new ring-2 ring-brand' : ''}`}>
      <button type="button" onClick={onToggle} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[22px] font-bold leading-none text-ink">#{order.order_number}</p>
            <p className="mt-1 text-[14px] font-bold text-brand">
              {order.tables ? `Table ${order.tables.table_number}` : order.order_type}
              {order.customer_name ? ` · ${order.customer_name}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusPill status={order.status} size="lg" />
            <p className={`font-mono text-[18px] font-bold ${late ? 'animate-pulse text-danger' : 'text-body'}`}>
              {fmtElapsed(elapsedMs)}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {late && (
            <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-danger">
              {t('ktn_late')}
            </span>
          )}
          {newCount > 0 && (
            <span className="animate-pulse rounded-full bg-brand px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-white">
              {t('ktn_new_badge')} · {newCount}
            </span>
          )}
          <span className="text-[11px] font-bold text-muted">
            {order.order_items.reduce((s, i) => s + i.quantity, 0)} items · {fmtPKR(order.total_amount)}
          </span>
          <span className="ml-auto text-[11px] font-bold text-muted">{expanded ? '▲' : '▼'} {t('ktn_tap_expand')}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 border-t border-line pt-3">
          {order.notes && (
            <p className="mb-3 rounded-btn bg-amber/10 px-3.5 py-2 text-[13px] font-semibold text-amber">
              Note: {order.notes}
            </p>
          )}
          <ul className="space-y-2.5">
            {order.order_items.map((it) => {
              const meta = it.menu_item_id ? menuMap[it.menu_item_id] : undefined;
              const fresh = isNewItem(order.created_at, it.created_at);
              return (
                <li key={it.id} className={`rounded-[12px] p-2.5 ${fresh ? 'bg-brand/10 ring-1 ring-brand/40' : 'bg-soft/60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[14px] leading-snug text-body">
                      <span className="mr-2 inline-flex h-7 min-w-7 items-center justify-center rounded-[9px] bg-brand px-2 font-mono text-[13px] font-bold text-white">
                        {it.quantity}
                      </span>
                      <span className="font-bold text-ink">{it.item_name}</span>
                      {fresh && (
                        <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[9.5px] font-extrabold uppercase text-white">
                          {t('ktn_new_badge')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] font-bold text-muted">{fmtPKR(it.unit_price * it.quantity)}</span>
                  </div>
                  {it.notes && <p className="mt-1 pl-9 text-[12.5px] italic text-muted">↳ {it.notes}</p>}
                  {meta?.description && <p className="mt-1 pl-9 text-[12px] leading-relaxed text-muted">{meta.description}</p>}
                  {meta?.ingredients && (
                    <p className="mt-1 pl-9 text-[12px] leading-relaxed text-muted">
                      <span className="font-extrabold uppercase tracking-wide">{t('ktn_ingredients')}: </span>
                      {meta.ingredients}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
            <p className="text-muted"><span className="font-bold">{t('ktn_order_type')}:</span> <span className="font-bold text-ink">{order.order_type}</span></p>
            <p className="text-muted"><span className="font-bold">{t('ktn_payment')}:</span> <span className="font-bold text-ink">{order.payment_status}{order.payment_method ? ` · ${order.payment_method}` : ''}</span></p>
            {order.customer_name && (
              <p className="text-muted"><span className="font-bold">{t('ktn_customer')}:</span> <span className="font-bold text-ink">{order.customer_name}</span></p>
            )}
            {order.customer_phone && (
              <p className="text-muted"><span className="font-bold">Phone:</span> <span className="font-bold text-ink">{order.customer_phone}</span></p>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
        {order.status === 'pending' && (
          <button
            disabled={busy}
            onClick={() => onStatus(order.id, 'preparing')}
            className="btn-3d flex-1 rounded-btn py-3 font-display text-[15px] font-bold text-white disabled:opacity-60"
          >
            {t('ktn_start_preparing')}
          </button>
        )}
        {order.status === 'preparing' && (
          <button
            disabled={busy}
            onClick={() => onStatus(order.id, 'ready')}
            className="flex-1 rounded-btn bg-gradient-to-br from-teal to-emerald-600 py-3 font-display text-[15px] font-bold text-white shadow-lift transition-all hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
          >
            {t('ktn_mark_ready')}
          </button>
        )}
        {order.status === 'ready' && order.order_type !== 'dine_in' && (
          <button
            disabled={busy}
            onClick={() => onStatus(order.id, 'completed')}
            className="flex-1 rounded-btn bg-ok/15 py-3 font-display text-[15px] font-bold text-ok hover:bg-ok/25 disabled:opacity-60"
          >
            {t('ktn_mark_picked')}
          </button>
        )}
        {order.status === 'ready' && order.order_type === 'dine_in' && (
          <p className="flex-1 rounded-btn bg-ok/10 py-3 text-center font-display text-[14px] font-bold text-ok">
            {t('ktn_waiting_pickup')}
            <span className="block text-[11.5px] font-bold text-muted">{t('ktn_serve_hint')}</span>
          </p>
        )}
      </div>
      {order.status !== 'ready' &&
        (cancelling ? (
          <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="min-w-0 flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-3 py-2 text-[13px] font-bold text-ink">
              {reasonOpts.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <button onClick={cancelOrder} className="shrink-0 rounded-btn bg-danger px-4 py-2 text-[13px] font-extrabold text-white">
              {t('ktn_confirm')}
            </button>
            <button onClick={() => setCancelling(false)} className="shrink-0 rounded-btn border border-line px-3 py-2 text-[13px] font-bold text-muted">
              ✕
            </button>
          </div>
        ) : (
          <button onClick={() => setCancelling(true)} className="mt-2 w-full rounded-btn py-2 text-[12.5px] font-bold text-danger/80 hover:bg-danger/10 hover:text-danger">
            {t('ktn_cancel_order')}
          </button>
        ))}
    </Card>
  );
}

function OrderRow({
  order,
  flash,
  expanded,
  onToggle,
  onStatus,
  busy,
  menuMap,
}: {
  order: OrderWithItems;
  flash: boolean;
  expanded: boolean;
  onToggle: () => void;
  onStatus: (id: string, status: OrderStatus) => void;
  busy: boolean;
  menuMap: Record<string, { ingredients?: string | null; description?: string | null }>;
}) {
  const t = useT();
  const [cancelling, setCancelling] = useState(false);
  const reasonOpts = [
    { value: 'customer request', label: t('ktn_reason_customer') },
    { value: 'kitchen error', label: t('ktn_reason_kitchen') },
    { value: 'long wait', label: t('ktn_reason_wait') },
    { value: 'item unavailable', label: t('ktn_reason_unavailable') },
    { value: 'duplicate order', label: t('ktn_reason_duplicate') },
  ];
  const [reason, setReason] = useState(reasonOpts[0].value);
  const now = useClock();
  const elapsedMs = now.getTime() - new Date(order.created_at).getTime();
  const late = elapsedMs > 20 * 60000 && order.status !== 'ready';
  const newCount = order.order_items.filter((it) => isNewItem(order.created_at, it.created_at)).length;
  const tint = STATUS_TINT[order.status] ?? '';

  const cancelOrder = async () => {
    const supabase = createClient();
    await supabase.from('orders').update({ status: 'cancelled', cancel_reason: reason }).eq('id', order.id);
  };

  const totalItems = order.order_items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Card className={`overflow-hidden p-3.5 sm:p-4 transition-all duration-200 ${tint} ${flash ? 'animate-flash-new ring-2 ring-brand' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="flex cursor-pointer flex-wrap items-center justify-between gap-3 select-none"
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="font-mono text-[17px] font-extrabold text-ink">#{order.order_number}</span>
          <span className="text-[13.5px] font-bold text-brand">
            {order.tables ? `Table ${order.tables.table_number}` : order.order_type}
            {order.customer_name ? ` · ${order.customer_name}` : ''}
          </span>
          {newCount > 0 && (
            <span className="animate-pulse rounded-full bg-brand px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
              {t('ktn_new_badge')} {newCount}
            </span>
          )}
          {late && (
            <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-danger">
              {t('ktn_late')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
          <span className="hidden text-[12px] font-bold text-muted md:inline">
            {totalItems} items · {fmtPKR(order.total_amount)}
          </span>
          <span className={`font-mono text-[13.5px] font-bold ${late ? 'animate-pulse text-danger' : 'text-body'}`}>
            {fmtElapsed(elapsedMs)}
          </span>
          <StatusPill status={order.status} size="sm" />

          {!expanded && (
            <div onClick={(e) => e.stopPropagation()} className="hidden sm:block">
              {order.status === 'pending' && (
                <button
                  disabled={busy}
                  onClick={() => onStatus(order.id, 'preparing')}
                  className="btn-3d shrink-0 rounded-full px-3 py-1 text-[11.5px] font-extrabold text-white disabled:opacity-60"
                >
                  {t('ktn_start_preparing')}
                </button>
              )}
              {order.status === 'preparing' && (
                <button
                  disabled={busy}
                  onClick={() => onStatus(order.id, 'ready')}
                  className="shrink-0 rounded-full bg-gradient-to-br from-teal to-emerald-600 px-3 py-1 text-[11.5px] font-extrabold text-white shadow-lift disabled:opacity-60"
                >
                  {t('ktn_mark_ready')}
                </button>
              )}
              {order.status === 'ready' && order.order_type !== 'dine_in' && (
                <button
                  disabled={busy}
                  onClick={() => onStatus(order.id, 'completed')}
                  className="shrink-0 rounded-full bg-ok/15 px-3 py-1 text-[11.5px] font-extrabold text-ok disabled:opacity-60"
                >
                  {t('ktn_mark_picked')}
                </button>
              )}
            </div>
          )}

          <span className="text-[11px] font-bold text-muted">
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3.5 border-t border-line pt-3.5">
          {order.notes && (
            <p className="mb-3 rounded-btn bg-amber/10 px-3.5 py-2 text-[13px] font-semibold text-amber">
              Note: {order.notes}
            </p>
          )}

          <ul className="space-y-2">
            {order.order_items.map((it) => {
              const meta = it.menu_item_id ? menuMap[it.menu_item_id] : undefined;
              const fresh = isNewItem(order.created_at, it.created_at);
              return (
                <li key={it.id} className={`rounded-[12px] p-2.5 ${fresh ? 'bg-brand/10 ring-1 ring-brand/40' : 'bg-soft/60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[14px] leading-snug text-body">
                      <span className="mr-2 inline-flex h-7 min-w-7 items-center justify-center rounded-[9px] bg-brand px-2 font-mono text-[13px] font-bold text-white">
                        {it.quantity}
                      </span>
                      <span className="font-bold text-ink">{it.item_name}</span>
                      {fresh && (
                        <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[9.5px] font-extrabold uppercase text-white">
                          {t('ktn_new_badge')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] font-bold text-muted">{fmtPKR(it.unit_price * it.quantity)}</span>
                  </div>
                  {it.notes && <p className="mt-1 pl-9 text-[12.5px] italic text-muted">↳ {it.notes}</p>}
                  {meta?.description && <p className="mt-1 pl-9 text-[12px] leading-relaxed text-muted">{meta.description}</p>}
                  {meta?.ingredients && (
                    <p className="mt-1 pl-9 text-[12px] leading-relaxed text-muted">
                      <span className="font-extrabold uppercase tracking-wide">{t('ktn_ingredients')}: </span>
                      {meta.ingredients}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] sm:grid-cols-4">
            <p className="text-muted"><span className="font-bold">{t('ktn_order_type')}:</span> <span className="font-bold text-ink">{order.order_type}</span></p>
            <p className="text-muted"><span className="font-bold">{t('ktn_payment')}:</span> <span className="font-bold text-ink">{order.payment_status}{order.payment_method ? ` · ${order.payment_method}` : ''}</span></p>
            {order.customer_name && (
              <p className="text-muted"><span className="font-bold">{t('ktn_customer')}:</span> <span className="font-bold text-ink">{order.customer_name}</span></p>
            )}
            {order.customer_phone && (
              <p className="text-muted"><span className="font-bold">Phone:</span> <span className="font-bold text-ink">{order.customer_phone}</span></p>
            )}
          </div>

          <div className="mt-3.5 flex gap-2" onClick={(e) => e.stopPropagation()}>
            {order.status === 'pending' && (
              <button
                disabled={busy}
                onClick={() => onStatus(order.id, 'preparing')}
                className="btn-3d flex-1 rounded-btn py-2.5 font-display text-[14.5px] font-bold text-white disabled:opacity-60"
              >
                {t('ktn_start_preparing')}
              </button>
            )}
            {order.status === 'preparing' && (
              <button
                disabled={busy}
                onClick={() => onStatus(order.id, 'ready')}
                className="flex-1 rounded-btn bg-gradient-to-br from-teal to-emerald-600 py-2.5 font-display text-[14.5px] font-bold text-white shadow-lift transition-all hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
              >
                {t('ktn_mark_ready')}
              </button>
            )}
            {order.status === 'ready' && order.order_type !== 'dine_in' && (
              <button
                disabled={busy}
                onClick={() => onStatus(order.id, 'completed')}
                className="flex-1 rounded-btn bg-ok/15 py-2.5 font-display text-[14.5px] font-bold text-ok hover:bg-ok/25 disabled:opacity-60"
              >
                {t('ktn_mark_picked')}
              </button>
            )}
            {order.status === 'ready' && order.order_type === 'dine_in' && (
              <p className="flex-1 rounded-btn bg-ok/10 py-2.5 text-center font-display text-[14px] font-bold text-ok">
                {t('ktn_waiting_pickup')}
                <span className="block text-[11.5px] font-bold text-muted">{t('ktn_serve_hint')}</span>
              </p>
            )}
          </div>

          {order.status !== 'ready' &&
            (cancelling ? (
              <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="min-w-0 flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-3 py-2 text-[13px] font-bold text-ink">
                  {reasonOpts.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <button onClick={cancelOrder} className="shrink-0 rounded-btn bg-danger px-4 py-2 text-[13px] font-extrabold text-white">
                  {t('ktn_confirm')}
                </button>
                <button onClick={() => setCancelling(false)} className="shrink-0 rounded-btn border border-line px-3 py-2 text-[13px] font-bold text-muted">
                  ✕
                </button>
              </div>
            ) : (
              <button onClick={() => setCancelling(true)} className="mt-2 w-full rounded-btn py-1.5 text-[12.5px] font-bold text-danger/80 hover:bg-danger/10 hover:text-danger">
                {t('ktn_cancel_order')}
              </button>
            ))}
        </div>
      )}
    </Card>
  );
}

function KitchenAppInner({ restaurantId }: { restaurantId: string }) {
  const t = useT();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [view, setView] = useState<KView>('kanban');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [menuMap, setMenuMap] = useState<Record<string, { ingredients?: string | null; description?: string | null }>>({});
  const seenRef = useRef<Map<string, number>>(new Map());
  const now = useClock();

  useEffect(() => {
    const supabase = createClient();
    let live = true;

    const load = async () => {
      const [{ data }, { data: menu }] = await Promise.all([
        supabase
          .from('orders')
          .select('*, order_items(*), tables(table_number)')
          .eq('restaurant_id', restaurantId)
          .in('status', ['pending', 'preparing', 'ready'])
          .order('created_at', { ascending: true }),
        supabase.from('menu_items').select('id, ingredients, description').eq('restaurant_id', restaurantId),
      ]);
      if (!live) return;
      if (data) {
        const list = data as OrderWithItems[];
        // Detect brand-new orders AND orders that gained items.
        const fresh: string[] = [];
        for (const o of list) {
          const prevCount = seenRef.current.get(o.id);
          const n = o.order_items.length;
          if (prevCount === undefined && o.status === 'pending') fresh.push(o.id);
          else if (prevCount !== undefined && n > prevCount) fresh.push(o.id);
          seenRef.current.set(o.id, n);
        }
        // Drop ids of orders that are gone (completed/cancelled).
        const alive = new Set(list.map((o) => o.id));
        for (const id of [...seenRef.current.keys()]) if (!alive.has(id)) seenRef.current.delete(id);
        setOrders(list);
        if (fresh.length > 0) {
          beep();
          setFlashIds(new Set(fresh));
          window.setTimeout(() => setFlashIds(new Set()), 4000);
        }
      }
      if (menu) {
        const m: Record<string, { ingredients?: string | null; description?: string | null }> = {};
        for (const mi of menu as { id: string; ingredients?: string | null; description?: string | null }[]) {
          m[mi.id] = { ingredients: mi.ingredients, description: mi.description };
        }
        setMenuMap(m);
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => load(),
      )
      .subscribe();

    const poll = window.setInterval(load, 5000);
    return () => {
      live = false;
      supabase.removeChannel(ch);
      window.clearInterval(poll);
    };
  }, [restaurantId]);

  // Optimistic status change — card moves instantly, server follows.
  const setStatusFast = async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    const { error } = await createClient().from('orders').update({ status }).eq('id', orderId);
    setBusyId(null);
    if (error) {
      // Roll back on failure; realtime/poll will resync anyway.
      const { data } = await createClient()
        .from('orders')
        .select('*, order_items(*), tables(table_number)')
        .eq('id', orderId)
        .maybeSingle();
      if (data) setOrders((prev) => prev.map((o) => (o.id === orderId ? (data as OrderWithItems) : o)));
    }
  };

  const groups = useMemo(() => {
    const g: Record<'pending' | 'preparing' | 'ready', OrderWithItems[]> = { pending: [], preparing: [], ready: [] };
    for (const o of orders) {
      if (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready') g[o.status].push(o);
    }
    // FIFO inside each section — longest waiting first.
    for (const k of Object.keys(g) as (keyof typeof g)[]) {
      g[k].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return g;
  }, [orders]);

  const cardProps = (o: OrderWithItems) => ({
    order: o,
    flash: flashIds.has(o.id),
    expanded: expandedId === o.id,
    onToggle: () => setExpandedId((prev) => (prev === o.id ? null : o.id)),
    onStatus: setStatusFast,
    busy: busyId === o.id,
    menuMap,
  });

  const sectionTitle = (k: 'pending' | 'preparing' | 'ready') =>
    k === 'pending' ? t('ktn_col_new') : k === 'preparing' ? t('ktn_col_preparing') : t('ktn_col_ready');

  return (
    <div>
      <PageHeader
        title="Kitchen display"
        sub={t('ktn_sub')}
        right={
          <div className="flex items-center gap-3">
            <div className="glass flex !rounded-full p-1" role="group" aria-label="View">
              {(['kanban', 'rows', 'column'] as KView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold transition-all ${
                    view === v ? 'btn-3d text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {v === 'kanban' ? t('ktn_view_kanban') : v === 'rows' ? t('ktn_view_rows') : t('ktn_view_column')}
                </button>
              ))}
            </div>
            <p className="hidden font-mono text-xl font-bold text-ink sm:block">
              {now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </p>
          </div>
        }
      />

      {orders.length === 0 ? (
        <Empty title={t('ktn_empty_title')} sub={t('ktn_empty_sub')} />
      ) : view === 'kanban' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {(['pending', 'preparing', 'ready'] as const).map((k) => (
            <section key={k} className="min-w-0">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-[15px] font-extrabold text-ink">
                  {sectionTitle(k)}
                  <span className="ml-2 rounded-full bg-soft px-2 py-0.5 font-mono text-[12px] font-bold text-muted">
                    {groups[k].length}
                  </span>
                </h2>
              </div>
              <div className="space-y-3">
                {groups[k].map((o) => (
                  <OrderCard key={o.id} {...cardProps(o)} />
                ))}
                {groups[k].length === 0 && (
                  <p className="rounded-[14px] border border-dashed border-line py-6 text-center text-[12px] font-bold text-muted">—</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : view === 'rows' ? (
        <div className="space-y-4">
          {(['pending', 'preparing', 'ready'] as const).map((k) => {
            if (groups[k].length === 0) return null;
            return (
              <div key={k}>
                <div className="mb-2.5 flex items-center gap-2">
                  <h2 className="font-display text-[15px] font-extrabold text-ink">
                    {sectionTitle(k)}
                  </h2>
                  <span className="rounded-full bg-soft px-2.5 py-0.5 font-mono text-[12px] font-bold text-muted">
                    {groups[k].length}
                  </span>
                  <div className="h-px flex-1 bg-line" />
                </div>
                <div className="space-y-2.5">
                  {groups[k].map((o) => (
                    <OrderRow key={o.id} {...cardProps(o)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Cards in Grid View */
        <div className="space-y-6">
          {(['pending', 'preparing', 'ready'] as const).map((k) => {
            if (groups[k].length === 0) return null;
            return (
              <div key={k}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="font-display text-[16px] font-extrabold text-ink">
                    {sectionTitle(k)}
                  </h2>
                  <span className="rounded-full bg-soft px-2.5 py-0.5 font-mono text-[12px] font-bold text-muted">
                    {groups[k].length}
                  </span>
                  <div className="h-px flex-1 bg-line" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {groups[k].map((o) => (
                    <OrderCard key={o.id} {...cardProps(o)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function KitchenApp({ restaurantId }: { restaurantId: string }) {
  const [lang, setLang] = useState<Lang>('english');

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('restaurants')
        .select('theme_config')
        .eq('id', restaurantId)
        .single();
      if (live && data) {
        setLang(normalizeLang((data.theme_config as { language?: unknown } | null)?.language));
      }
    })();
    return () => {
      live = false;
    };
  }, [restaurantId]);

  return (
    <LangProvider value={lang}>
      <KitchenAppInner restaurantId={restaurantId} />
    </LangProvider>
  );
}
