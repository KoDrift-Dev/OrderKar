'use client';

// Manager: today's pulse — stats, live orders feed, table overview, waste
// logging and QR codes.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DiningTable, OrderWithItems, WasteLog } from '@/lib/types';
import { fmtPKR, fmtAgo } from '@/lib/format';
import StatusPill from './StatusPill';
import QrSection from './QrSection';
import { Btn, Card, Empty, Input, Kpi, Label, PageHeader, SectionHead, Select } from './ui';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ManagerApp({
  restaurantId,
  slug,
  restaurantName,
}: {
  restaurantId: string;
  slug: string;
  restaurantName: string;
}) {
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
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [waste, setWaste] = useState<WasteLog[]>([]);
  const [wForm, setWForm] = useState({ item: '', qty: '1', reason: 'spoilage', cost: '' });
  const [wBusy, setWBusy] = useState(false);

  const load = async () => {
    const supabase = createClient();
    const iso = startOfToday().toISOString();
    const [{ data: o }, { data: t }, { data: w }] = await Promise.all([
      supabase
        .from('orders')
        .select('*, order_items(*), tables(table_number)')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', iso)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('tables').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('table_number'),
      supabase.from('waste_logs').select('*').eq('restaurant_id', restaurantId).order('logged_at', { ascending: false }).limit(20),
    ]);
    if (o) setOrders(o as OrderWithItems[]);
    if (t) setTables(t as DiningTable[]);
    if (w) setWaste(w as WasteLog[]);
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

  const busyTables = useMemo(() => {
    const s = new Set<string>();
    for (const o of orders) if (['pending', 'preparing', 'ready'].includes(o.status) && o.table_id) s.add(o.table_id);
    return s;
  }, [orders]);

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
      <PageHeader title="Manager dashboard" sub="Today's pulse — live" />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue today" value={fmtPKR(stats.revenue)} />
        <Kpi label="Orders today" value={String(stats.orders)} />
        <Kpi label="Avg order" value={fmtPKR(stats.aov)} />
        <Kpi label="Active now" value={String(stats.active)} />
      </div>

      {/* Orders feed + tables */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <SectionHead title="Today's orders" sub={`${orders.length} total`} />
          <div className="space-y-2.5">
            {orders.length === 0 ? (
              <Empty title="No orders yet today" sub="Orders will stream in here live." />
            ) : (
              orders.slice(0, 25).map((o) => (
                <Card key={o.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[15px] font-bold text-ink">
                        #{o.order_number} · {o.tables ? `Table ${o.tables.table_number}` : o.order_type}
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
                          Paid ✓
                        </button>
                        <button onClick={() => setPayFor(null)} className="shrink-0 rounded-btn border border-line px-3 py-2 text-[13px] font-bold text-muted">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setPayFor(o.id); setPayMethod('cash'); }} className="mt-3 w-full rounded-btn bg-ok/10 py-2 text-[12.5px] font-extrabold text-ok hover:bg-ok/20">
                        Collect payment · {fmtPKR(o.total_amount)}
                      </button>
                    ))}
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <SectionHead title="Tables" sub={`${busyTables.size}/${tables.length} busy`} />
          <div className="grid grid-cols-3 gap-2.5">
            {tables.map((t) => (
              <Card key={t.id} className={`p-3.5 text-center ${busyTables.has(t.id) ? 'ring-2 ring-amber' : ''}`}>
                <p className="font-display text-lg font-extrabold text-ink">T{t.table_number}</p>
                <p className={`mt-1 text-[11.5px] font-bold ${busyTables.has(t.id) ? 'text-amber' : 'text-ok'}`}>
                  {busyTables.has(t.id) ? 'Busy' : 'Free'}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-6">
            <SectionHead title="Log waste" />
            <Card className="p-4">
              <form onSubmit={logWaste} className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Item</Label>
                  <Input value={wForm.item} onChange={(e) => setWForm({ ...wForm, item: e.target.value })} placeholder="e.g. Chicken Karahi" required />
                </div>
                <div>
                  <Label>Qty</Label>
                  <Input type="number" min="0" step="any" value={wForm.qty} onChange={(e) => setWForm({ ...wForm, qty: e.target.value })} />
                </div>
                <div>
                  <Label>Est. cost (Rs)</Label>
                  <Input type="number" min="0" value={wForm.cost} onChange={(e) => setWForm({ ...wForm, cost: e.target.value })} placeholder="0" />
                </div>
                <div className="col-span-2">
                  <Label>Reason</Label>
                  <Select value={wForm.reason} onChange={(e) => setWForm({ ...wForm, reason: e.target.value })}>
                    <option value="spoilage">Spoilage</option>
                    <option value="overprep">Over-prep</option>
                    <option value="damaged">Damaged</option>
                    <option value="theft">Theft</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <Btn type="submit" disabled={wBusy} className="col-span-2">
                  {wBusy ? 'Logging…' : 'Log waste'}
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
    </div>
  );
}
