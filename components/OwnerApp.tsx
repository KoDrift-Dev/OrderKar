'use client';

// Owner dashboard: tabbed analytics — Dashboard, Sales, Operations, Staff,
// Customers. All data scoped to this restaurant.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DiningTable, MenuCategory, MenuItem, Order, OrderItem, Profile, Review } from '@/lib/types';
import { CategoryDonut, HourlyHeatmap, RevenueTrend, TopItems, WeekdayBars } from './charts';
import OwnerDashTab from './OwnerDashTab';
import OwnerSalesTab from './OwnerSalesTab';
import OwnerOpsTab from './OwnerOpsTab';
import OwnerStaffTab from './OwnerStaffTab';
import OwnerCustomersTab from './OwnerCustomersTab';
import { Empty, PageHeader, Tabs } from './ui';

type Range = 'today' | '7d' | '30d' | '12m';
type TabKey = 'dashboard' | 'sales' | 'operations' | 'staff' | 'customers';

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
  weekdays: number[];
  topItems: { name: string; qty: number; revenue: number }[];
  cats: { name: string; revenue: number }[];
}

function aggregate(orders: Order[], items: OrderItem[], range: Range): Agg {
  const done = orders.filter((o) => o.status !== 'cancelled');
  const revenue = done.reduce((s, o) => s + Number(o.total_amount), 0);
  const itemsSold = items.reduce((s, i) => s + i.quantity, 0);

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

const RANGE_LABEL: Record<Range, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '12m': 'Last 12 months',
};

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
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableCount, setTableCount] = useState(6);

  const load = async (r: Range) => {
    const supabase = createClient();
    setLoading(true);
    const iso = rangeStart(r).toISOString();
    const { data: o } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('created_at', iso)
      .order('created_at', { ascending: true })
      .limit(2000);
    const orderList = (o ?? []) as Order[];
    setOrders(orderList);

    let itemList: OrderItem[] = [];
    if (orderList.length > 0) {
      const ids = orderList.map((x) => x.id);
      for (let i = 0; i < ids.length; i += 500) {
        const { data: it } = await supabase.from('order_items').select('*').in('order_id', ids.slice(i, i + 500));
        itemList = itemList.concat((it ?? []) as OrderItem[]);
      }
    }
    setItems(itemList);

    const [{ data: s }, { data: c }, { data: m }, { data: t }, { data: rv }] = await Promise.all([
      supabase.from('profiles').select('*').eq('restaurant_id', restaurantId).order('created_at'),
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('display_order'),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('name'),
      supabase.from('tables').select('*').eq('restaurant_id', restaurantId).order('table_number'),
      supabase.from('reviews').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(200),
    ]);
    if (t) {
      setTables(t as DiningTable[]);
      setTableCount(Math.max(1, (t as DiningTable[]).filter((x) => x.is_active).length));
    }
    if (s) setStaff(s as Profile[]);
    if (c) setCats(c as MenuCategory[]);
    if (m) setMenu(m as MenuItem[]);
    if (rv) setReviews(rv as Review[]);
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

  // order_id -> order created_at (order_items have no timestamp of their own)
  const itemOrderDate = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of orders) m.set(o.id, o.created_at);
    return m;
  }, [orders]);

  const agg = useMemo(() => {
    const base = aggregate(orders, items, range);
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

  return (
    <div className="space-y-6">
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

      <Tabs<TabKey>
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'dashboard', label: '📊 Dashboard' },
          { key: 'sales', label: '💰 Sales' },
          { key: 'operations', label: '⚙️ Operations' },
          { key: 'staff', label: '👥 Staff' },
          { key: 'customers', label: '⭐ Customers' },
        ]}
      />

      {loading ? (
        <Empty title="Crunching numbers…" />
      ) : (
        <>
          {tab === 'dashboard' && (
            <OwnerDashTab
              agg={agg}
              orders={orders}
              items={items}
              staff={staff}
              itemOrderDate={itemOrderDate}
              slug={slug}
              tableCount={tableCount}
              restaurantName={restaurantName}
            />
          )}
          {tab === 'sales' && (
            <OwnerSalesTab
              orders={orders}
              items={items}
              hours={agg.hours}
              weekdays={agg.weekdays}
              topItems={agg.topItems}
              rangeLabel={RANGE_LABEL[range]}
            />
          )}
          {tab === 'operations' && <OwnerOpsTab restaurantId={restaurantId} orders={orders} tables={tables} />}
          {tab === 'staff' && <OwnerStaffTab orders={orders} staff={staff} />}
          {tab === 'customers' && <OwnerCustomersTab reviews={reviews} />}
        </>
      )}
    </div>
  );
}

