'use client';

// Owner dashboard: Full-Screen Enterprise Software Architecture with
// fixed Left Sleek Sidebar, top command utility bar, categorized navigation,
// and edge-to-edge responsive canvas.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { DiningTable, MenuCategory, MenuItem, Order, OrderItem, Profile, Review, Role } from '@/lib/types';
import OwnerDashTab from './OwnerDashTab';
import OwnerSalesTab from './OwnerSalesTab';
import OwnerOpsTab from './OwnerOpsTab';
import OwnerStaffTab from './OwnerStaffTab';
import OwnerCustomersTab from './OwnerCustomersTab';
import OwnerGuide from './OwnerGuide';
import TableManager from './TableManager';
import OwnerSettings from './OwnerSettings';
import ThemeToggle from './ThemeToggle';
import Logo from './Logo';
import { Card } from './ui';
import { LangProvider, normalizeLang, useT, type Lang, type TKey } from '@/lib/i18n';
import ManagerApp from './ManagerApp';
import KitchenApp from './KitchenApp';
import WaiterApp from './WaiterApp';
import MenuSection from './MenuSection';
import TeamManager from './TeamManager';
import OwnerAuditTab from './OwnerAuditTab';
import OwnerReportsTab, { type ReportSubTab } from './OwnerReportsTab';
import PosTab from './PosTab';
import type { KpiComparisons, MetricComparison } from './OwnerDashTab';

type Range = 'today' | '7d' | '30d' | '12m' | 'custom';
type TabKey =
  | 'dashboard'
  | 'reports'
  | 'sales'
  | 'pos'
  | 'audit'
  | 'operations'
  | 'customers'
  | 'menu'
  | 'tables'
  | 'staff'
  | 'team'
  | 'previews'
  | 'settings';
type PreviewKey = 'manager' | 'kitchen' | 'waiter';

function isoDay(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

function defaultCustom(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: isoDay(from), to: isoDay(to) };
}

function rangeBoundsWithPrev(
  r: Range,
  custom: { from: string; to: string }
): { start: Date; end: Date; prevStart: Date; prevEnd: Date; compLabel: string } {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  if (r === 'today') {
    const s = new Date(now);
    s.setHours(0, 0, 0, 0);
    const prevS = new Date(s);
    prevS.setDate(prevS.getDate() - 1);
    const prevE = new Date(s);
    prevE.setMilliseconds(-1);
    return {
      start: s,
      end: endOfDay,
      prevStart: prevS,
      prevEnd: prevE,
      compLabel: 'vs yesterday',
    };
  }
  if (r === 'custom') {
    const s = new Date(custom.from + 'T00:00:00');
    const e = new Date(custom.to + 'T23:59:59');
    const dur = e.getTime() - s.getTime();
    const prevS = new Date(s.getTime() - dur);
    const prevE = new Date(s.getTime() - 1);
    return {
      start: s,
      end: e,
      prevStart: prevS,
      prevEnd: prevE,
      compLabel: 'vs prior period',
    };
  }
  const s = new Date(now);
  s.setHours(0, 0, 0, 0);
  let durDays = 7;
  let compLabel = 'vs prev 7 days';
  if (r === '7d') {
    durDays = 7;
    compLabel = 'vs prev 7 days';
    s.setDate(s.getDate() - 6);
  } else if (r === '30d') {
    durDays = 30;
    compLabel = 'vs prev 30 days';
    s.setDate(s.getDate() - 29);
  } else {
    durDays = 365;
    compLabel = 'vs prev year';
    s.setMonth(s.getMonth() - 12);
  }
  const prevS = new Date(s);
  prevS.setDate(prevS.getDate() - durDays);
  const prevE = new Date(s);
  prevE.setMilliseconds(-1);
  return {
    start: s,
    end: endOfDay,
    prevStart: prevS,
    prevEnd: prevE,
    compLabel,
  };
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
    if (hourly) {
      const h = d.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const num = h % 12 === 0 ? 12 : h % 12;
      return `${num} ${ampm}`;
    }
    if (monthly) return d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' });
    return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  };

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
    for (let h = 0; h < 24; h++) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const num = h % 12 === 0 ? 12 : h % 12;
      addBucket(`${num} ${ampm}`);
    }
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

interface NavItemDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavGroupDef {
  group: string;
  items: NavItemDef[];
}

export default function OwnerApp({
  restaurantId,
  slug,
  restaurantName,
  viewerId,
  viewerRole,
  viewerName = 'Owner',
}: {
  restaurantId: string;
  slug: string;
  restaurantName: string;
  viewerId: string;
  viewerRole: Role;
  viewerName?: string;
}) {
  const [lang, setLang] = useState<Lang>('english');
  const [logoUrl, setLogoUrl] = useState<string>('');

  useEffect(() => {
    let live = true;
    (async () => {
      const { data } = await createClient()
        .from('restaurants')
        .select('theme_config')
        .eq('id', restaurantId)
        .single();
      if (live && data?.theme_config) {
        const tc = data.theme_config as Record<string, unknown>;
        setLang(normalizeLang(tc.language));
        setLogoUrl(typeof tc.logo_url === 'string' ? tc.logo_url : '');
      }
    })();
    return () => {
      live = false;
    };
  }, [restaurantId]);

  return (
    <LangProvider value={lang}>
      <OwnerAppInner
        restaurantId={restaurantId}
        slug={slug}
        restaurantName={restaurantName}
        viewerId={viewerId}
        viewerRole={viewerRole}
        viewerName={viewerName}
        logoUrl={logoUrl}
      />
    </LangProvider>
  );
}

function OwnerAppInner({
  restaurantId,
  slug,
  restaurantName,
  viewerId,
  viewerRole,
  viewerName,
  logoUrl = '',
}: {
  restaurantId: string;
  slug: string;
  restaurantName: string;
  viewerId: string;
  viewerRole: Role;
  viewerName: string;
  logoUrl?: string;
}) {
  const t = useT();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [range, setRange] = useState<Range>('today');
  const [custom, setCustom] = useState(defaultCustom);
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('orders');
  const [preview, setPreview] = useState<PreviewKey>('manager');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const { start, end, prevStart, compLabel } = useMemo(
    () => rangeBoundsWithPrev(range, custom),
    [range, custom]
  );

  const ORDER_COLS =
    'id,order_number,table_id,waiter_id,order_type,status,total_amount,payment_method,cancel_reason,created_at,updated_at';
  const ITEM_COLS = 'id,order_id,menu_item_id,item_name,quantity,unit_price';

  const loadStatic = async () => {
    const supabase = createClient();
    const [{ data: s }, { data: c }, { data: m }, { data: tbls }, { data: rv }] = await Promise.all([
      supabase.from('profiles').select('*').eq('restaurant_id', restaurantId).order('created_at'),
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('display_order'),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('name'),
      supabase.from('tables').select('*').eq('restaurant_id', restaurantId).order('table_number'),
      supabase
        .from('reviews')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    if (tbls) setTables(tbls as DiningTable[]);
    if (s) setStaff(s as Profile[]);
    if (c) setCats(c as MenuCategory[]);
    if (m) setMenu(m as MenuItem[]);
    if (rv) setReviews(rv as Review[]);
  };

  const loadOrders = async (
    targetRange: Range,
    targetCustom: { from: string; to: string },
    showCenterSpinner: boolean
  ) => {
    const supabase = createClient();
    if (showCenterSpinner) setOrdersLoading(true);
    try {
      const bounds = rangeBoundsWithPrev(targetRange, targetCustom);
      const iso = bounds.prevStart.toISOString();
      const { data: o } = await supabase
        .from('orders')
        .select(ORDER_COLS)
        .eq('restaurant_id', restaurantId)
        .gte('created_at', iso)
        .order('created_at', { ascending: true })
        .limit(3000);
      const orderList = (o ?? []) as Order[];
      setOrders(orderList);

      let itemList: OrderItem[] = [];
      if (orderList.length > 0) {
        const ids = orderList.map((x) => x.id);
        const chunks: string[][] = [];
        for (let i = 0; i < ids.length; i += 500) chunks.push(ids.slice(i, i + 500));
        const results = await Promise.all(
          chunks.map((ch) => supabase.from('order_items').select(ITEM_COLS).in('order_id', ch))
        );
        for (const r of results) itemList = itemList.concat((r.data ?? []) as OrderItem[]);
      }
      setItems(itemList);
    } finally {
      if (showCenterSpinner) setOrdersLoading(false);
    }
  };

  const changeRange = (newRange: Range) => {
    setRange(newRange);
    try {
      window.localStorage.setItem('orderkar_owner_range', newRange);
    } catch {}
    loadOrders(newRange, custom, true);
  };

  useEffect(() => {
    let initialRange: Range = 'today';
    try {
      const saved = window.localStorage.getItem('orderkar_owner_range') as Range | null;
      if (saved && ['today', '7d', '30d', '12m', 'custom'].includes(saved)) {
        initialRange = saved;
        setRange(saved);
      }
    } catch {}
    setMounted(true);

    let live = true;
    setLoading(true);
    (async () => {
      await Promise.all([
        loadStatic(),
        loadOrders(initialRange, custom, false),
      ]);
      if (live) {
        setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const catName = useMemo(() => {
    const map = new Map<string, string>();
    const itemToCat = new Map<string, string>();
    for (const mi of menu) itemToCat.set(mi.id, mi.category_id);
    for (const c of cats) map.set(c.id, c.name);
    return { map, itemToCat };
  }, [cats, menu]);

  const itemOrderDate = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of orders) m.set(o.id, o.created_at);
    return m;
  }, [orders]);

  // Split current period vs previous period
  const currentOrders = useMemo(
    () => orders.filter((o) => new Date(o.created_at) >= start && new Date(o.created_at) <= end),
    [orders, start, end]
  );

  const prevOrders = useMemo(
    () => orders.filter((o) => new Date(o.created_at) >= prevStart && new Date(o.created_at) < start),
    [orders, prevStart, start]
  );

  const currentOrderIds = useMemo(() => new Set(currentOrders.map((o) => o.id)), [currentOrders]);
  const prevOrderIds = useMemo(() => new Set(prevOrders.map((o) => o.id)), [prevOrders]);

  const currentItems = useMemo(
    () => items.filter((i) => currentOrderIds.has(i.order_id)),
    [items, currentOrderIds]
  );

  const prevItems = useMemo(
    () => items.filter((i) => prevOrderIds.has(i.order_id)),
    [items, prevOrderIds]
  );

  const agg = useMemo(() => {
    const base = aggregate(currentOrders, currentItems, range, start, end);
    const catRev = new Map<string, number>();
    for (const i of currentItems) {
      const catId = i.menu_item_id ? catName.itemToCat.get(i.menu_item_id) : undefined;
      const name = (catId && catName.map.get(catId)) || 'Other';
      catRev.set(name, (catRev.get(name) ?? 0) + i.quantity * Number(i.unit_price));
    }
    base.cats = [...catRev.entries()]
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
    return base;
  }, [currentOrders, currentItems, catName, range, start, end]);

  // Dynamically calculate comparisons based on selected filter
  const comparisons: KpiComparisons = useMemo(() => {
    const calcDelta = (cur: number, prev: number, isInverse: boolean = false): MetricComparison => {
      const diff = cur - prev;
      if (cur === 0 && prev === 0) {
        return { text: `0% ${compLabel}`, isPositive: true, isNeutral: true };
      }
      let pct = 0;
      if (prev > 0) {
        pct = Math.round((diff / prev) * 100);
      } else if (cur > 0) {
        pct = 100;
      }
      const isPositive = isInverse ? diff <= 0 : diff >= 0;
      const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '•';
      const sign = diff > 0 ? '+' : '';
      return {
        text: `${arrow} ${sign}${pct}% ${compLabel}`,
        isPositive,
        isNeutral: diff === 0,
      };
    };

    const curDone = currentOrders.filter((o) => o.status !== 'cancelled');
    const prevDone = prevOrders.filter((o) => o.status !== 'cancelled');
    const curRev = curDone.reduce((s, o) => s + Number(o.total_amount), 0);
    const prevRev = prevDone.reduce((s, o) => s + Number(o.total_amount), 0);
    const curOrdersCount = curDone.length;
    const prevOrdersCount = prevDone.length;
    const curAov = curOrdersCount > 0 ? curRev / curOrdersCount : 0;
    const prevAov = prevOrdersCount > 0 ? prevRev / prevOrdersCount : 0;
    const curItemsQty = currentItems.reduce((s, i) => s + i.quantity, 0);
    const prevItemsQty = prevItems.reduce((s, i) => s + i.quantity, 0);

    const curCancels = currentOrders.filter((o) => o.status === 'cancelled');
    const prevCancels = prevOrders.filter((o) => o.status === 'cancelled');
    const curLost = curCancels.reduce((s, o) => s + Number(o.total_amount), 0);
    const prevLost = prevCancels.reduce((s, o) => s + Number(o.total_amount), 0);
    const curVoidRate = currentOrders.length > 0 ? (curCancels.length / currentOrders.length) * 100 : 0;
    const prevVoidRate = prevOrders.length > 0 ? (prevCancels.length / prevOrders.length) * 100 : 0;

    return {
      compLabel,
      revenue: calcDelta(curRev, prevRev),
      orders: calcDelta(curOrdersCount, prevOrdersCount),
      aov: calcDelta(curAov, prevAov),
      itemsSold: calcDelta(curItemsQty, prevItemsQty),
      net: calcDelta(curRev, prevRev),
      cancelled: calcDelta(curCancels.length, prevCancels.length, true),
      lost: calcDelta(curLost, prevLost, true),
      voidRate: calcDelta(curVoidRate, prevVoidRate, true),
    };
  }, [currentOrders, prevOrders, currentItems, prevItems, compLabel]);

  const cancelledCount = useMemo(
    () => currentOrders.filter((o) => o.status === 'cancelled').length,
    [currentOrders]
  );

  const logout = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Categorized Navigation
  const NAV_GROUPS: NavGroupDef[] = [
    {
      group: 'Analytics & Revenue',
      items: [
        {
          key: 'dashboard',
          label: 'Executive Overview',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
          ),
        },
        {
          key: 'reports',
          label: 'Detailed Reports',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
        },
        {
          key: 'sales',
          label: 'Sales & Transactions',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
        },
        {
          key: 'audit',
          label: 'Loss & Risk Audit',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ),
          badge: cancelledCount > 0 ? String(cancelledCount) : undefined,
        },
      ],
    },
    {
      group: 'Live Operations',
      items: [
        {
          key: 'pos',
          label: 'Sales & POS',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
              <circle cx="6" cy="15" r="1" />
              <circle cx="10" cy="15" r="1" />
            </svg>
          ),
          badge: 'Live',
        },
        {
          key: 'operations',
          label: 'Kitchen & Speed',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          ),
        },
        {
          key: 'tables',
          label: 'Tables & Floor',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          ),
          badge: tables.length > 0 ? `${tables.filter((x) => x.is_active).length}` : undefined,
        },
        {
          key: 'menu',
          label: 'Menu Catalog',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          ),
        },
        {
          key: 'customers',
          label: 'Customer Reviews',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ),
          badge: reviews.length > 0 ? String(reviews.length) : undefined,
        },
      ],
    },
    {
      group: 'Team Management',
      items: [
        {
          key: 'staff',
          label: 'Staff Ranking',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          ),
        },
        {
          key: 'team',
          label: 'Team Roles & Access',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
      ],
    },
    {
      group: 'System & Tools',
      items: [
        {
          key: 'previews',
          label: 'Role Previews',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ),
        },
        {
          key: 'settings',
          label: 'Restaurant Settings',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ),
        },
      ],
    },
  ];

  const currentTabTitle = useMemo(() => {
    for (const g of NAV_GROUPS) {
      for (const item of g.items) {
        if (item.key === tab) return item.label;
      }
    }
    return 'Dashboard';
  }, [tab]);

  const selectTab = (k: TabKey, sub?: ReportSubTab) => {
    setTab(k);
    if (sub) setReportSubTab(sub);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen w-full bg-page">
      {/* ── 1. LEFT SLEEK SIDEBAR DOCK ── */}
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[var(--c-surface)] backdrop-blur-2xl transition-all duration-300 lg:sticky lg:top-0 lg:h-screen ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-[272px]'
        } ${mobileMenuOpen ? 'w-[272px] translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Sidebar Header: Logo & Restaurant Brand */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <Logo size={36} />
            {(!collapsed || mobileMenuOpen) && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-display text-[15px] font-black text-ink">{displayName}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-ok animate-live-pulse" />
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-ok">Live Sync</span>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden h-7 w-7 items-center justify-center rounded-lg border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink lg:flex transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-soft hover:text-ink lg:hidden"
          >
            ✕
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <div className="no-scrollbar flex-1 overflow-y-auto px-3 py-3.5 space-y-3.5">
          {NAV_GROUPS.map((group) => (
            <div key={group.group}>
              {(!collapsed || mobileMenuOpen) && (
                <div className="mb-1.5 mt-2.5 px-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted/80">
                    {group.group}
                  </p>
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = tab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => selectTab(item.key)}
                      title={collapsed && !mobileMenuOpen ? item.label : undefined}
                      className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-sans transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-r from-brand/15 via-brand/10 to-brand/5 text-brand font-bold border border-brand/20 shadow-xs'
                          : 'text-ink/80 font-medium hover:bg-soft/70 hover:text-ink'
                      } ${collapsed && !mobileMenuOpen ? 'justify-center px-0 py-2.5' : ''}`}
                    >
                      <span
                        className={`transition-colors shrink-0 ${
                          active ? 'text-brand' : 'text-muted group-hover:text-ink'
                        }`}
                      >
                        {item.icon}
                      </span>

                      {(!collapsed || mobileMenuOpen) && (
                        <>
                          <span className="truncate">{item.label}</span>

                          {item.badge ? (
                            <span
                              className={`ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                                active
                                  ? 'bg-brand/20 text-brand'
                                  : 'bg-soft text-muted border border-line'
                              }`}
                            >
                              {item.badge}
                            </span>
                          ) : active ? (
                            <svg
                              className="ml-auto h-3.5 w-3.5 text-brand shrink-0 transition-transform duration-200"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          ) : null}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Footer: Profile, Theme, Logout */}
        <div className="border-t border-line bg-[var(--c-surface-solid)]/40 p-3">
          {(!collapsed || mobileMenuOpen) ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-[14px] border border-line bg-[var(--c-surface-solid)] p-2.5 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-teal text-[13px] font-black text-white shadow-sm">
                    {viewerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-extrabold text-ink">{viewerName}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand">
                      {viewerRole.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <ThemeToggle />
              </div>

              <button
                onClick={logout}
                className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-line bg-[var(--c-surface-solid)] py-2 text-[12px] font-extrabold text-muted transition-all hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30 shadow-xs"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ThemeToggle />
              <button
                onClick={logout}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                title="Log out"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── 2. MAIN FULL-SCREEN APPLICATION CANVAS ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Utility Command Bar */}
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-line bg-[var(--c-surface)] px-4 sm:px-6 lg:px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-[var(--c-surface-solid)] text-ink lg:hidden shadow-sm"
              aria-label="Open Navigation Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Breadcrumb & Section Name */}
            <div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-block text-[11px] font-extrabold uppercase tracking-wider text-muted">
                  Owner Portal &middot;
                </span>
                <h1 className="font-display text-[19px] sm:text-[21px] font-black tracking-tight text-ink truncate">
                  {currentTabTitle}
                </h1>
              </div>
            </div>
          </div>

          {/* Top Actions: Range Filter & Analytics Guide */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* Mobile Range Select Dropdown */}
            <div className="sm:hidden">
              <select
                value={mounted ? range : 'today'}
                onChange={(e) => changeRange(e.target.value as Range)}
                className="rounded-xl border border-line bg-[var(--c-surface-solid)] px-2.5 py-1.5 text-[12px] font-black text-ink outline-none"
              >
                <option value="today">⚡ Today</option>
                <option value="7d">📅 7D</option>
                <option value="30d">📊 30D</option>
                <option value="12m">🗓️ 12M</option>
                <option value="custom">⚙️ Custom</option>
              </select>
            </div>

            {/* Desktop Range Segmented Buttons */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-[16px] border border-line bg-[var(--c-surface-solid)] p-1.5 shadow-sm">
              {[
                { key: 'today', label: 'Today', icon: '⚡' },
                { key: '7d', label: '7D', icon: '📅' },
                { key: '30d', label: '30D', icon: '📊' },
                { key: '12m', label: '12M', icon: '🗓️' },
                { key: 'custom', label: 'Custom', icon: '⚙️' },
              ].map((r) => {
                const active = mounted ? range === r.key : r.key === 'today';
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => changeRange(r.key as Range)}
                    className={`inline-flex items-center gap-1.5 rounded-[11px] px-3.5 py-1.5 text-[13px] font-black transition-all ${
                      active
                        ? 'bg-brand text-white shadow-lift ring-1 ring-brand/40'
                        : 'text-ink/80 hover:text-ink hover:bg-soft'
                    }`}
                  >
                    <span className="text-[13px]">{r.icon}</span>
                    <span>{r.label}</span>
                  </button>
                );
              })}
            </div>

            <OwnerGuide />
          </div>
        </header>

        {/* Full-Center Screen Refresh Loading Indicator */}
        {ordersLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-xs transition-all animate-in fade-in duration-150">
            <div className="flex flex-col items-center gap-3.5 rounded-[24px] border border-line bg-[var(--c-surface-solid)]/95 px-8 py-6 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand shadow-inner">
                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-display text-[15px] font-black text-ink">{t('own_updating')}</p>
                <p className="text-[12px] font-semibold text-muted">Refreshing analytical data...</p>
              </div>
            </div>
          </div>
        )}

        {/* Custom Date Range Popdown on Mobile / Desktop */}
        {range === 'custom' && (
          <div className="border-b border-line bg-[var(--c-surface-solid)] px-6 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-bold">
              <span className="text-muted">Custom Window:</span>
              <div className="flex items-center gap-1.5 rounded-[10px] border border-line bg-soft/60 px-3 py-1">
                <input
                  type="date"
                  value={custom.from}
                  max={custom.to}
                  onChange={(e) => {
                    const next = { ...custom, from: e.target.value };
                    setCustom(next);
                    if (range === 'custom') loadOrders('custom', next, true);
                  }}
                  className="bg-transparent text-ink font-mono text-[12px] outline-none"
                />
                <span className="text-muted px-1">→</span>
                <input
                  type="date"
                  value={custom.to}
                  min={custom.from}
                  onChange={(e) => {
                    const next = { ...custom, to: e.target.value };
                    setCustom(next);
                    if (range === 'custom') loadOrders('custom', next, true);
                  }}
                  className="bg-transparent text-ink font-mono text-[12px] outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Edge-to-Edge Canvas Content */}
        <main className={`flex-1 w-full px-4 sm:px-6 lg:px-8 ${tab === 'pos' ? 'pt-2.5 pb-2 space-y-0 lg:h-[calc(100vh-64px)] lg:overflow-hidden' : 'pt-3.5 pb-8 sm:pt-4 sm:pb-8 space-y-6'}`}>
          {loading ? (
            <Card className="p-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                  <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <h3 className="mt-4 font-display text-lg font-black text-ink">{t('own_crunching')}</h3>
              <p className="mt-1 text-sm text-muted">Aggregating live table telemetry, kitchen tickets, and revenue stats...</p>
            </Card>
          ) : (
            <>
              {/* 1. Dashboard Overview */}
              <div className={tab === 'dashboard' ? '' : 'hidden'}>
                <OwnerDashTab
                  agg={agg}
                  orders={currentOrders}
                  items={currentItems}
                  staff={staff}
                  itemOrderDate={itemOrderDate}
                  slug={slug}
                  tables={tables}
                  restaurantName={displayName}
                  comparisons={comparisons}
                  onNavigate={selectTab}
                />
              </div>

              {/* 2. Detailed Reports Hub */}
              <div className={tab === 'reports' ? '' : 'hidden'}>
                <OwnerReportsTab
                  orders={currentOrders}
                  items={currentItems}
                  tables={tables}
                  staff={staff}
                  categories={cats}
                  menu={menu}
                  rangeLabel={t(RANGE_KEYS[range])}
                  restaurantName={displayName}
                  logoUrl={logoUrl}
                  activeSubTab={reportSubTab}
                  onSubTabChange={setReportSubTab}
                />
              </div>

              {/* 3. Sales Tab */}
              <div className={tab === 'sales' ? '' : 'hidden'}>
                <OwnerSalesTab
                  orders={currentOrders}
                  items={currentItems}
                  hours={agg.hours}
                  weekdays={agg.weekdays}
                  topItems={agg.topItems}
                  rangeLabel={t(RANGE_KEYS[range])}
                  restaurantName={displayName}
                  logoUrl={logoUrl}
                />
              </div>

              {/* 3. Loss Prevention & Risk Audit Tab */}
              <div className={tab === 'audit' ? '' : 'hidden'}>
                <OwnerAuditTab
                  orders={currentOrders}
                  staff={staff}
                  rangeLabel={t(RANGE_KEYS[range])}
                />
              </div>

              {/* 3.5 Dedicated Sales & POS Section */}
              <div className={tab === 'pos' ? 'h-full flex flex-col' : 'hidden'}>
                {tab === 'pos' && (
                  <PosTab
                    restaurantId={restaurantId}
                    restaurant={{ name: displayName }}
                    tables={tables}
                    orders={currentOrders}
                    onOrderPlaced={() => loadOrders(range, custom, false)}
                  />
                )}
              </div>

              {/* 4. Operations Tab */}
              <div className={tab === 'operations' ? '' : 'hidden'}>
                <OwnerOpsTab restaurantId={restaurantId} orders={currentOrders} tables={tables} />
              </div>

              {/* 4. Customer Reviews Tab */}
              <div className={tab === 'customers' ? '' : 'hidden'}>
                <OwnerCustomersTab reviews={reviews} />
              </div>

              {/* 5. Menu Section */}
              <div className={tab === 'menu' ? '' : 'hidden'}>
                {tab === 'menu' && (
                  <div className="space-y-4">
                    <div className="mb-2">
                      <h2 className="font-display text-xl font-extrabold text-ink">Menu & Dishes Catalog</h2>
                      <p className="text-sm text-muted">Manage items, categories, pricing, photos, and dish availability</p>
                    </div>
                    <MenuSection restaurantId={restaurantId} />
                  </div>
                )}
              </div>

              {/* 6. Tables & Floor Plan */}
              <div className={tab === 'tables' ? '' : 'hidden'}>
                <TableManager
                  restaurantId={restaurantId}
                  slug={slug}
                  tables={tables}
                  onChange={setTables}
                />
              </div>

              {/* 7. Staff Performance Leaderboard */}
              <div className={tab === 'staff' ? '' : 'hidden'}>
                <OwnerStaffTab orders={currentOrders} staff={staff} />
              </div>

              {/* 8. Team Accounts & Permissions */}
              <div className={tab === 'team' ? '' : 'hidden'}>
                {tab === 'team' && (
                  <div className="space-y-4">
                    <div className="mb-2">
                      <h2 className="font-display text-xl font-extrabold text-ink">Team Access & Roles</h2>
                      <p className="text-sm text-muted">Create employee logins, assign PIN codes, and grant staff permissions</p>
                    </div>
                    <TeamManager restaurantId={restaurantId} meId={viewerId} myRole={viewerRole} />
                  </div>
                )}
              </div>

              {/* 9. Live Previews of Staff Roles */}
              <div className={tab === 'previews' ? '' : 'hidden'}>
                <div className="space-y-6">
                  <div className="rounded-[20px] border border-line bg-[var(--c-surface)] p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h2 className="font-display text-lg font-extrabold text-ink">
                          Role Emulation & Screen Previews
                        </h2>
                        <p className="text-sm text-muted">
                          Inspect live POS, kitchen display, or waiter mobile interfaces in real-time
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 rounded-[14px] border border-line bg-[var(--c-surface-solid)] p-1 shadow-sm">
                        {[
                          { key: 'manager', label: 'Manager Hub', icon: '🧑‍💼' },
                          { key: 'kitchen', label: 'Kitchen KDS', icon: '👨‍🍳' },
                          { key: 'waiter', label: 'Waiter App', icon: '🤵' },
                        ].map((p) => (
                          <button
                            key={p.key}
                            onClick={() => setPreview(p.key as PreviewKey)}
                            className={`inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-1.5 text-[13px] font-extrabold transition-all ${
                              preview === p.key
                                ? 'bg-brand text-white shadow-lift'
                                : 'text-muted hover:text-ink hover:bg-soft'
                            }`}
                          >
                            <span>{p.icon}</span>
                            <span>{p.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

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
              </div>

              {/* 10. Owner Settings */}
              <div className={tab === 'settings' ? '' : 'hidden'}>
                <OwnerSettings
                  restaurantId={restaurantId}
                  slug={slug}
                  onNameChange={setDisplayName}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
