'use client';

// Owner "Dashboard" tab — Pic 1 (Restora) layout, OrderKar purple theme.
// 100% REAL data: every number comes from props or a live query.
// No dummy fallbacks, no hardcoded comparisons, no fake activity.

import { useEffect, useId, useMemo, useState } from 'react';
import type { Order, OrderItem, Profile, DiningTable } from '@/lib/types';
import { fmtPKR } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import QrSection from './QrSection';
import { RangePills, type Range } from './useRangeAnalytics';
import SmartImage from './SmartImage';

export interface DashAgg {
  revenue: number;
  orders: number;
  itemsSold: number;
  trend: { label: string; value: number }[];
  cats: { name: string; revenue: number }[];
}

export interface MetricComparison {
  text: string;
  isPositive: boolean;
  isNeutral?: boolean;
}

export interface KpiComparisons {
  compLabel: string;
  revenue: MetricComparison;
  orders: MetricComparison;
  aov: MetricComparison;
  itemsSold: MetricComparison;
  net: MetricComparison;
  cancelled: MetricComparison;
  lost: MetricComparison;
  voidRate: MetricComparison;
}

function timeAgo(dateStr: string): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function fmtCompact(n: number): string {
  if (n >= 1000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 0 : 1)}k`;
  }
  return `${Math.round(n)}`;
}

const ACTIVE_STATUSES = ['pending', 'preparing', 'ready'];

type ChartRange = 'today' | '7d' | '30d';

interface ChartOrder {
  created_at: string;
  total_amount: number;
  status: string;
}

export default function OwnerDashTab({
  restaurantId,
  orders,
  items,
  staff: _staff,
  itemOrderDate: _itemOrderDate,
  slug,
  tables,
  restaurantName,
  comparisons,
  onNavigate,
  viewerName = 'Owner',
  viewerRole: _viewerRole = 'Owner',
  range,
  onRangeChange,
}: {
  restaurantId: string;
  agg: DashAgg;
  orders: Order[];
  items: OrderItem[];
  staff: Profile[];
  itemOrderDate: Map<string, string>;
  slug: string;
  tables: DiningTable[];
  restaurantName: string;
  comparisons?: KpiComparisons;
  onNavigate?: (tab: any, subTab?: any) => void;
  viewerName?: string;
  viewerRole?: string;
  range?: Range;
  onRangeChange?: (r: Range) => void;
}) {
  const chartId = useId();
  const [salesRange, setSalesRange] = useState<ChartRange>('today');
  const [showQrDrawer, setShowQrDrawer] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [heroImgOk, setHeroImgOk] = useState(true);

  // ── Greeting + date ──────────────────────────────────────────────
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';
  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    []
  );
  const firstName = (viewerName || '').trim().split(' ')[0] || restaurantName || '';

  // ── Today's orders (KPIs are "today" metrics, honest regardless of page filter) ──
  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }, []);
  const isToday = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` === todayKey;
  };
  const todayOrders = useMemo(() => orders.filter((o) => isToday(o.created_at)), [orders, todayKey]);
  const todayRevenue = useMemo(
    () => todayOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount || 0), 0),
    [todayOrders]
  );

  // ── Active / delayed orders (status-based, real) ──
  const activeOrders = useMemo(() => orders.filter((o) => ACTIVE_STATUSES.includes(o.status)), [orders]);
  const delayedOrders = useMemo(() => {
    const now = Date.now();
    return orders.filter((o) => {
      if (!['pending', 'preparing'].includes(o.status)) return false;
      return (now - new Date(o.created_at).getTime()) / 60000 >= 20;
    });
  }, [orders]);

  // ── Tables: real occupancy ──
  const activeTables = useMemo(() => tables.filter((t) => t.is_active), [tables]);
  const tableNoById = useMemo(() => new Map(tables.map((t) => [t.id, t.table_number])), [tables]);
  const occupiedTableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const o of activeOrders) if (o.table_id && tableNoById.has(o.table_id)) ids.add(o.table_id);
    return ids;
  }, [activeOrders, tableNoById]);
  const totalTables = activeTables.length;
  const occupiedTables = occupiedTableIds.size;
  const occupancyPct = totalTables > 0 ? Math.min(100, Math.round((occupiedTables / totalTables) * 100)) : 0;

  // ── Avg prep time (completed orders only) + real last-hour delta ──
  const prepStats = useMemo(() => {
    const done = orders
      .filter((o) => o.status === 'completed' && o.created_at && o.updated_at)
      .map((o) => ({
        at: new Date(o.updated_at).getTime(),
        mins: (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000,
      }))
      .filter((x) => x.mins > 2 && x.mins < 180);
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
    const now = Date.now();
    const lastHr = avg(done.filter((x) => now - x.at < 3600_000).map((x) => x.mins));
    const prevHr = avg(done.filter((x) => now - x.at >= 3600_000 && now - x.at < 7200_000).map((x) => x.mins));
    return {
      overall: avg(done.map((x) => x.mins)),
      delta: lastHr != null && prevHr != null ? lastHr - prevHr : null,
      n: done.length,
    };
  }, [orders]);

  // ── Sales chart: independent per-section filter (today / 7d / 30d) ──
  const [chartOrders, setChartOrders] = useState<ChartOrder[] | null>(null);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    if (salesRange === 'today') {
      setChartOrders(null);
      return;
    }
    let alive = true;
    setChartLoading(true);
    const days = salesRange === '7d' ? 7 : 30;
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    (async () => {
      try {
        const { data } = await createClient()
          .from('orders')
          .select('created_at,total_amount,status')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', start.toISOString())
          .neq('status', 'cancelled');
        if (!alive) return;
        setChartOrders((data ?? []) as ChartOrder[]);
      } catch {
        if (!alive) return;
        setChartOrders([]);
      } finally {
        if (alive) setChartLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [salesRange, restaurantId]);

  const chartData = useMemo(() => {
    if (salesRange === 'today') {
      const hours = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
      const bars = hours.map((h) => {
        const inHour = todayOrders.filter(
          (o) => o.status !== 'cancelled' && new Date(o.created_at).getHours() === h
        );
        const num = h % 12 === 0 ? 12 : h % 12;
        return {
          label: `${num} ${h >= 12 ? 'PM' : 'AM'}`,
          value: inHour.reduce((s, o) => s + Number(o.total_amount || 0), 0),
          count: inHour.length,
        };
      });
      return { bars, total: bars.reduce((s, b) => s + b.value, 0) };
    }
    const src = chartOrders ?? [];
    const days = salesRange === '7d' ? 7 : 30;
    const bars: { label: string; value: number; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const inDay = src.filter((o) => {
        const od = new Date(o.created_at);
        return `${od.getFullYear()}-${od.getMonth()}-${od.getDate()}` === key;
      });
      bars.push({
        label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        value: inDay.reduce((s, o) => s + Number(o.total_amount || 0), 0),
        count: inDay.length,
      });
    }
    return { bars, total: bars.reduce((s, b) => s + b.value, 0) };
  }, [salesRange, todayOrders, chartOrders]);

  const chartMax = Math.max(1, ...chartData.bars.map((b) => b.value));
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((f) => chartMax * f);

  // ── Rule-based insight (real data only) ──
  const insight = useMemo(() => {
    if (delayedOrders.length > 0) {
      return {
        title: 'Kitchen congestion detected',
        body: `${delayedOrders.length} order${delayedOrders.length > 1 ? 's are' : ' is'} waiting for preparation for more than 20 minutes.`,
        cta: 'View Kitchen',
        tab: 'operations' as const,
      };
    }
    if (activeOrders.length >= 6) {
      return {
        title: 'Rush in progress',
        body: `${activeOrders.length} active orders in the kitchen right now. Keep an eye on prep times.`,
        cta: 'View Kitchen',
        tab: 'operations' as const,
      };
    }
    if (activeOrders.length > 0) {
      return {
        title: 'Service running',
        body: `${activeOrders.length} active order${activeOrders.length > 1 ? 's' : ''}, no delays. Kitchen flow is healthy.`,
        cta: null as string | null,
        tab: 'operations' as const,
      };
    }
    return {
      title: 'All quiet',
      body: 'No active orders right now. Today\u2019s summary is ready in Reports.',
      cta: 'View Reports',
      tab: 'reports' as const,
    };
  }, [delayedOrders.length, activeOrders.length]);

  // ── Recent activity (real orders, real table numbers) ──
  const itemCountByOrder = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.order_id, (m.get(it.order_id) ?? 0) + Number((it as any).quantity || 1));
    return m;
  }, [items]);

  const recentActivities = useMemo(() => {
    const sorted = [...orders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return sorted.slice(0, 5).map((o) => {
      const tbl = o.table_id ? tableNoById.get(o.table_id) : null;
      const where =
        o.order_type === 'takeaway' ? 'Takeaway' : tbl != null ? `Table ${tbl}` : 'Walk-in';
      const n = itemCountByOrder.get(o.id) ?? 0;
      if (o.status === 'ready' || o.status === 'completed') {
        return {
          id: `ready-${o.id}`,
          title: `Order #${o.order_number} ready`,
          subtitle: `${where}${n > 0 ? ` \u2022 ${n} item${n > 1 ? 's' : ''}` : ''}`,
          time: timeAgo(o.updated_at || o.created_at),
          iconType: 'ready' as const,
        };
      }
      if (o.status === 'cancelled') {
        return {
          id: `cancel-${o.id}`,
          title: `Order #${o.order_number} cancelled`,
          subtitle: o.cancel_reason || 'Cancelled',
          time: timeAgo(o.updated_at || o.created_at),
          iconType: 'delayed' as const,
        };
      }
      return {
        id: `new-${o.id}`,
        title: `New order #${o.order_number}`,
        subtitle: `${where} \u2022 ${fmtPKR(Number(o.total_amount || 0))}`,
        time: timeAgo(o.created_at),
        iconType: 'order' as const,
      };
    });
  }, [orders, tableNoById, itemCountByOrder]);

  const revBadge = comparisons?.revenue;

  return (
    <div className="space-y-4 pb-10 font-sans">
      {/* ── Per-section range (no global filter) ── */}
      {onRangeChange && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-extrabold uppercase tracking-wider text-muted">Overview</p>
          <RangePills value={range ?? 'today'} onChange={onRangeChange} small />
        </div>
      )}
      {/* ── 1. HERO BANNER ── */}
      <div className="relative overflow-hidden rounded-[22px] border border-white/10 bg-[#0d091a] shadow-[0_8px_30px_rgba(0,0,0,0.16)] min-h-[140px] sm:min-h-[160px]">
        {heroImgOk && (
          <SmartImage
            src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1600&q=80"
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            className="object-cover object-right md:object-center"
            loading="eager"
            onError={() => setHeroImgOk(false)}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c081e]/95 via-[#0c081e]/75 to-[#0c081e]/30 sm:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c081e]/60 via-transparent to-transparent" />
        <div className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-brand/30 blur-[70px]" />
        <div className="relative z-10 flex h-full flex-col justify-center p-4 sm:p-5 lg:p-6 max-w-xl">
          <h1 className="font-display text-[22px] sm:text-[26px] lg:text-[30px] font-black tracking-tight text-white leading-tight">
            {greeting},{' '}
            <span className="bg-gradient-to-r from-amber via-orange-400 to-brand bg-clip-text text-transparent">
              {firstName}
            </span>
          </h1>
          <p className="mt-1 text-[12.5px] sm:text-[13.5px] font-medium text-white/80">
            Here&apos;s what&apos;s happening at your restaurant today.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 self-start rounded-full border border-white/15 bg-black/35 px-3 py-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="text-[11px] sm:text-[11.5px] font-bold text-white/90 tracking-wide">{todayFormatted}</span>
          </div>
        </div>
      </div>

      {/* ── 2. MAIN GRID ── */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          {/* 2.1 KPI CARDS — all real, no dummy fallbacks */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
            {/* Occupied Tables */}
            <button
              onClick={() => onNavigate?.('tables')}
              className="group relative cursor-pointer overflow-hidden rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-3 sm:p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber/40 hover:shadow-md text-left flex flex-col justify-between"
            >
              <div>
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#ff9f43] via-[#f78b1f] to-[#e66a00] text-white shadow-[0_4px_12px_rgba(247,139,31,0.35)] transition-transform duration-300 group-hover:scale-110">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="3" width="16" height="13" rx="2" />
                    <path d="M4 16v5" />
                    <path d="M20 16v5" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                  </svg>
                </div>
                <p className="mt-2 text-[11px] sm:text-[11.5px] font-bold text-muted truncate">Occupied Tables</p>
                <p className="mt-0.5 font-mono text-[18px] sm:text-[21px] font-black text-ink tracking-tight">
                  {occupiedTables} <span className="text-[13px] font-bold text-muted">/ {totalTables}</span>
                </p>
              </div>
              <div className="mt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-soft">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber to-orange-500 transition-all duration-500" style={{ width: `${occupancyPct}%` }} />
                </div>
                <p className="mt-1.5 text-[10px] font-bold text-muted">
                  {totalTables > 0 ? `${occupancyPct}% occupancy` : 'No tables added'}
                </p>
              </div>
            </button>

            {/* Active Orders */}
            <button
              onClick={() => onNavigate?.('sales')}
              className="group relative cursor-pointer overflow-hidden rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-3 sm:p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md text-left flex flex-col justify-between"
            >
              <div>
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#10b981] via-[#059669] to-[#047857] text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)] transition-transform duration-300 group-hover:scale-110">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <p className="mt-2 text-[11px] sm:text-[11.5px] font-bold text-muted truncate">Active Orders</p>
                <p className="mt-0.5 font-mono text-[18px] sm:text-[21px] font-black text-ink tracking-tight">
                  {activeOrders.length}
                </p>
              </div>
              <p className="mt-2 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">In progress</p>
            </button>

            {/* Avg Prep Time */}
            <button
              onClick={() => onNavigate?.('operations')}
              className="group relative cursor-pointer overflow-hidden rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-3 sm:p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-md text-left flex flex-col justify-between"
            >
              <div>
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#38bdf8] via-[#0284c7] to-[#0369a1] text-white shadow-[0_4px_12px_rgba(2,132,199,0.35)] transition-transform duration-300 group-hover:scale-110">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <p className="mt-2 text-[11px] sm:text-[11.5px] font-bold text-muted truncate">Avg. Prep Time</p>
                <p className="mt-0.5 font-mono text-[18px] sm:text-[21px] font-black text-ink tracking-tight">
                  {prepStats.overall != null ? (
                    <>{prepStats.overall} <span className="text-[13px] font-bold text-muted">min</span></>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </p>
              </div>
              <div className="mt-2 text-[10px] font-bold truncate">
                {prepStats.delta != null ? (
                  <span className={prepStats.delta <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                    {prepStats.delta <= 0 ? '\u2193' : '\u2191'} {Math.abs(prepStats.delta)} min{' '}
                    <span className="text-muted font-normal">vs. last hr</span>
                  </span>
                ) : (
                  <span className="text-muted font-medium">
                    {prepStats.n > 0 ? `${prepStats.n} timed` : 'No data yet'}
                  </span>
                )}
              </div>
            </button>

            {/* Today's Revenue */}
            <button
              onClick={() => onNavigate?.('reports', 'revenue')}
              className="group relative cursor-pointer overflow-hidden rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-3 sm:p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md text-left flex flex-col justify-between"
            >
              <div>
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#a855f7] via-[#8b5cf6] to-[#7c3aed] text-white shadow-[0_4px_12px_rgba(139,92,246,0.35)] transition-transform duration-300 group-hover:scale-110">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
                <p className="mt-2 text-[11px] sm:text-[11.5px] font-bold text-muted truncate">Today&apos;s Revenue</p>
                <p className="mt-0.5 font-mono text-[17px] sm:text-[19px] font-black text-ink tracking-tight truncate">
                  {fmtPKR(todayRevenue)}
                </p>
              </div>
              <div className="mt-2 truncate">
                {revBadge ? (
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black ${
                      revBadge.isNeutral
                        ? 'bg-soft text-muted'
                        : revBadge.isPositive
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {revBadge.text}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-muted">Today</span>
                )}
              </div>
            </button>

            {/* Delayed Orders */}
            <button
              onClick={() => onNavigate?.('operations')}
              className="group relative cursor-pointer overflow-hidden rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-3 sm:p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-500/40 hover:shadow-md text-left flex flex-col justify-between col-span-2 sm:col-span-1"
            >
              <div>
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#fb7185] via-[#f43f5e] to-[#e11d48] text-white shadow-[0_4px_12px_rgba(244,63,94,0.35)] transition-transform duration-300 group-hover:scale-110">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <p className="mt-2 text-[11px] sm:text-[11.5px] font-bold text-muted truncate">Delayed Orders</p>
                <p className="mt-0.5 font-mono text-[18px] sm:text-[21px] font-black text-rose-600 dark:text-rose-400 tracking-tight">
                  {delayedOrders.length}
                </p>
              </div>
              <p className={`mt-2 text-[10.5px] font-bold ${delayedOrders.length > 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {delayedOrders.length > 0 ? 'Needs attention' : 'All on track'}
              </p>
            </button>
          </div>

          {/* 2.2 SALES CHART + INSIGHT */}
          <div className="grid gap-3.5 md:grid-cols-12">
            <div className="rounded-[20px] border border-line/60 bg-[var(--c-surface-solid)] p-4 sm:p-5 shadow-sm md:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-[15px] sm:text-[16px] font-extrabold text-ink tracking-tight">
                    {salesRange === 'today' ? "Today's Sales Overview" : salesRange === '7d' ? 'Last 7 Days Sales' : 'Last 30 Days Sales'}
                  </h2>
                  <p className="text-[11px] font-medium text-muted">
                    {salesRange === 'today' ? 'Hourly revenue pulse' : 'Daily revenue'} \u2022 {fmtPKR(chartData.total)} total
                  </p>
                </div>
                <div className="relative">
                  <select
                    value={salesRange}
                    onChange={(e) => {
                      setSalesRange(e.target.value as ChartRange);
                      setHoveredBar(null);
                    }}
                    className="cursor-pointer appearance-none rounded-lg border border-line/80 bg-soft/80 pl-2.5 pr-6 py-1 text-[11.5px] font-bold text-ink outline-none transition-colors hover:border-brand/40 focus:border-brand"
                    aria-label="Sales chart range"
                  >
                    <option value="today">Today</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="relative mt-4 pt-1">
                {chartLoading ? (
                  <div className="flex h-36 sm:h-44 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  </div>
                ) : chartData.total === 0 ? (
                  <div className="flex h-36 sm:h-44 flex-col items-center justify-center gap-1 text-center">
                    <p className="text-[13px] font-bold text-ink">No sales in this period</p>
                    <p className="text-[11px] font-medium text-muted">Orders will appear here once they come in.</p>
                  </div>
                ) : (
                  <>
                    <svg viewBox="0 0 680 200" className="w-full h-36 sm:h-44 overflow-visible" role="img" aria-label="Sales bar chart">
                      <defs>
                        <linearGradient id={`bar-brand-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#6d28d9" />
                        </linearGradient>
                      </defs>
                      {yTicks.map((tickVal, i) => {
                        const y = 15 + i * 35;
                        return (
                          <g key={i}>
                            <text x="36" y={y + 4} textAnchor="end" fontSize="10" fontWeight="700" fill="currentColor" className="text-muted/70 font-mono">
                              {fmtCompact(tickVal)}
                            </text>
                            <line x1="46" y1={y} x2="670" y2={y} stroke="currentColor" strokeDasharray={i === 4 ? '' : '3 3'} strokeWidth="1" className="text-line/60" />
                          </g>
                        );
                      })}
                      {chartData.bars.map((bar, idx) => {
                        const count = chartData.bars.length;
                        const barWidth = count > 12 ? 10 : 16;
                        const availableWidth = 670 - 54;
                        const step = availableWidth / count;
                        const x = 54 + idx * step + (step - barWidth) / 2;
                        const chartHeight = 140;
                        const barHeight = Math.max(4, (bar.value / chartMax) * chartHeight);
                        const y = 15 + chartHeight - barHeight;
                        const isHovered = hoveredBar === idx;
                        return (
                          <g
                            key={`${bar.label}-${idx}`}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredBar(idx)}
                            onMouseLeave={() => setHoveredBar(null)}
                          >
                            <rect
                              x={x} y={y} width={barWidth} height={barHeight} rx="4"
                              fill={`url(#bar-brand-${chartId})`}
                              opacity={bar.value === 0 ? 0.25 : isHovered ? 1 : 0.92}
                            />
                            {(count <= 12 || idx % 5 === 0 || idx === count - 1) && (
                              <text x={x + barWidth / 2} y="176" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="currentColor" className="text-muted font-sans">
                                {bar.label}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                    {hoveredBar !== null && chartData.bars[hoveredBar] && (
                      <div
                        className="pointer-events-none absolute -top-1 z-20 -translate-x-1/2 rounded-[12px] border border-line/12 bg-[var(--c-surface-solid)] px-2.5 py-1 shadow-lg"
                        style={{ left: `${Math.min(88, Math.max(12, ((hoveredBar + 0.8) / chartData.bars.length) * 100))}%` }}
                      >
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted">
                          {chartData.bars[hoveredBar].label}
                        </p>
                        <p className="font-mono text-[13.5px] font-black text-ink">
                          {fmtPKR(chartData.bars[hoveredBar].value)}
                        </p>
                        <p className="text-[9.5px] font-bold text-brand">
                          {chartData.bars[hoveredBar].count} orders
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Insight card */}
            <div className="rounded-[20px] border border-amber/30 bg-gradient-to-br from-amber/[0.08] via-amber/[0.03] to-transparent p-4 sm:p-5 shadow-sm md:col-span-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber/20 text-amber text-xs">
                    {'\u{1F4A1}'}
                  </span>
                  <h3 className="font-display text-[14px] font-extrabold text-amber dark:text-amber">
                    Insight for You
                  </h3>
                </div>
                <div className="mt-3 flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber/20 text-amber text-xs">
                    {'\u26A0\uFE0F'}
                  </span>
                  <div>
                    <h4 className="font-display text-[14.5px] font-black text-ink">{insight.title}</h4>
                    <p className="mt-1 text-[12px] font-medium text-muted leading-relaxed">{insight.body}</p>
                  </div>
                </div>
              </div>
              {insight.cta && (
                <button
                  onClick={() => onNavigate?.(insight.tab)}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-[13px] bg-brand hover:bg-brand-deep px-4 py-2.5 text-[13px] font-black text-white shadow-lift transition-all duration-200 active:scale-[0.99]"
                >
                  <span>{insight.cta}</span>
                  <span>&rarr;</span>
                </button>
              )}
            </div>
          </div>

          {/* 2.3 QUICK OVERVIEW */}
          <div className="space-y-2.5">
            <h3 className="font-display text-[15px] font-extrabold text-ink tracking-tight">Quick Overview</h3>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
              {[
                { label: 'Tables', sub: totalTables > 0 ? `${occupiedTables} occupied` : 'View all tables', icon: '\u{1FA91}', tab: 'tables', grad: 'from-amber to-orange-500' },
                { label: 'Active Orders', sub: `${activeOrders.length} in progress`, icon: '\u{1F4CB}', tab: 'sales', grad: 'from-emerald-500 to-teal' },
                { label: 'Kitchen', sub: delayedOrders.length > 0 ? `${delayedOrders.length} delayed` : 'Monitor kitchen', icon: '\u{1F468}\u200D\u{1F373}', tab: 'operations', grad: 'from-rose-500 to-pink-600' },
                { label: 'Menu', sub: 'Manage menu', icon: '\u{1F37D}\uFE0F', tab: 'menu', grad: 'from-indigo-500 to-purple-600' },
              ].map((c) => (
                <button
                  key={c.label}
                  onClick={() => onNavigate?.(c.tab)}
                  className="group flex items-center justify-between rounded-[16px] border border-line/60 bg-[var(--c-surface-solid)] p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br ${c.grad} text-white text-sm transition-transform duration-300 group-hover:scale-110`}>
                      {c.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-[13px] font-bold text-ink">{c.label}</p>
                      <p className="text-[10.5px] font-medium text-muted truncate">{c.sub}</p>
                    </div>
                  </div>
                  <span className="text-muted group-hover:text-ink text-sm transition-transform group-hover:translate-x-0.5">&rsaquo;</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ──── RIGHT COLUMN ──── */}
        <div className="space-y-4 lg:col-span-4">
          {/* Quick Actions */}
          <div className="rounded-[20px] border border-line/60 bg-[var(--c-surface-solid)] p-4 sm:p-5 shadow-sm">
            <h3 className="font-display text-[15px] font-extrabold text-ink tracking-tight">Quick Actions</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: 'New Order', icon: '+', tab: 'pos', color: 'bg-gradient-to-br from-amber to-orange-500 text-white text-lg font-black' },
                { label: 'View Tables', icon: '\u{1FA91}', tab: 'tables', color: 'bg-amber/15 text-amber dark:text-amber' },
                { label: 'Menu', icon: '\u{1F37D}\uFE0F', tab: 'menu', color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
                { label: 'View Reports', icon: '\u{1F4CA}', tab: 'reports', color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
                { label: 'Manage Staff', icon: '\u{1F465}', tab: 'staff', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
                { label: 'Settings', icon: '\u2699\uFE0F', tab: 'settings', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
              ].map((act) => (
                <button
                  key={act.label}
                  onClick={() => onNavigate?.(act.tab)}
                  className="group flex flex-col items-center justify-center rounded-[15px] border border-line/70 bg-soft/40 p-2 sm:p-2.5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:bg-brand/[0.06] active:scale-95"
                >
                  <div className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-[11px] text-[15px] transition-transform duration-200 group-hover:scale-110 ${act.color}`}>
                    {act.icon}
                  </div>
                  <span className="mt-1.5 text-[10.5px] font-bold text-ink leading-tight">{act.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-[20px] border border-line/60 bg-[var(--c-surface-solid)] p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-[15px] font-extrabold text-ink tracking-tight">Recent Activity</h3>
              <button
                onClick={() => onNavigate?.('audit')}
                className="text-[11.5px] font-bold text-brand hover:underline inline-flex items-center gap-0.5"
              >
                <span>View All</span>
                <span>&rarr;</span>
              </button>
            </div>
            {recentActivities.length === 0 ? (
              <p className="mt-3 text-[12px] font-medium text-muted">No recent activity yet. New orders will appear here.</p>
            ) : (
              <div className="mt-3 divide-y divide-line/50">
                {recentActivities.map((act) => {
                  const iconColor =
                    act.iconType === 'order'
                      ? 'bg-teal/15 text-teal dark:text-teal'
                      : act.iconType === 'ready'
                      ? 'bg-amber/15 text-amber dark:text-amber'
                      : 'bg-rose-500/15 text-rose-500';
                  return (
                    <div key={act.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[13px] ${iconColor}`}>
                        {act.iconType === 'order' && '\u{1F9FE}'}
                        {act.iconType === 'ready' && '\u{1F373}'}
                        {act.iconType === 'delayed' && '\u26A0\uFE0F'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-bold text-ink truncate">{act.title}</p>
                        <p className="text-[10.5px] font-medium text-muted truncate">{act.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-semibold text-muted">{act.time}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── QR LAUNCHPAD DRAWER ── */}
      <div className="pt-2">
        <button
          onClick={() => setShowQrDrawer(!showQrDrawer)}
          className="inline-flex items-center gap-2 text-[13px] font-extrabold text-muted hover:text-ink transition-colors"
        >
          <span className="rounded-lg bg-soft p-1">{showQrDrawer ? '\u25BC' : '\u25B6'}</span>
          <span>Floor QR Launchpad &amp; Operational Tools</span>
        </button>
        {showQrDrawer && (
          <div className="mt-4 space-y-4">
            <div className="rounded-[24px] border border-line/12 bg-gradient-to-br from-brand/5 via-transparent to-teal/5 p-1">
              <QrSection slug={slug} tables={tables} restaurantName={restaurantName} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
