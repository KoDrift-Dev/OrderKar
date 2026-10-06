'use client';

// Waiter app: two views —
//   1. "Take order": table grid → new order, or tap a table with an OPEN
//      order to keep adding items until it's locked for billing.
//   2. "Orders": every active order grouped by stage (New / In kitchen /
//      Ready / To serve) with contextual actions.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DiningTable, OrderWithItems } from '@/lib/types';
import { fmtPKR, fmtAgo } from '@/lib/format';
import { LangProvider, normalizeLang, useT, type Lang } from '@/lib/i18n';
import MenuOrder from './MenuOrder';
import TableCard, { tableState } from './TableCard';
import StatusPill from './StatusPill';
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

  const completeOrder = async (orderId: string) => {
    await createClient().from('orders').update({ status: 'completed' }).eq('id', orderId);
    load();
  };

  const lockForBill = async (orderId: string) => {
    await createClient().from('orders').update({ ready_for_bill: true }).eq('id', orderId);
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
    setOrders(list);
    return list;
  };

  useEffect(() => {
    load();
    const supabase = createClient();
    const ch = supabase
      .channel(`waiter-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => load())
      .subscribe();
    const poll = window.setInterval(() => load(), 8000);
    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, placedTick]);

  // One active order per table: still open for more items?
  const openForTable = (tableId: string) =>
    orders.find(
      (o) =>
        o.table_id === tableId &&
        (o.status === 'pending' || o.status === 'preparing') &&
        !o.ready_for_bill,
    );

  const onTableTap = (tbl: DiningTable) => {
    const open = openForTable(tbl.id);
    if (open) {
      setAddingTo(open);
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
    const canAdd = (o.status === 'pending' || o.status === 'preparing') && !o.ready_for_bill;
    return (
      <Card key={o.id} className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-lg font-bold text-ink">
              #{o.order_number} · {o.tables ? `Table ${o.tables.table_number}` : o.order_type}
              {o.waiter_id === waiterId && <span className="ml-1.5 rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-extrabold text-brand">YOU</span>}
            </p>
            <p className="truncate text-[12.5px] text-muted">
              {o.order_items.reduce((s, i) => s + i.quantity, 0)} items · {fmtPKR(o.total_amount)} · {fmtAgo(o.created_at)}
              {o.customer_name ? ` · ${o.customer_name}` : ''}
            </p>
          </div>
          <StatusPill status={o.status} />
        </div>

        {o.ready_for_bill && (o.status === 'pending' || o.status === 'preparing') && (
          <p className="mt-2 inline-block rounded-full bg-amber/15 px-2.5 py-1 text-[11px] font-extrabold text-amber">
            🔒 {t('wtr_locked_bill')}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {canAdd && (
            <button
              onClick={() => {
                setAddingTo(o);
                setActiveTable(null);
                setView('take');
              }}
              className="rounded-btn bg-brand/10 px-4 py-2 text-[13px] font-extrabold text-brand hover:bg-brand/20"
            >
              {t('wtr_add_items')}
            </button>
          )}
          {o.status === 'ready' && o.payment_status !== 'paid' &&
            (payFor === o.id ? (
              <>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="min-w-0 flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-3 py-2 text-[13px] font-bold text-ink">
                  <option value="cash">💵 Cash</option>
                  <option value="card">💳 Card</option>
                  <option value="jazzcash">📱 JazzCash</option>
                  <option value="easypaisa">📱 EasyPaisa</option>
                </select>
                <button onClick={() => collectPayment(o.id)} className="btn-3d shrink-0 rounded-btn px-4 py-2 text-[13px] font-extrabold text-white">
                  Paid ✓
                </button>
                <button onClick={() => setPayFor(null)} className="shrink-0 rounded-btn border border-line px-3 py-2 text-[13px] font-bold text-muted">✕</button>
              </>
            ) : (
              <button onClick={() => { setPayFor(o.id); setPayMethod('cash'); }} className="flex-1 rounded-btn bg-ok/10 py-2 text-[13.5px] font-extrabold text-ok hover:bg-ok/20">
                {t('wtr_collect_payment', { amount: fmtPKR(o.total_amount) })}
              </button>
            ))}
          {o.status === 'ready' && o.payment_status === 'paid' && (
            <button onClick={() => completeOrder(o.id)} className="flex-1 rounded-btn bg-brand/10 py-2 text-[13.5px] font-extrabold text-brand hover:bg-brand/20">
              {t('wtr_complete_order')}
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
                <ul className="mt-2 space-y-1 border-t border-line pt-2">
                  {addingTo.order_items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-2 text-[13px]">
                      <span className="text-body"><span className="mr-1.5 font-mono font-bold text-brand">{it.quantity}×</span>{it.item_name}</span>
                      <span className="font-mono font-bold text-muted">{fmtPKR(it.unit_price * it.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <Btn onClick={() => lockForBill(addingTo.id)} className="mt-3 w-full !rounded-full">
                  {t('wtr_ready_for_bill')}
                </Btn>
              </Card>
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
    </div>
  );
}
