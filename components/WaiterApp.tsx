'use client';

// Waiter app: two views —
//   1. "Take order": table grid → new order, or tap a table with an OPEN
//      order to keep adding items until it's locked for billing.
//   2. "Orders": every active order grouped by stage (New / In kitchen /
//      Ready / To serve) with contextual actions.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { deductInventoryForOrder } from '@/lib/inventory';
import { logActivity, ACT } from '@/lib/activity';
import { notify, ensureNotificationPermission } from '@/lib/notify';
import type { DiningTable, OrderWithItems } from '@/lib/types';
import { fmtPKR, fmtAgo } from '@/lib/format';
import { LangProvider, normalizeLang, useT, type Lang } from '@/lib/i18n';
import MenuOrder from './MenuOrder';
import TableCard, { tableState } from './TableCard';
import StatusPill from './StatusPill';
import ReceiptModal from './ReceiptModal';
import OrderDetailModal from './OrderDetailModal';
import { Card, Empty, PageHeader, Tabs, Btn } from './ui';

type View = 'take' | 'orders';

export default function WaiterApp({ restaurantId, waiterId }: { restaurantId: string; waiterId: string }) {
  const [lang, setLang] = useState<Lang>('english');
  useEffect(() => {
    let live = true;
    createClient()
      .from('restaurants')
      .select('theme_config')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => {
        if (live) setLang(normalizeLang((data?.theme_config as Record<string, unknown> | undefined)?.language));
      });
    return () => {
      live = false;
    };
  }, [restaurantId]);
  return (
    <LangProvider value={lang}>
      <WaiterAppInner restaurantId={restaurantId} waiterId={waiterId} />
    </LangProvider>
  );
}

function WaiterAppInner({ restaurantId, waiterId }: { restaurantId: string; waiterId: string }) {
  const t = useT();
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [view, setView] = useState<View>('take');
  const [activeTable, setActiveTable] = useState<DiningTable | null>(null);
  const [addingTo, setAddingTo] = useState<OrderWithItems | null>(null);
  const [placedTick, setPlacedTick] = useState(0);
  const [receiptFor, setReceiptFor] = useState<OrderWithItems | null>(null);
  const [detailFor, setDetailFor] = useState<OrderWithItems | null>(null);
  const [paying, setPaying] = useState(false);
  const [actionError, setActionError] = useState('');
  // Previous snapshot for change detection → notifications.
  const prevOrdersRef = useRef<Map<string, { status: string; itemCount: number }>>(new Map());
  const firstLoadRef = useRef(true);

  const collectPayment = async (orderId: string, method: string) => {
    setActionError('');
    setPaying(true);
    const { error } = await createClient()
      .from('orders')
      .update({ status: 'completed', payment_status: 'paid', payment_method: method })
      .eq('id', orderId);
    setPaying(false);
    if (error) {
      // Never fail silently — the waiter must see why the table didn't free.
      setActionError('Payment failed: ' + error.message);
      return;
    }
    setReceiptFor(null);
    // Optimistically remove from local state so the table frees immediately,
    // then refresh from server to confirm.
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setAddingTo(null);
    load();
    logActivity(createClient(), {
      restaurantId,
      action: ACT.PAYMENT_COLLECTED,
      entityType: 'order',
      entityId: orderId,
      details: { payment_method: method },
    });
    deductInventoryForOrder(createClient(), orderId, restaurantId);
  };

  const pickupOrder = async (orderId: string) => {
    // Pickup = waiter takes food from kitchen. Order stays READY (table stays
    // occupied) — only payment frees the table.
    setActionError('');
    const { error } = await createClient()
      .from('orders')
      .update({ picked_up_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) {
      // The picked_up_at column comes from supabase/waiter-flow.sql — if the
      // user hasn't run it yet, say so plainly instead of failing silently.
      const missing = /picked_up_at/i.test(error.message);
      setActionError(
        missing
          ? 'Pickup needs a database update: please run supabase/waiter-flow.sql in Supabase, then try again.'
          : 'Pickup failed: ' + error.message,
      );
      return;
    }
    // Refresh to show picked-up state; table remains occupied.
    const list = await load();
    const fresh = list.find((o) => o.id === orderId) ?? null;
    setAddingTo(fresh);
    logActivity(createClient(), {
      restaurantId,
      action: ACT.ORDER_STATUS_CHANGED,
      entityType: 'order',
      entityId: orderId,
      details: { via: 'pickup' },
    });
  };

  const completeOrder = async (orderId: string) => {
    setActionError('');
    const { error } = await createClient().from('orders').update({ status: 'completed' }).eq('id', orderId);
    if (error) {
      setActionError('Could not complete order: ' + error.message);
      return;
    }
    load();
  };

  const lockForBill = async (orderId: string) => {
    setActionError('');
    const { error } = await createClient().from('orders').update({ ready_for_bill: true }).eq('id', orderId);
    if (error) {
      setActionError('Could not lock for bill: ' + error.message);
      return;
    }
    const list = await load();
    const fresh = list.find((o) => o.id === orderId) ?? null;
    setAddingTo(fresh);
  };

  const load = async (): Promise<OrderWithItems[]> => {
    const supabase = createClient();
    const [{ data: tb }, { data: o }] = await Promise.all([
      supabase.from('tables').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('table_number'),
      supabase
        .from('orders')
        .select('*, order_items(*), tables(table_number)')
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'preparing', 'ready'])
        .order('created_at', { ascending: false }),
    ]);
    if (tb) setTables(tb as DiningTable[]);
    const list = (o ?? []) as OrderWithItems[];
    // Detect changes since last load → sound + vibrate.
    // Skip on first load so opening the page doesn't blast notifications.
    if (!firstLoadRef.current) {
      const prev = prevOrdersRef.current;
      for (const order of list) {
        const itemCount = order.order_items.reduce((s, i) => s + i.quantity, 0);
        const was = prev.get(order.id);
        if (!was) {
          notify('new_order');
        } else if (was.status !== 'ready' && order.status === 'ready') {
          // Food is ready — waiter must pick up from kitchen.
          notify('order_ready');
        } else if (itemCount > was.itemCount) {
          notify('items_added');
        }
      }
    }
    firstLoadRef.current = false;
    prevOrdersRef.current = new Map(
      list.map((order) => [
        order.id,
        { status: order.status, itemCount: order.order_items.reduce((s, i) => s + i.quantity, 0) },
      ]),
    );
    setOrders(list);
    return list;
  };

  useEffect(() => {
    ensureNotificationPermission();
    load();
    const supabase = createClient();
    const ch = supabase
      .channel(`waiter-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => load())
      .subscribe();
    // 3s poll as fallback until supabase/realtime.sql is run (realtime needs
    // the tables in the supabase_realtime publication to fire instantly).
    const poll = window.setInterval(() => load(), 3000);
    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line/12 react-hooks/exhaustive-deps
  }, [restaurantId, placedTick]);

  // One active order per table: still open for more items?
  const openForTable = (tableId: string) =>
    orders.find(
      (o) =>
        o.table_id === tableId &&
        (o.status === 'pending' || o.status === 'preparing') &&
        !o.ready_for_bill,
    );

  // Any live order on the table (pending/preparing/ready) — for the detail panel.
  const liveForTable = (tableId: string) =>
    orders.find(
      (o) => o.table_id === tableId && ['pending', 'preparing', 'ready'].includes(o.status),
    );

  const onTableTap = (tbl: DiningTable) => {
    const live = liveForTable(tbl.id);
    if (live) {
      // Show the order panel (details + status + actions) for any live order.
      setAddingTo(live);
      setActiveTable(null);
    } else {
      setActiveTable(tbl);
      setAddingTo(null);
    }
  };

  const backToTables = () => {
    setActiveTable(null);
    setAddingTo(null);
  };

  // After items are appended, refresh the open-order panel.
  const afterAppend = async (orderId: string) => {
    const list = await load();
    const fresh = list.find((o) => o.id === orderId) ?? null;
    setAddingTo(fresh);
  };

  const groups = useMemo(() => {
    const g = {
      fresh: [] as OrderWithItems[],
      kitchen: [] as OrderWithItems[],
      ready: [] as OrderWithItems[],
      serve: [] as OrderWithItems[],
    };
    for (const o of orders) {
      if (o.status === 'pending') g.fresh.push(o);
      else if (o.status === 'preparing') g.kitchen.push(o);
      else if (o.status === 'ready' && o.payment_status !== 'paid') g.ready.push(o);
      else if (o.status === 'ready') g.serve.push(o);
    }
    return g;
  }, [orders]);

  const activeCount = orders.length;

  const renderOrderCard = (o: OrderWithItems) => {
    const canAdd = (o.status === 'pending' || o.status === 'preparing' || o.status === 'ready') && !o.ready_for_bill;
    const needsPickup = o.status === 'ready' && !o.picked_up_at;
    const pickedUp = o.status === 'ready' && !!o.picked_up_at;
    const itemCount = o.order_items.reduce((s, i) => s + i.quantity, 0);
    const accent =
      o.status === 'pending'
        ? 'border-l-blue-500'
        : o.status === 'preparing'
          ? 'border-l-amber'
          : 'border-l-emerald-500';
    return (
      <Card
        key={o.id}
        onClick={() => setDetailFor(o)}
        className={`cursor-pointer border-l-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.99] ${accent}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[17px] font-black text-ink">
              #{o.order_number} · {o.tables ? `Table ${o.tables.table_number}` : o.order_type}
              {o.waiter_id === waiterId && (
                <span className="ml-1.5 rounded-full bg-brand/10 px-2 py-0.5 align-middle text-[10px] font-extrabold text-brand">YOU</span>
              )}
            </p>
            <p className="mt-0.5 truncate text-[12.5px] font-medium text-muted">
              {itemCount} items · <span className="font-mono font-bold text-ink">{fmtPKR(o.total_amount)}</span> · {fmtAgo(o.created_at)}
              {o.customer_name ? ` · ${o.customer_name}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <StatusPill status={o.status} />
            <span className="text-[11px] font-bold text-brand">Details →</span>
          </div>
        </div>

        {o.ready_for_bill && (o.status === 'pending' || o.status === 'preparing') && (
          <p className="mt-2 inline-block rounded-full bg-amber/15 px-2.5 py-1 text-[11px] font-extrabold text-amber dark:text-amber">
            🔒 {t('wtr_locked_bill')}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {needsPickup && (
            <button
              onClick={() => pickupOrder(o.id)}
              className="min-h-[44px] flex-1 rounded-btn bg-emerald-600 px-4 py-2.5 text-[13.5px] font-extrabold text-white transition-colors hover:bg-emerald-700 active:scale-95"
            >
              🛎️ Pick up from kitchen
            </button>
          )}
          {pickedUp && !o.ready_for_bill && (
            <button
              onClick={() => lockForBill(o.id)}
              className="min-h-[44px] flex-1 rounded-btn bg-brand px-4 py-2.5 text-[13.5px] font-extrabold text-white transition-colors hover:opacity-90 active:scale-95"
            >
              {t('wtr_ready_for_bill')}
            </button>
          )}
          {pickedUp && o.payment_status !== 'paid' && (
            <button
              onClick={() => setReceiptFor(o)}
              className="min-h-[44px] flex-1 rounded-btn bg-amber-500/15 px-4 py-2.5 text-[13.5px] font-extrabold text-amber-700 transition-colors hover:bg-amber-500/25 active:scale-95 dark:text-amber-300"
            >
              🧾 {t('wtr_collect_payment', { amount: fmtPKR(o.total_amount) })}
            </button>
          )}
          {canAdd && (
            <button
              onClick={() => {
                setAddingTo(o);
                setActiveTable(null);
                setView('take');
              }}
              className="min-h-[44px] rounded-btn bg-brand/10 px-4 py-2.5 text-[13px] font-extrabold text-brand transition-colors hover:bg-brand/20 active:scale-95"
            >
              ➕ {t('wtr_add_items')}
            </button>
          )}
          {o.status === 'ready' && o.payment_status === 'paid' && (
            <button
              onClick={() => completeOrder(o.id)}
              className="min-h-[44px] flex-1 rounded-btn bg-brand/10 px-4 py-2.5 text-[13.5px] font-extrabold text-brand transition-colors hover:bg-brand/20 active:scale-95"
            >
              ✓ {t('wtr_complete_order')}
            </button>
          )}
        </div>
      </Card>
    );
  };

  const section = (title: string, list: OrderWithItems[]) =>
    list.length > 0 && (
      <div>
        <h3 className="mb-2 font-display text-[13.5px] font-extrabold uppercase tracking-wide text-muted">
          {title} ({list.length})
        </h3>
        <div className="space-y-3">{list.map(renderOrderCard)}</div>
      </div>
    );

  return (
    <div className="pb-24">
      <PageHeader title="Waiter" sub={t('wtr_sub')} />
      <div className="mb-5">
        <Tabs<View>
          active={view}
          onChange={(v) => { setView(v); backToTables(); }}
          tabs={[
            { key: 'take', label: `🧾 ${t('wtr_take_order')}` },
            { key: 'orders', label: t('wtr_track_orders', { n: activeCount }) },
          ]}
        />
      </div>

      {view === 'take' && !activeTable && !addingTo && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tables.map((tbl) => {
            const open = openForTable(tbl.id);
            return (
              <div key={tbl.id} className="relative">
                <TableCard table={tbl} state={tableState(tbl.id, orders)} onClick={() => onTableTap(tbl)} />
                {open && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow">
                    #{open.order_number} · +
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'take' && (activeTable || addingTo) && (
        <div>
          <button onClick={backToTables} className="mb-4 text-sm font-bold text-brand hover:underline">
            {t('wtr_back_tables')}
          </button>
          {addingTo ? (
            <>
              <Card className="mb-4 border-brand/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-bold text-ink">
                      #{addingTo.order_number} · {addingTo.tables ? `Table ${addingTo.tables.table_number}` : addingTo.order_type}
                    </p>
                    <p className="text-[12.5px] text-muted">
                      {addingTo.order_items.reduce((s, i) => s + i.quantity, 0)} items · {fmtPKR(addingTo.total_amount)}
                    </p>
                  </div>
                  <StatusPill status={addingTo.status} />
                </div>
                <ul className="mt-2 space-y-1 border-t border-line/12 pt-2">
                  {addingTo.order_items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-2 text-[13px]">
                      <span className="text-body"><span className="mr-1.5 font-mono font-bold text-brand">{it.quantity}×</span>{it.item_name}</span>
                      <span className="font-mono font-bold text-muted">{fmtPKR(it.unit_price * it.quantity)}</span>
                    </li>
                  ))}
                </ul>
                {/* Status-based actions — correct restaurant flow:
                    pending/preparing → details + add items only
                    ready (not picked up) → pickup + add items
                    ready (picked up) → ready for bill + collect payment
                    locked → collect payment only */}
                <div className="mt-3 flex flex-col gap-2">
                  {addingTo.status === 'ready' && !addingTo.picked_up_at && (
                    <Btn onClick={() => pickupOrder(addingTo.id)} className="w-full !rounded-full !bg-emerald-600">
                      🛎️ Pick up from kitchen
                    </Btn>
                  )}
                  {addingTo.status === 'ready' && addingTo.picked_up_at && !addingTo.ready_for_bill && (
                    <>
                      <p className="rounded-full bg-emerald-600/10 px-4 py-2 text-center text-[12.5px] font-extrabold text-emerald-700 dark:text-emerald-300">
                        ✓ Picked up — served to table
                      </p>
                      <Btn onClick={() => lockForBill(addingTo.id)} className="w-full !rounded-full">
                        {t('wtr_ready_for_bill')}
                      </Btn>
                    </>
                  )}
                  {(addingTo.ready_for_bill || (addingTo.status === 'ready' && addingTo.picked_up_at)) &&
                    addingTo.payment_status !== 'paid' && (
                      <Btn onClick={() => setReceiptFor(addingTo)} className="w-full !rounded-full !bg-amber-500">
                        🧾 Collect payment · {fmtPKR(addingTo.total_amount)}
                      </Btn>
                    )}
                </div>
                {actionError && (
                  <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-600 dark:text-red-400">
                    {actionError}
                  </p>
                )}
              </Card>
              {(addingTo.status === 'pending' || addingTo.status === 'preparing' || addingTo.status === 'ready') && !addingTo.ready_for_bill && (
                <>
                  <h2 className="mb-4 font-display text-xl font-extrabold text-ink">
                    {t('wtr_add_items')}
                  </h2>
                  <MenuOrder
                    restaurantId={restaurantId}
                    table={tables.find((x) => x.id === addingTo.table_id) ?? { id: addingTo.table_id ?? '', table_number: addingTo.tables?.table_number ?? 0 } as DiningTable}
                    waiterId={waiterId}
                    openOrder={{ id: addingTo.id, number: addingTo.order_number, token: (addingTo as unknown as { tracking_token?: string }).tracking_token ?? '' }}
                    onPlaced={(id) => afterAppend(id)}
                  />
                </>
              )}
            </>
          ) : (
            activeTable && (
              <>
                <h2 className="mb-4 font-display text-xl font-extrabold text-ink">
                  {t('wtr_new_order', { n: activeTable.table_number })}
                </h2>
                <MenuOrder
                  restaurantId={restaurantId}
                  table={activeTable}
                  waiterId={waiterId}
                  onPlaced={() => {
                    setPlacedTick((x) => x + 1);
                    backToTables();
                    setView('orders');
                  }}
                />
              </>
            )
          )}
        </div>
      )}

      {view === 'orders' && (
        <div className="space-y-6">
          {actionError && (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-[12px] font-bold text-red-600 dark:text-red-400">
              {actionError}
            </p>
          )}
          {activeCount === 0 ? (
            <Empty title={t('wtr_no_orders')} sub={t('wtr_no_orders_sub')} />
          ) : (
            <>
              {section(t('wtr_sec_new'), groups.fresh)}
              {section(t('wtr_sec_kitchen'), groups.kitchen)}
              {section(t('wtr_sec_ready'), groups.ready)}
              {section(t('wtr_to_serve'), groups.serve)}
            </>
          )}
        </div>
      )}

      {/* Full order detail popup on card tap */}
      {detailFor && (
        <OrderDetailModal
          order={detailFor}
          items={detailFor.order_items}
          tableNo={detailFor.tables?.table_number != null ? String(detailFor.tables.table_number) : null}
          onClose={() => setDetailFor(null)}
          onCollectPayment={
            detailFor.status === 'ready' && detailFor.payment_status !== 'paid'
              ? (method) => collectPayment(detailFor.id, method)
              : undefined
          }
          payBusy={paying}
          restaurantId={restaurantId}
        />
      )}

      {/* Receipt popup — method, download, and Paid live here */}
      {receiptFor && (
        <ReceiptModal
          restaurantId={restaurantId}
          order={receiptFor}
          items={receiptFor.order_items}
          tableNo={receiptFor.tables?.table_number != null ? String(receiptFor.tables.table_number) : null}
          onClose={() => setReceiptFor(null)}
          onPaid={(method) => collectPayment(receiptFor.id, method)}
          payBusy={paying}
        />
      )}
    </div>
  );
}
