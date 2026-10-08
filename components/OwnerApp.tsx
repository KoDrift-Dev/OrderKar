'use client';

// Owner dashboard: tabbed analytics — Dashboard, Sales, Operations, Staff,
// Customers. All data scoped to this restaurant.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DiningTable, MenuCategory, MenuItem, Order, OrderItem, Profile, Review, Role } from '@/lib/types';
import { CategoryDonut, HourlyHeatmap, RevenueTrend, TopItems, WeekdayBars } from './charts';
import OwnerDashTab from './OwnerDashTab';
import OwnerSalesTab from './OwnerSalesTab';
import OwnerOpsTab from './OwnerOpsTab';
import OwnerStaffTab from './OwnerStaffTab';
import OwnerCustomersTab from './OwnerCustomersTab';
import OwnerGuide from './OwnerGuide';
import TableManager from './TableManager';
import OwnerSettings from './OwnerSettings';
import { Empty, Tabs } from './ui';
import { LangProvider, normalizeLang, useT, type Lang, type TKey } from '@/lib/i18n';
import ManagerApp from './ManagerApp';
import KitchenApp from './KitchenApp';
import WaiterApp from './WaiterApp';
import MenuSection from './MenuSection';
import TeamManager from './TeamManager';

type Range = 'today' | '7d' | '30d' | '12m' | 'custom';
type TabKey = 'dashboard' | 'sales' | 'operations' | 'previews' | 'menu' | 'team' | 'staff' | 'customers' | 'tables' | 'settings';
type PreviewKey = 'manager' | 'kitchen' | 'waiter';

// Sidebar navigation — same destinations as the old top tab strip.
const OWNER_NAV: { key: TabKey; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'sales', label: 'Sales', icon: '💰' },
  { key: 'operations', label: 'Operations', icon: '🖥️' },
  { key: 'previews', label: 'Previews', icon: '👁️' },
  { key: 'menu', label: 'Menu', icon: '🍽️' },
  { key: 'team', label: 'Team', icon: '👥' },
  { key: 'staff', label: 'Staff', icon: '🏅' },
  { key: 'customers', label: 'Customers', icon: '⭐' },
  { key: 'tables', label: 'Tables', icon: '🪑' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

function isoDay(d: Date): string {
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function defaultCustom(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: isoDay(from), to: isoDay(to) };
}

function rangeBounds(r: Range, custom: { from: string; to: string }): { start: Date; end: Date } {
  const now = new Date();
  if (r === 'today') {
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    return { start: s, end: now };
  }
  if (r === 'custom') {
    const s = new Date(custom.from + 'T00:00:00');
    const e = new Date(custom.to + 'T23:59:59');
    return { start: s, end: e };
  }
  const s = new Date(now);
  if (r === '7d') s.setDate(s.getDate() - 7);
  else if (r === '30d') s.setDate(s.getDate() - 30);
  else s.setMonth(s.getMonth() - 12);
  return { start: s, end: now };
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

function aggregate(orders: Order[], items: OrderItem[], range: Range, start: Date, end: Date): Agg {
  const done = orders.filter((o) => o.status !== 'cancelled');
  const revenue = done.reduce((s, o) => s + Number(o.total_amount), 0);
  const itemsSold = items.reduce((s, i) => s + i.quantity, 0);

  const hourly = range === 'today';
  const monthly = range === '12m';
  const bucketKey = (d: Date): string => {
    if (hourly) return `${d.getHours()}:00`;
    if (monthly) return d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' });
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  };
  // Pre-fill every bucket in the range with 0 so sparse data still draws a
  // proper timeline instead of a single "4 Oct → 4 Oct" point.
  const buckets = new Map<string, number>();
  const orderOf = new Map<string, number>();
  let bi = 0;
  const addBucket = (k: string) => {
    if (!buckets.has(k)) {
      buckets.set(k, 0);
      orderOf.set(k, bi++);
    }
  };
  if (hourly) {
    for (let h = 0; h < 24; h++) addBucket(`${h}:00`);
  } else if (monthly) {
    const d = new Date(start);
    d.setDate(1);
    while (d <= end) {
      addBucket(bucketKey(d));
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    const stop = new Date(end);
    stop.setHours(0, 0, 0, 0);
    while (d <= stop) {
      addBucket(bucketKey(d));
      d.setDate(d.getDate() + 1);
    }
  }
  for (const o of done) {
    const k = bucketKey(new Date(o.created_at));
    addBucket(k);
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

const RANGE_KEYS: Record<Range, TKey> = {
  today: 'own_rnglbl_today',
  '7d': 'own_rnglbl_7d',
  '30d': 'own_rnglbl_30d',
  '12m': 'own_rnglbl_12m',
  custom: 'own_rnglbl_custom',
};

export default function OwnerApp({
  restaurantId,
  slug,
  restaurantName,
  viewerId,
  viewerRole,
}: {
  restaurantId: string;
  slug: string;
  restaurantName: string;
  viewerId: string;
  viewerRole: Role;
}) {
  const [lang, setLang] = useState<Lang>('english');

  // Per-restaurant language from super-admin (theme_config.language).
  useEffect(() => {
    let live = true;
    (async () => {
      const { data } = await createClient()
        .from('restaurants')
        .select('theme_config')
        .eq('id', restaurantId)
        .single();
      if (live) setLang(normalizeLang((data?.theme_config as Record<string, unknown> | null)?.language));
    })();
    return () => {
      live = false;
    };
  }, [restaurantId]);

  return (
    <LangProvider value={lang}>
      <OwnerAppInner restaurantId={restaurantId} slug={slug} restaurantName={restaurantName} viewerId={viewerId} viewerRole={viewerRole} />
    </LangProvider>
  );
}

function OwnerAppInner({
  restaurantId,
  slug,
  restaurantName,
  viewerId,
  viewerRole,
}: {
  restaurantId: string;
  slug: string;
  restaurantName: string;
  viewerId: string;
  viewerRole: Role;
}) {
  const t = useT();
  const [range, setRange] = useState<Range>('30d');
  const [custom, setCustom] = useState(defaultCustom);
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewKey>('manager');
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [displayName, setDisplayName] = useState(restaurantName);
  const firstDone = useRef(false);

  const { start, end } = rangeBounds(range, custom);

  // Only the columns owner analytics actually read — keeps payloads small.
  const ORDER_COLS =
    'id,order_number,table_id,waiter_id,order_type,status,total_amount,payment_method,cancel_reason,created_at,updated_at';
  const ITEM_COLS = 'id,order_id,menu_item_id,item_name,quantity,unit_price';

  // Static data — loads once per restaurant, never depends on the date range.
  const loadStatic = async () => {
    const supabase = createClient();
    const [{ data: s }, { data: c }, { data: m }, { data: t }, { data: rv }] = await Promise.all([
      supabase.from('profiles').select('*').eq('restaurant_id', restaurantId).order('created_at'),
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('display_order'),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('name'),
      supabase.from('tables').select('*').eq('restaurant_id', restaurantId).order('table_number'),
      supabase.from('reviews').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(200),
    ]);
    if (t) setTables(t as DiningTable[]);
    if (s) setStaff(s as Profile[]);
    if (c) setCats(c as MenuCategory[]);
    if (m) setMenu(m as MenuItem[]);
    if (rv) setReviews(rv as Review[]);
  };

  // Orders + items — the ONLY thing that depends on the date range.
  const loadOrders = async (isFirst: boolean) => {
    const supabase = createClient();
    if (!isFirst) setOrdersLoading(true);
    try {
      const iso = start.toISOString();
      const { data: o } = await supabase
        .from('orders')
        .select(ORDER_COLS)
        .eq('restaurant_id', restaurantId)
        .gte('created_at', iso)
        .order('created_at', { ascending: true })
        .limit(2000);
      const orderList = (o ?? []) as Order[];
      setOrders(orderList);

      let itemList: OrderItem[] = [];
      if (orderList.length > 0) {
        const ids = orderList.map((x) => x.id);
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 500) chunks.push(ids.slice(i, i + 500));
        const results = await Promise.all(
          chunks.map((ch) => supabase.from('order_items').select(ITEM_COLS).in('order_id', ch)),
        );
        for (const r of results) itemList = itemList.concat((r.data ?? []) as OrderItem[]);
      }
      setItems(itemList);
    } finally {
      if (!isFirst) setOrdersLoading(false);
    }
  };

  useEffect(() => {
    let live = true;
    setLoading(true);
    firstDone.current = false;
    (async () => {
      await Promise.all([loadStatic(), loadOrders(true)]);
      if (live) {
        setLoading(false);
        firstDone.current = true;
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Range change → only orders reload (static data is untouched).
  useEffect(() => {
    if (!firstDone.current) return;
    loadOrders(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, custom.from, custom.to]);

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
    const base = aggregate(orders, items, range, start, end);
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
  }, [orders, items, catName, range, start, end]);

  return (
    <div className="space-y-6 overflow-x-clip">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <button
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
              className="glass mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center !rounded-[12px] text-[18px] text-ink lg:hidden"
            >
              ☰
            </button>
            <div className="min-w-0">
            <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink">Owner dashboard</h1>
            <p className="mt-0.5 truncate text-sm text-muted">
              {displayName} · full analytics
            </p>
            </div>
          </div>
          <div className="shrink-0">
            <OwnerGuide />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Tabs<Range>
            wrap
            active={range}
            onChange={setRange}
            tabs={[
              { key: 'today', label: t('own_range_today') },
              { key: '7d', label: t('own_range_7d') },
              { key: '30d', label: t('own_range_30d') },
              { key: '12m', label: t('own_range_12m') },
              { key: 'custom', label: '📅 Custom' },
            ]}
          />
          {ordersLoading && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-[12px] font-bold text-brand">
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              {t('own_updating')}
            </span>
          )}
          {range === 'custom' && (
            <div className="glass flex items-center gap-1.5 !rounded-[16px] p-1.5 text-[12.5px] font-bold">
              <input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="rounded-[10px] border border-line bg-[var(--c-surface-solid)] px-2 py-1.5 text-ink" />
              <span className="text-muted">→</span>
              <input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="rounded-[10px] border border-line bg-[var(--c-surface-solid)] px-2 py-1.5 text-ink" />
            </div>
          )}
        </div>
      </div>

      <div className="lg:flex lg:items-start lg:gap-6">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav className="glass sticky top-20 space-y-1 !rounded-[18px] p-2.5">
            {OWNER_NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                className={`flex w-full items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-[13.5px] font-bold transition-all ${
                  tab === n.key ? 'btn-3d text-white shadow' : 'text-muted hover:bg-soft hover:text-ink'
                }`}
              >
                <span className="text-[17px] leading-none">{n.icon}</span>
                {n.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
      {loading ? (
        <Empty title={t('own_crunching')} />
      ) : (
        <>
          <div className={tab === 'dashboard' ? '' : 'hidden'}>
            <OwnerDashTab
              agg={agg}
              orders={orders}
              items={items}
              staff={staff}
              itemOrderDate={itemOrderDate}
              slug={slug}
              tables={tables}
              restaurantName={displayName}
            />
          </div>
          <div className={tab === 'sales' ? '' : 'hidden'}>
            <OwnerSalesTab
              orders={orders}
              items={items}
              hours={agg.hours}
              weekdays={agg.weekdays}
              topItems={agg.topItems}
              rangeLabel={t(RANGE_KEYS[range])}
            />
          </div>
          <div className={tab === 'operations' ? '' : 'hidden'}>
            <OwnerOpsTab restaurantId={restaurantId} orders={orders} tables={tables} />
          </div>
          <div className={tab === 'previews' ? '' : 'hidden'}>
            <Tabs<PreviewKey>
              active={preview}
              onChange={setPreview}
              tabs={[
                { key: 'manager', label: '🧑‍💼 Manager' },
                { key: 'kitchen', label: '👨‍🍳 Kitchen' },
                { key: 'waiter', label: '🤵 Waiter' },
              ]}
            />
            <div className="mt-4">
              {tab === 'previews' && preview === 'manager' && (
                <ManagerApp restaurantId={restaurantId} slug={slug} restaurantName={restaurantName} />
              )}
              {tab === 'previews' && preview === 'kitchen' && (
                <KitchenApp restaurantId={restaurantId} />
              )}
              {tab === 'previews' && preview === 'waiter' && (
                <WaiterApp restaurantId={restaurantId} waiterId={viewerId} />
              )}
            </div>
          </div>
          <div className={tab === 'menu' ? '' : 'hidden'}>
            {tab === 'menu' && <MenuSection restaurantId={restaurantId} />}
          </div>
          <div className={tab === 'team' ? '' : 'hidden'}>
            {tab === 'team' && <TeamManager restaurantId={restaurantId} meId={viewerId} myRole={viewerRole} />}
          </div>
          <div className={tab === 'staff' ? '' : 'hidden'}>
            <OwnerStaffTab orders={orders} staff={staff} />
          </div>
          <div className={tab === 'customers' ? '' : 'hidden'}>
            <OwnerCustomersTab reviews={reviews} />
          </div>
          <div className={tab === 'tables' ? '' : 'hidden'}>
            <TableManager restaurantId={restaurantId} slug={slug} tables={tables} onChange={setTables} />
          </div>
          <div className={tab === 'settings' ? '' : 'hidden'}>
            <OwnerSettings restaurantId={restaurantId} slug={slug} onNameChange={setDisplayName} />
          </div>
        </>
      )}
        </div>
      </div>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => setNavOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] animate-slide-in-left flex-col bg-[var(--c-surface-solid)] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate font-display text-[16px] font-extrabold text-ink">{displayName}</p>
                <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted">Owner</p>
              </div>
              <button
                onClick={() => setNavOpen(false)}
                aria-label="Close menu"
                className="glass flex h-9 w-9 items-center justify-center !rounded-full text-[15px] text-muted"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {OWNER_NAV.map((n) => (
                <button
                  key={n.key}
                  onClick={() => {
                    setTab(n.key);
                    setNavOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-[13.5px] font-bold transition-all ${
                    tab === n.key ? 'btn-3d text-white shadow' : 'text-muted hover:bg-soft hover:text-ink'
                  }`}
                >
                  <span className="text-[17px] leading-none">{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}

