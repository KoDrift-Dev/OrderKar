'use client';

// Owner analytics: KPIs, revenue trend, rush hours, top items, category mix,
// staff list, menu manager and QR codes — all scoped to this restaurant.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MenuCategory, MenuItem, Order, OrderItem, Profile } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { CategoryDonut, HourlyHeatmap, RevenueTrend, TopItems, WeekdayBars } from './charts';
import QrSection from './QrSection';
import { Btn, Card, Empty, Input, Kpi, Label, PageHeader, SectionHead, Select, Tabs } from './ui';

type Range = 'today' | '7d' | '30d' | '12m';

function rangeStart(r: Range): Date {
  const d = new Date();
  if (r === 'today') d.setHours(0, 0, 0, 0);
  else if (r === '7d') d.setDate(d.getDate() - 7);
  else if (r === '30d') d.setDate(d.getDate() - 30);
  else d.setMonth(d.getMonth() - 12);
  return d;
}

interface Agg {
  revenue: number;
  orders: number;
  itemsSold: number;
  trend: { label: string; value: number }[];
  hours: number[];
  weekdays: number[]; // Mon..Sun
  topItems: { name: string; qty: number; revenue: number }[];
  cats: { name: string; revenue: number }[];
}

function aggregate(orders: Order[], items: OrderItem[], range: Range): Agg {
  const done = orders.filter((o) => o.status !== 'cancelled');
  const revenue = done.reduce((s, o) => s + Number(o.total_amount), 0);
  const itemsSold = items.reduce((s, i) => s + i.quantity, 0);

  // Trend buckets
  const bucketKey = (d: Date): string => {
    if (range === 'today') return `${d.getHours()}:00`;
    if (range === '12m') return d.toLocaleDateString('en-PK', { month: 'short' });
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  };
  const buckets = new Map<string, number>();
  const orderOf = new Map<string, number>();
  let bi = 0;
  for (const o of done) {
    const k = bucketKey(new Date(o.created_at));
    if (!buckets.has(k)) {
      buckets.set(k, 0);
      orderOf.set(k, bi++);
    }
    buckets.set(k, (buckets.get(k) ?? 0) + Number(o.total_amount));
  }
  const trend = [...buckets.entries()]
    .sort((a, b) => (orderOf.get(a[0]) ?? 0) - (orderOf.get(b[0]) ?? 0))
    .map(([label, value]) => ({ label, value }));

  const hours = new Array(24).fill(0) as number[];
  const weekdays = new Array(7).fill(0) as number[];
  for (const o of done) {
    const d = new Date(o.created_at);
    hours[d.getHours()] += 1;
    weekdays[(d.getDay() + 6) % 7] += 1;
  }

  const itemAgg = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const i of items) {
    const e = itemAgg.get(i.item_name) ?? { name: i.item_name, qty: 0, revenue: 0 };
    e.qty += i.quantity;
    e.revenue += i.quantity * Number(i.unit_price);
    itemAgg.set(i.item_name, e);
  }
  const topItems = [...itemAgg.values()].sort((a, b) => b.qty - a.qty);

  return { revenue, orders: done.length, itemsSold, trend, hours, weekdays, topItems, cats: [] };
}

export default function OwnerApp({
  restaurantId,
  slug,
  restaurantName,
}: {
  restaurantId: string;
  slug: string;
  restaurantName: string;
}) {
  const [range, setRange] = useState<Range>('30d');
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: '', prep: '10' });
  const [tableCount, setTableCount] = useState(6);

  const load = async (r: Range) => {
    const supabase = createClient();
    setLoading(true);
    const iso = rangeStart(r).toISOString();
    const { data: o } = await supabase
      .from('orders')
      .select('id, order_number, restaurant_id, table_id, status, total_amount, created_at')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', iso)
      .order('created_at', { ascending: true })
      .limit(2000);
    const orderList = (o ?? []) as Order[];
    setOrders(orderList);

    let itemList: OrderItem[] = [];
    if (orderList.length > 0) {
      const ids = orderList.map((x) => x.id);
      // chunk to stay safe with .in()
      for (let i = 0; i < ids.length; i += 500) {
        const { data: it } = await supabase.from('order_items').select('*').in('order_id', ids.slice(i, i + 500));
        itemList = itemList.concat((it ?? []) as OrderItem[]);
      }
    }
    setItems(itemList);

    const [{ data: s }, { data: c }, { data: m }, { data: t }] = await Promise.all([
      supabase.from('profiles').select('*').eq('restaurant_id', restaurantId).order('created_at'),
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('display_order'),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('name'),
      supabase.from('tables').select('id').eq('restaurant_id', restaurantId).eq('is_active', true),
    ]);
    if (t) setTableCount(Math.max(1, t.length));
    if (s) setStaff(s as Profile[]);
    if (c) {
      setCats(c as MenuCategory[]);
      if (!newItem.category && (c as MenuCategory[]).length > 0) {
        setNewItem((f) => ({ ...f, category: (c as MenuCategory[])[0].id }));
      }
    }
    if (m) setMenu(m as MenuItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, range]);

  const catName = useMemo(() => {
    const map = new Map<string, string>();
    const itemToCat = new Map<string, string>();
    for (const mi of menu) itemToCat.set(mi.id, mi.category_id);
    for (const c of cats) map.set(c.id, c.name);
    return { map, itemToCat };
  }, [cats, menu]);

  const agg = useMemo(() => {
    const base = aggregate(orders, items, range);
    // category revenue from items
    const catRev = new Map<string, number>();
    for (const i of items) {
      const catId = i.menu_item_id ? catName.itemToCat.get(i.menu_item_id) : undefined;
      const name = (catId && catName.map.get(catId)) || 'Other';
      catRev.set(name, (catRev.get(name) ?? 0) + i.quantity * Number(i.unit_price));
    }
    base.cats = [...catRev.entries()]
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
    return base;
  }, [orders, items, catName, range]);

  const toggleAvailable = async (item: MenuItem) => {
    const supabase = createClient();
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id);
    setMenu((prev) => prev.map((x) => (x.id === item.id ? { ...x, is_available: !x.is_available } : x)));
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim() || !newItem.price || !newItem.category) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: restaurantId,
        category_id: newItem.category,
        name: newItem.name.trim(),
        price: Number(newItem.price),
        prep_time_minutes: Number(newItem.prep) || 10,
      })
      .select()
      .single();
    if (!error && data) {
      setMenu((prev) => [...prev, data as MenuItem]);
      setNewItem((f) => ({ ...f, name: '', price: '' }));
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Owner dashboard"
        sub={`${restaurantName} · full analytics`}
        right={
          <Tabs<Range>
            active={range}
            onChange={setRange}
            tabs={[
              { key: 'today', label: 'Today' },
              { key: '7d', label: '7 days' },
              { key: '30d', label: '30 days' },
              { key: '12m', label: '12 months' },
            ]}
          />
        }
      />

      {loading ? (
        <Empty title="Crunching numbers…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Revenue" value={fmtPKR(agg.revenue)} />
            <Kpi label="Orders" value={fmtNum(agg.orders)} />
            <Kpi
              label="Avg order value"
              value={fmtPKR(agg.orders ? agg.revenue / agg.orders : 0)}
            />
            <Kpi label="Items sold" value={fmtNum(agg.itemsSold)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RevenueTrend points={agg.trend.map((t) => t.value)} labels={agg.trend.map((t) => t.label)} />
            <HourlyHeatmap hours={agg.hours} />
            <WeekdayBars days={agg.weekdays} />
            <TopItems items={agg.topItems} />
            <div className="lg:col-span-2">
              <CategoryDonut cats={agg.cats} />
            </div>
          </div>
        </>
      )}

      {/* Staff */}
      <div>
        <SectionHead title="Staff" sub={`${staff.length} team members`} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {staff.map((s) => (
            <Card key={s.id} className="p-4">
              <p className="font-display text-[15px] font-extrabold text-ink">{s.name}</p>
              <p className="mt-0.5 text-[12.5px] font-bold uppercase tracking-wide text-brand">{s.role}</p>
              {s.phone && <p className="mt-1 font-mono text-[12.5px] text-muted">{s.phone}</p>}
              {!s.is_active && <p className="mt-1 text-[12px] font-bold text-danger">Inactive</p>}
            </Card>
          ))}
          {staff.length === 0 && <Empty title="No staff yet" sub="Create users in Supabase Auth, then add profiles rows (see README)." />}
        </div>
      </div>

      {/* Menu manager */}
      <div>
        <SectionHead title="Menu manager" sub="Toggle availability or add items" />
        <Card className="p-5">
          <form onSubmit={addItem} className="mb-5 grid gap-3 sm:grid-cols-4">
            <div>
              <Label>Item name</Label>
              <Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Chicken Tikka" required />
            </div>
            <div>
              <Label>Price (Rs)</Label>
              <Input type="number" min="0" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} placeholder="450" required />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Btn type="submit" className="w-full">Add item</Btn>
            </div>
          </form>
          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {menu.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-line px-3.5 py-2">
                <div className="min-w-0">
                  <p className={`truncate text-[14px] font-bold ${m.is_available ? 'text-ink' : 'text-muted line-through'}`}>{m.name}</p>
                  <p className="font-mono text-[12px] text-muted">{fmtPKR(m.price)}</p>
                </div>
                <button
                  onClick={() => toggleAvailable(m)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
                    m.is_available ? 'bg-ok/10 text-ok' : 'bg-muted/15 text-muted'
                  }`}
                >
                  {m.is_available ? 'Available' : 'Hidden'}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <QrSection slug={slug} tableCount={tableCount} restaurantName={restaurantName} />
    </div>
  );
}
