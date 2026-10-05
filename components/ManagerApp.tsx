'use client';

// Manager: today's pulse — stats, live orders feed, table overview, waste
// logging and QR codes.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LangProvider, normalizeLang, useT, type Lang } from '@/lib/i18n';
import type { DiningTable, OrderWithItems, WasteLog } from '@/lib/types';
import { fmtPKR, fmtAgo } from '@/lib/format';
import StatusPill from './StatusPill';
import QrSection from './QrSection';
import TableCard, { tableState } from './TableCard';
import PosTab from './PosTab';
import { Btn, Card, Empty, Input, Kpi, Label, PageHeader, SectionHead, Select, Tabs } from './ui';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ManagerApp(props: {
  restaurantId: string;
  slug: string;
  restaurantName: string;
}) {
  const [lang, setLang] = useState<Lang>('english');
  useEffect(() => {
    let live = true;
    createClient()
      .from('restaurants')
      .select('theme_config')
      .eq('id', props.restaurantId)
      .single()
      .then(({ data }) => {
        if (live) setLang(normalizeLang((data?.theme_config as Record<string, unknown> | null)?.language));
      });
    return () => {
      live = false;
    };
  }, [props.restaurantId]);
  return (
    <LangProvider value={lang}>
      <ManagerAppInner {...props} />
    </LangProvider>
  );
}

function ManagerAppInner({
  restaurantId,
  slug,
  restaurantName,
}: {
  restaurantId: string;
  slug: string;
  restaurantName: string;
}) {
  const t = useT();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
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
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [waste, setWaste] = useState<WasteLog[]>([]);
  const [wForm, setWForm] = useState({ item: '', qty: '1', reason: 'spoilage', cost: '' });
  const [wBusy, setWBusy] = useState(false);
  const [view, setView] = useState<'dash' | 'pos'>('dash');
  const [posEnabled, setPosEnabled] = useState(true);
  const [bizInfo, setBizInfo] = useState<{ name: string; address?: string; phone?: string; email?: string }>({ name: restaurantName });

  const load = async () => {
    const supabase = createClient();
    const iso = startOfToday().toISOString();
    const [{ data: o }, { data: t }, { data: w }, { data: r }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, order_items(*), tables(table_number)')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', iso)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('tables').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('table_number'),
      supabase.from('waste_logs').select('*').eq('restaurant_id', restaurantId).order('logged_at', { ascending: false }).limit(20),
      supabase.from('restaurants').select('name, theme_config').eq('id', restaurantId).single(),
    ]);
    if (o) setOrders(o as OrderWithItems[]);
    if (t) setTables(t as DiningTable[]);
    if (w) setWaste(w as WasteLog[]);
    if (r) {
      const tc = (r.theme_config ?? {}) as Record<string, unknown>;
      setPosEnabled(tc.pos_enabled !== false);
      setBizInfo({
        name: r.name ?? restaurantName,
        address: typeof tc.address === 'string' ? tc.address : undefined,
        phone: typeof tc.phone === 'string' ? tc.phone : undefined,
        email: typeof tc.email === 'string' ? tc.email : undefined,
      });
    }
  };

  useEffect(() => {
    load();
    const supabase = createClient();
    const ch = supabase
      .channel(`manager-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, load)
      .subscribe();
    const t = window.setInterval(load, 10000);
    return () => {
      supabase.removeChannel(ch);
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const stats = useMemo(() => {
    const done = orders.filter((o) => o.status !== 'cancelled');
    const revenue = done.reduce((s, o) => s + Number(o.total_amount), 0);
    return {
      orders: done.length,
      revenue,
      aov: done.length ? revenue / done.length : 0,
      active: orders.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status)).length,
    };
  }, [orders]);

  const orderTypeLabel = (ot: string): string => {
    if (ot === 'dine_in') return t('mgr_otype_dinein');
    if (ot === 'takeaway') return t('mgr_otype_takeaway');
    if (ot === 'delivery') return t('mgr_otype_delivery');
    return ot;
  };

  const logWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wBusy || !wForm.item.trim()) return;
    setWBusy(true);
    const supabase = createClient();
    await supabase.from('waste_logs').insert({
      restaurant_id: restaurantId,
      item_name: wForm.item.trim(),
      quantity: Number(wForm.qty) || 1,
      reason: wForm.reason,
      estimated_cost: Number(wForm.cost) || 0,
    });
    setWForm({ item: '', qty: '1', reason: 'spoilage', cost: '' });
    setWBusy(false);
    load();
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t('mgr_title')} sub={t('mgr_sub')} />

      {posEnabled && (
        <Tabs
          tabs={[
            { key: 'dash', label: t('mgr_tab_dashboard') },
            { key: 'pos', label: '🧾 POS' },
          ]}
          active={view}
          onChange={setView}
        />
      )}

      {view === 'pos' && posEnabled ? (
        <PosTab
          restaurantId={restaurantId}
          restaurant={bizInfo}
          tables={tables}
          orders={orders}
          onOrderPlaced={load}
        />
      ) : (
        <>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t('mgr_kpi_revenue')} value={fmtPKR(stats.revenue)} />
        <Kpi label={t('mgr_kpi_orders')} value={String(stats.orders)} />
        <Kpi label={t('mgr_kpi_aov')} value={fmtPKR(stats.aov)} />
        <Kpi label={t('mgr_kpi_active')} value={String(stats.active)} />
      </div>

      {/* Orders feed + tables */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionHead title={t('mgr_orders_title')} sub={t('mgr_orders_sub', { count: orders.length })} />
          <div className="space-y-2.5">
            {orders.length === 0 ? (
              <Empty title={t('mgr_orders_empty')} sub={t('mgr_orders_empty_sub')} />
            ) : (
              orders.slice(0, 25).map((o) => (
                <Card key={o.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[15px] font-bold text-ink">
                        #{o.order_number} · {o.tables ? t('mgr_table_no', { num: o.tables.table_number }) : orderTypeLabel(o.order_type)}
                      </p>
                      <p className="text-[12.5px] text-muted">
                        {o.order_items.reduce((s, i) => s + i.quantity, 0)} items · {fmtPKR(o.total_amount)} · {fmtAgo(o.created_at)}
                        {o.payment_status === 'paid' ? (
                          <span className="ml-1.5 font-bold text-ok">· paid ({o.payment_method ?? 'cash'})</span>
                        ) : (
                          <span className="ml-1.5 font-bold text-amber">· unpaid</span>
                        )}
                      </p>
                    </div>
                    <StatusPill status={o.status} />
                  </div>
                  {o.payment_status !== 'paid' && o.status !== 'cancelled' &&
                    (payFor === o.id ? (
                      <div className="mt-3 flex gap-2">
                        <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="min-w-0 flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-3 py-2 text-[13px] font-bold text-ink">
                          <option value="cash">💵 Cash</option>
                          <option value="card">💳 Card</option>
                          <option value="jazzcash">📱 JazzCash</option>
                          <option value="easypaisa">📱 EasyPaisa</option>
                        </select>
                        <button onClick={() => collectPayment(o.id)} className="btn-3d shrink-0 rounded-btn px-4 py-2 text-[13px] font-extrabold text-white">
                          {t('mgr_mark_paid')}
                        </button>
                        <button onClick={() => setPayFor(null)} className="shrink-0 rounded-btn border border-line px-3 py-2 text-[13px] font-bold text-muted">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setPayFor(o.id); setPayMethod('cash'); }} className="mt-3 w-full rounded-btn bg-ok/10 py-2 text-[12.5px] font-extrabold text-ok hover:bg-ok/20">
                        {t('mgr_collect_payment', { total: fmtPKR(o.total_amount) })}
                      </button>
                    ))}
                  {o.status === 'ready' && o.payment_status === 'paid' && (
                    <button onClick={() => completeOrder(o.id)} className="mt-3 w-full rounded-btn bg-brand/10 py-2 text-[12.5px] font-extrabold text-brand hover:bg-brand/20">
                      {t('mgr_complete_order')}
                    </button>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <SectionHead title="Tables" sub={t('mgr_tables_legend')} />
          <div className="grid grid-cols-3 gap-2.5">
            {tables.map((tb) => (
              <TableCard key={tb.id} table={tb} state={tableState(tb.id, orders)} />
            ))}
          </div>

          <div className="mt-6">
            <SectionHead title={t('mgr_waste_title')} />
            <Card className="p-4">
              <form onSubmit={logWaste} className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>{t('mgr_waste_item')}</Label>
                  <Input value={wForm.item} onChange={(e) => setWForm({ ...wForm, item: e.target.value })} placeholder={t('mgr_waste_item_ph')} required />
                </div>
                <div>
                  <Label>{t('mgr_waste_qty')}</Label>
                  <Input type="number" min="0" step="any" value={wForm.qty} onChange={(e) => setWForm({ ...wForm, qty: e.target.value })} />
                </div>
                <div>
                  <Label>{t('mgr_waste_cost')}</Label>
                  <Input type="number" min="0" value={wForm.cost} onChange={(e) => setWForm({ ...wForm, cost: e.target.value })} placeholder="0" />
                </div>
                <div className="col-span-2">
                  <Label>{t('mgr_waste_reason')}</Label>
                  <Select value={wForm.reason} onChange={(e) => setWForm({ ...wForm, reason: e.target.value })}>
                    <option value="spoilage">{t('mgr_waste_spoilage')}</option>
                    <option value="overprep">{t('mgr_waste_overprep')}</option>
                    <option value="damaged">{t('mgr_waste_damaged')}</option>
                    <option value="theft">{t('mgr_waste_theft')}</option>
                    <option value="other">{t('mgr_waste_other')}</option>
                  </Select>
                </div>
                <Btn type="submit" disabled={wBusy} className="col-span-2">
                  {wBusy ? t('mgr_waste_logging') : t('mgr_waste_log')}
                </Btn>
              </form>
              {waste.length > 0 && (
                <div className="mt-4 space-y-1.5 border-t border-line pt-3">
                  {waste.slice(0, 5).map((w) => (
                    <p key={w.id} className="flex justify-between text-[12.5px] text-muted">
                      <span><span className="font-bold text-body">{w.item_name}</span> × {w.quantity} · {w.reason}</span>
                      <span className="font-mono">{fmtPKR(w.estimated_cost)}</span>
                    </p>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <QrSection slug={slug} tables={tables} restaurantName={restaurantName} />
        </>
      )}
    </div>
  );
}
