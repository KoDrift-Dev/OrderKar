'use client';

// Owner dashboard: Full-Screen Enterprise Software Architecture with
// fixed Left Sleek Sidebar, top command utility bar, categorized navigation,
// and edge-to-edge responsive canvas.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import KitchenApp from './KitchenApp';
import WaiterApp from './WaiterApp';
import MenuSection from './MenuSection';
import TeamManager from './TeamManager';
import OwnerAuditTab from './OwnerAuditTab';
import OwnerReportsTab, { type ReportSubTab } from './OwnerReportsTab';
import OwnerInventoryTab from './OwnerInventoryTab';
import OwnerHistoryTab from './OwnerHistoryTab';
import SupplierManager from './SupplierManager';
import PurchaseOrderManager from './PurchaseOrderManager';
import OwnerFoodCostTab from './OwnerFoodCostTab';
import PosTab from './PosTab';
import { useSectionData, RANGE_KEYS, type Range } from './useRangeAnalytics';

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
  | 'inventory'
  | 'foodcost'
  | 'staff'
  | 'team'
  | 'previews'
  | 'history'
  | 'settings';
type PreviewKey = 'kitchen' | 'waiter';


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

  // Per-section ranges — NO global page filter. Each section owns its own.
  const [dashRange, setDashRange] = useState<Range>('today');
  const [salesRange, setSalesRange] = useState<Range>('today');
  const [reportsRange, setReportsRange] = useState<Range>('today');
  const [staffRange, setStaffRange] = useState<Range>('7d');
  const [auditRange, setAuditRange] = useState<Range>('7d');
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [reportSubTab, setReportSubTab] = useState<ReportSubTab>('orders');
  const [preview, setPreview] = useState<PreviewKey>('kitchen');
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
  const [ordersTruncated, setOrdersTruncated] = useState(false);
  type InvAlert = { id: string; name: string; kind: 'out' | 'low' | 'expiry'; detail: string };
  const [alerts, setAlerts] = useState<InvAlert[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [invSub, setInvSub] = useState<'stock' | 'suppliers' | 'pos'>('stock');
  const [displayName, setDisplayName] = useState(restaurantName);

  const ORDER_COLS =
    'id,order_number,table_id,waiter_id,order_type,status,total_amount,payment_status,payment_method,cancel_reason,notes,customer_name,created_at,updated_at';
  const ITEM_COLS = 'id,order_id,menu_item_id,item_name,quantity,unit_price,notes';

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

  // Fixed fetch window: last 61 days. Every section filters its own range
  // locally via useSectionData — no refetch needed when a section changes range.
  // Lightweight alert feed for the notification bell: out-of-stock,
  // low-stock (<= par) and expiring (<= 7 days or past) inventory items.
  const loadAlerts = async () => {
    try {
      const { data } = await createClient()
        .from('inventory_items')
        .select('id, name, unit, current_stock, par_level, expiry_date')
        .eq('restaurant_id', restaurantId)
        .limit(200);
      const out: InvAlert[] = [];
      const now = new Date();
      for (const r of (data ?? []) as Array<{
        id: string; name: string; unit: string | null;
        current_stock: number | string | null; par_level: number | string | null;
        expiry_date: string | null;
      }>) {
        const stock = Number(r.current_stock ?? 0);
        const par = Number(r.par_level ?? 0);
        const unit = r.unit || 'pcs';
        if (stock <= 0) {
          out.push({ id: r.id, name: r.name, kind: 'out', detail: `Out of stock` });
          continue;
        }
        if (par > 0 && stock <= par) {
          out.push({ id: r.id, name: r.name, kind: 'low', detail: `${stock} ${unit} left (par ${par})` });
        }
        if (r.expiry_date) {
          const days = Math.ceil((new Date(r.expiry_date).getTime() - now.getTime()) / 86400000);
          if (days < 0) out.push({ id: r.id + ':exp', name: r.name, kind: 'expiry', detail: `Expired ${-days}d ago` });
          else if (days <= 7) out.push({ id: r.id + ':exp', name: r.name, kind: 'expiry', detail: `Expires in ${days}d` });
        }
      }
      setAlerts(out.slice(0, 30));
    } catch {
      /* alerts are best-effort */
    }
  };

  const loadOrders = async (showCenterSpinner: boolean) => {
    const supabase = createClient();
    if (showCenterSpinner) setOrdersLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - 61);
      const iso = since.toISOString();
      const { data: o } = await supabase
        .from('orders')
        .select(ORDER_COLS)
        .eq('restaurant_id', restaurantId)
        .gte('created_at', iso)
        .order('created_at', { ascending: true })
        .limit(3000);
      const orderList = (o ?? []) as Order[];
      setOrders(orderList);
      // The 61-day fetch is capped at 3000 rows — warn instead of silently
      // dropping older orders from every report on this page.
      setOrdersTruncated(orderList.length >= 3000);

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

  // Ref shared with the realtime channel (always calls the latest loader).
  const loadOrdersRef = useRef<() => Promise<void>>(async () => {});
  loadOrdersRef.current = () => loadOrders(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    (async () => {
      await Promise.all([loadStatic(), loadOrders(false), loadAlerts()]);
      if (live) {
        setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // ── Realtime: orders / order_items / tables → silent refresh, no page reload. ──
  // Debounced so rapid kitchen status taps don't refetch-storm.
  // NOTE: postgres_changes only fires for tables in the supabase_realtime
  // publication (see supabase/realtime.sql). The heartbeat below is a safety
  // net: a cheap 1-row poll that triggers a full reload if anything changed.
  useEffect(() => {
    const supabase = createClient();
    let timer: number | undefined;
    let beat: number | undefined;
    let lastBeat = '';
    const reload = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        loadOrdersRef.current();
      }, 400);
    };
    const heartbeat = async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('updated_at')
          .eq('restaurant_id', restaurantId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const stamp = (data as { updated_at?: string } | null)?.updated_at ?? '';
        if (!stamp) return;
        if (lastBeat && stamp !== lastBeat) reload();
        lastBeat = stamp;
      } catch {
        /* silent — next beat retries */
      }
    };
    const reloadTables = async () => {
      const { data } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('table_number');
      if (data) setTables(data as DiningTable[]);
    };
    const ch = supabase
      .channel(`owner-live-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        reload
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, reload)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables', filter: `restaurant_id=eq.${restaurantId}` },
        reloadTables
      )
      .subscribe();
    beat = window.setInterval(heartbeat, 5000);
    heartbeat();
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(beat);
      supabase.removeChannel(ch);
    };
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

  // Per-section analytics — each section filters its own range (no global filter).
  const dash = useSectionData(orders, items, catName, dashRange);
  const sales = useSectionData(orders, items, catName, salesRange);
  const reports = useSectionData(orders, items, catName, reportsRange);
  const staffSec = useSectionData(orders, items, catName, staffRange);
  const auditSec = useSectionData(orders, items, catName, auditRange);

  // Live operational orders (any date) — drives table states, kitchen counts, badges.
  const activeOrders = useMemo(
    () => orders.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status)),
    [orders]
  );
  const activeOrderIds = useMemo(() => new Set(activeOrders.map((o) => o.id)), [activeOrders]);
  const activeItems = useMemo(
    () => items.filter((i) => activeOrderIds.has(i.order_id)),
    [items, activeOrderIds]
  );

  const cancelledCount = useMemo(
    () => auditSec.currentOrders.filter((o) => o.status === 'cancelled').length,
    [auditSec]
  );

  const logout = async () => {
    await createClient().auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const activeOrdersCount = activeOrders.length;

  // Restora-aligned Clean Navigation
  const NAV_GROUPS: NavGroupDef[] = [
    {
      group: 'Core Operations',
      items: [
        {
          key: 'dashboard',
          label: 'Dashboard',
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
          key: 'sales',
          label: 'Orders',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          ),
          badge: activeOrdersCount > 0 ? String(activeOrdersCount) : undefined,
        },
        {
          key: 'tables',
          label: 'Tables',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
          ),
        },
        {
          key: 'operations',
          label: 'Kitchen',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          ),
        },
        {
          key: 'inventory',
          label: 'Inventory',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
          ),
        },
        {
          key: 'menu',
          label: 'Menu',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
            </svg>
          ),
        },
        {
          key: 'pos',
          label: 'Sales & POS',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
        },
        {
          key: 'staff',
          label: 'Staff',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        {
          key: 'reports',
          label: 'Reports',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          ),
        },
        {
          key: 'settings',
          label: 'Settings',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          ),
        },
      ],
    },
    {
      group: 'Management & Tools',
      items: [
        {
          key: 'audit',
          label: 'Loss & Risk Audit',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            </svg>
          ),
          badge: cancelledCount > 0 ? String(cancelledCount) : undefined,
        },
        {
          key: 'history',
          label: 'Tracking History',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v5h5" />
              <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
              <path d="M12 7v5l4 2" />
            </svg>
          ),
        },
        {
          key: 'foodcost',
          label: 'Food Cost',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="5" x2="5" y2="19" />
              <circle cx="6.5" cy="6.5" r="2.5" />
              <circle cx="17.5" cy="17.5" r="2.5" />
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
        {
          key: 'team',
          label: 'Team Permissions',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
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

      {/* ── 1. LEFT SLEEK SIDEBAR DOCK (Restora Layout) ── */}
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 lg:right-auto lg:left-0 z-50 flex flex-col bg-[#141122] dark:bg-[#0d0a17] text-white border-r border-white/10 transition-all duration-300 lg:sticky lg:top-0 lg:h-screen ${
          collapsed ? 'lg:w-[76px]' : 'lg:w-[264px]'
        } ${mobileMenuOpen ? 'w-[264px] translate-x-0 shadow-2xl' : 'translate-x-full lg:translate-x-0'}`}
      >
        {/* Sidebar Header: Logo & Restora/OrderKar Brand */}
        <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-3 overflow-hidden">
            <Logo size={38} />
            {(!collapsed || mobileMenuOpen) && (
              <div className="min-w-0">
                <p className="truncate font-display text-[17px] font-black tracking-tight text-white leading-tight">
                  OrderKar
                </p>
                <p className="mt-0.5 text-[10px] font-extrabold tracking-wider text-white/50 uppercase">
                  Manage &bull; Serve &bull; Grow
                </p>
              </div>
            )}
          </div>

          {/* Desktop Collapse Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-white/70 hover:text-white lg:flex transition-colors"
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/[0.1] hover:text-white lg:hidden"
          >
            ✕
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <div className="no-scrollbar flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.group}>
              {(!collapsed || mobileMenuOpen) && (
                <div className="mb-2 px-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/40">
                    {group.group}
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const active = tab === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => selectTab(item.key)}
                      title={collapsed && !mobileMenuOpen ? item.label : undefined}
                      className={`group flex w-full items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-[13.5px] transition-all duration-200 ${
                        active
                          ? 'bg-gradient-to-r from-brand to-brand-deep text-white font-black shadow-[0_4px_16px_rgba(109,40,217,0.35)]'
                          : 'text-white/65 font-medium hover:bg-white/[0.07] hover:text-white'
                      } ${collapsed && !mobileMenuOpen ? 'justify-center px-0 py-3' : ''}`}
                    >
                      <span
                        className={`transition-colors shrink-0 ${
                          active ? 'text-white' : 'text-white/70 group-hover:text-white'
                        }`}
                      >
                        {item.icon}
                      </span>

                      {(!collapsed || mobileMenuOpen) && (
                        <>
                          <span className="truncate">{item.label}</span>

                          {item.badge ? (
                            <span
                              className={`ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                                active
                                  ? 'bg-white/20 text-white'
                                  : 'bg-amber-500 text-white shadow-xs'
                              }`}
                            >
                              {item.badge}
                            </span>
                          ) : active ? (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white shrink-0" />
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

        {/* Sidebar Footer: Tenant Profile Card */}
        <div className="border-t border-white/10 bg-white/[0.02] p-3">
          {(!collapsed || mobileMenuOpen) ? (
            <div className="space-y-2">
              {/* Tenant Restaurant Info Card (matching Restora bottom bar) */}
              <div
                onClick={() => selectTab('settings')}
                className="group flex cursor-pointer items-center justify-between rounded-[16px] border border-white/10 bg-white/[0.05] p-3 transition-all hover:bg-white/[0.1] hover:border-white/20"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-amber-500 to-orange-600 text-white text-base shadow-sm">
                    🍽️
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold text-white leading-tight">
                      {displayName}
                    </p>
                    <p className="text-[10.5px] font-medium text-white/50 truncate">
                      Main Branch
                    </p>
                  </div>
                </div>
                <span className="text-white/40 group-hover:text-white text-sm transition-transform group-hover:translate-x-0.5">
                  &rsaquo;
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <button
                onClick={() => selectTab('settings')}
                className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white/[0.06] text-white/70 hover:text-white"
                title={displayName}
              >
                🍽️
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── 2. MAIN FULL-SCREEN APPLICATION CANVAS ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Utility Command Bar (Restora Topbar Layout) */}
        <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center justify-between border-b border-line bg-[var(--c-surface)] px-4 sm:px-6 lg:px-8 backdrop-blur-xl gap-3">
          {/* Left: Search Bar (Search orders, tables, menu...) */}
          <div className="flex items-center gap-3 min-w-0 flex-1 max-w-md">
            <div className="relative w-full">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm">
                🔍
              </span>
              <input
                type="text"
                name="orderkar-global-search"
                id="orderkar-global-search"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                readOnly
                onFocus={(e) => e.currentTarget.removeAttribute('readOnly')}
                onBlur={(e) => e.currentTarget.setAttribute('readOnly', '')}
                placeholder="Search orders, tables, menu..."
                aria-label="Search orders, tables, menu"
                className="w-full rounded-full border border-line/70 bg-soft/60 pl-9 pr-4 py-2 text-[12.5px] font-medium text-ink outline-none transition-all placeholder:text-muted/70 hover:bg-soft focus:border-brand/50 focus:bg-[var(--c-surface-solid)] focus:ring-2 focus:ring-brand/20 shadow-2xs"
              />
            </div>
          </div>

          {/* Right Actions: Notification Bell, Profile Capsule, Range Selector, Theme */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Notification Bell with Red Badge Dot */}
            <div className="relative">
              <button
                onClick={() => {
                  setBellOpen((v) => !v);
                  loadAlerts();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink hover:border-brand/40 transition-colors shadow-2xs relative"
                aria-label="Notifications"
                aria-expanded={bellOpen}
                title="Notifications"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </svg>
                {alerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-[var(--c-surface-solid)]">
                    {alerts.length > 9 ? '9+' : alerts.length}
                  </span>
                )}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} aria-hidden />
                  <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-[var(--c-surface-solid)] shadow-2xl">
                    <div className="flex items-center justify-between border-b border-line px-4 py-3">
                      <p className="text-[13px] font-extrabold text-ink">Stock Alerts</p>
                      <button
                        onClick={() => {
                          setBellOpen(false);
                          selectTab('inventory');
                        }}
                        className="text-[11.5px] font-bold text-brand hover:underline"
                      >
                        View inventory
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-2">
                      {alerts.length === 0 ? (
                        <p className="px-3 py-6 text-center text-[12.5px] text-muted">
                          All clear — no stock or expiry alerts. 🎉
                        </p>
                      ) : (
                        alerts.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => {
                              setBellOpen(false);
                              selectTab('inventory');
                            }}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-soft"
                          >
                            <span aria-hidden>{a.kind === 'out' ? '🔴' : a.kind === 'low' ? '🟡' : '⏳'}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12.5px] font-bold text-ink">{a.name}</span>
                              <span className="block text-[11px] text-muted">{a.detail}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Profile Capsule (Ahmed Hassan, Restaurant Manager) */}
            <div className="flex items-center gap-2.5 rounded-full border border-line bg-[var(--c-surface-solid)] pl-1.5 pr-3 py-1 shadow-2xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-amber-500 text-[12.5px] font-black text-white shadow-xs">
                {viewerName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left min-w-0">
                <p className="truncate text-[12.5px] font-extrabold text-ink leading-tight">{viewerName}</p>
                <p className="text-[10px] font-bold text-muted capitalize truncate">
                  {viewerRole === 'owner' ? 'Restaurant Manager' : viewerRole.replace('_', ' ')}
                </p>
              </div>
              {/* Dropdown Chevron */}
              <button
                onClick={logout}
                title="Log out"
                className="text-muted hover:text-rose-600 transition-colors pl-0.5 text-xs font-bold"
              >
                &or;
              </button>
            </div>

            <ThemeToggle />

            {/* Mobile Navigation Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-[var(--c-surface-solid)] text-ink lg:hidden shadow-2xs active:scale-95 transition-all hover:bg-soft"
              aria-label="Open Navigation Menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </header>
          {ordersTruncated && (
            <div className="mx-4 sm:mx-6 lg:mx-8 mt-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[12.5px] font-medium text-amber-700 dark:text-amber-300">
              <span aria-hidden>⚠️</span>
              <span>
                Showing the most recent 3,000 orders only — older orders in the
                61-day window are hidden. Use a shorter date range in each
                section for complete figures.
              </span>
            </div>
          )}

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
                  restaurantId={restaurantId}
                  agg={dash.agg}
                  orders={dash.currentOrders}
                  items={dash.currentItems}
                  staff={staff}
                  itemOrderDate={itemOrderDate}
                  slug={slug}
                  tables={tables}
                  restaurantName={displayName}
                  comparisons={dash.comparisons}
                  onNavigate={selectTab}
                  viewerName={viewerName}
                  viewerRole={viewerRole}
                  range={dashRange}
                  onRangeChange={setDashRange}
                />
              </div>

              {/* 2. Detailed Reports Hub */}
              <div className={tab === 'reports' ? '' : 'hidden'}>
                <OwnerReportsTab
                  orders={reports.currentOrders}
                  items={reports.currentItems}
                  tables={tables}
                  staff={staff}
                  categories={cats}
                  menu={menu}
                  rangeLabel={t(RANGE_KEYS[reportsRange])}
                  restaurantName={displayName}
                  logoUrl={logoUrl}
                  activeSubTab={reportSubTab}
                  onSubTabChange={setReportSubTab}
                  range={reportsRange}
                  onRangeChange={setReportsRange}
                  restaurantId={restaurantId}
                  reviews={reviews}
                />
              </div>

              {/* 3. Sales Tab */}
              <div className={tab === 'sales' ? '' : 'hidden'}>
                <OwnerSalesTab
                  restaurantId={restaurantId}
                  orders={sales.currentOrders}
                  items={sales.currentItems}
                  tables={tables}
                  hours={sales.agg.hours}
                  weekdays={sales.agg.weekdays}
                  topItems={sales.agg.topItems}
                  rangeLabel={t(RANGE_KEYS[salesRange])}
                  restaurantName={displayName}
                  logoUrl={logoUrl}
                  menu={menu}
                  staff={staff}
                  onNavigate={selectTab}
                  onRefresh={() => loadOrders(false)}
                  range={salesRange}
                  onRangeChange={setSalesRange}
                />
              </div>

              {/* 3. Loss Prevention & Risk Audit Tab */}
              <div className={tab === 'audit' ? '' : 'hidden'}>
                <OwnerAuditTab
                  orders={auditSec.currentOrders}
                  staff={staff}
                  rangeLabel={t(RANGE_KEYS[auditRange])}
                  range={auditRange}
                  onRangeChange={setAuditRange}
                />
              </div>

              {/* 3.4 Tracking History (audit trail) */}
              <div className={tab === 'history' ? '' : 'hidden'}>
                {tab === 'history' && <OwnerHistoryTab restaurantId={restaurantId} />}
              </div>

              {/* 3.5 Dedicated Sales & POS Section */}
              <div className={tab === 'pos' ? 'h-full flex flex-col' : 'hidden'}>
                {tab === 'pos' && (
                  <PosTab
                    restaurantId={restaurantId}
                    restaurant={{ name: displayName }}
                    tables={tables}
                    orders={activeOrders}
                    onOrderPlaced={() => loadOrders(false)}
                  />
                )}
              </div>

              {/* 4. Operations Tab */}
              <div className={tab === 'operations' ? '' : 'hidden'}>
                <OwnerOpsTab
                  restaurantId={restaurantId}
                  orders={orders}
                  activeOrders={activeOrders}
                  tables={tables}
                  staff={staff}
                />
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
                  orders={activeOrders}
                  items={activeItems}
                  staff={staff}
                  onChange={setTables}
                  onNavigate={selectTab}
                />
              </div>

              {/* 6b. Inventory: Stock | Suppliers | Purchase Orders */}
              <div className={tab === 'inventory' ? '' : 'hidden'}>
                <div className="mb-4 flex flex-wrap gap-2">
                  {(
                    [
                      { key: 'stock', label: '📦 Stock' },
                      { key: 'suppliers', label: '🚚 Suppliers' },
                      { key: 'pos', label: '🧾 Purchase Orders' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setInvSub(t.key)}
                      className={`rounded-full px-4 py-2 text-[12.5px] font-bold transition-all ${
                        invSub === t.key
                          ? 'bg-brand text-white shadow-md'
                          : 'border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {invSub === 'stock' && <OwnerInventoryTab restaurantId={restaurantId} />}
                {invSub === 'suppliers' && <SupplierManager restaurantId={restaurantId} />}
                {invSub === 'pos' && <PurchaseOrderManager restaurantId={restaurantId} />}
              </div>

              {/* 6c. Food Cost & Profit */}
              <div className={tab === 'foodcost' ? '' : 'hidden'}>
                <OwnerFoodCostTab
                  restaurantId={restaurantId}
                  orders={orders}
                  items={items}
                  menu={menu}
                />
              </div>

              {/* 7. Staff Performance Leaderboard */}
              <div className={tab === 'staff' ? '' : 'hidden'}>
                <OwnerStaffTab
                  orders={staffSec.currentOrders}
                  staff={staff}
                  range={staffRange}
                  onRangeChange={setStaffRange}
                />
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
