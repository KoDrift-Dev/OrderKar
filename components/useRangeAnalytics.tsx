'use client';

// Per-section range analytics for the owner console.
// Rule: NO global page filter — each section that needs a date range owns its
// own Today / 7D / 30D state and calls useSectionData() with it.

import { useMemo } from 'react';
import type { Order, OrderItem } from '@/lib/types';
import type { TKey } from '@/lib/i18n';

export type Range = 'today' | '7d' | '30d';

export const RANGE_KEYS: Record<Range, TKey> = {
  today: 'own_rnglbl_today',
  '7d': 'own_rnglbl_7d',
  '30d': 'own_rnglbl_30d',
};

export interface CatName {
  map: Map<string, string>;
  itemToCat: Map<string, string>;
}

export interface Agg {
  revenue: number;
  orders: number;
  itemsSold: number;
  trend: { label: string; value: number }[];
  hours: number[];
  weekdays: number[];
  topItems: { name: string; qty: number; revenue: number }[];
  cats: { name: string; revenue: number }[];
}

export interface MetricComparison {
  text: string;
  isPositive: boolean;
  isNeutral: boolean;
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

export function rangeBounds(r: Range): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  compLabel: string;
} {
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
    return { start: s, end: endOfDay, prevStart: prevS, prevEnd: prevE, compLabel: 'vs yesterday' };
  }
  const s = new Date(now);
  s.setHours(0, 0, 0, 0);
  let durDays = 7;
  let compLabel = 'vs prev 7 days';
  if (r === '7d') {
    durDays = 7;
    compLabel = 'vs prev 7 days';
    s.setDate(s.getDate() - 6);
  } else {
    durDays = 30;
    compLabel = 'vs prev 30 days';
    s.setDate(s.getDate() - 29);
  }
  const prevS = new Date(s);
  prevS.setDate(prevS.getDate() - durDays);
  const prevE = new Date(s);
  prevE.setMilliseconds(-1);
  return { start: s, end: endOfDay, prevStart: prevS, prevEnd: prevE, compLabel };
}

function aggregate(orders: Order[], items: OrderItem[], range: Range, start: Date, end: Date): Agg {
  const done = orders.filter((o) => o.status !== 'cancelled');
  const revenue = done.reduce((s, o) => s + Number(o.total_amount), 0);
  const itemsSold = items.reduce((s, i) => s + i.quantity, 0);

  const hourly = range === 'today';
  const bucketKey = (d: Date): string => {
    if (hourly) {
      const h = d.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const num = h % 12 === 0 ? 12 : h % 12;
      return `${num} ${ampm}`;
    }
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

/** Per-section analytics: pass the section's own range; get filtered orders + agg + comparisons. */
export function useSectionData(
  orders: Order[],
  items: OrderItem[],
  catName: CatName,
  range: Range
) {
  const { start, end, prevStart, compLabel } = useMemo(() => rangeBounds(range), [range]);

  const currentOrders = useMemo(
    () => orders.filter((o) => { const d = new Date(o.created_at); return d >= start && d <= end; }),
    [orders, start, end]
  );
  const prevOrders = useMemo(
    () => orders.filter((o) => { const d = new Date(o.created_at); return d >= prevStart && d < start; }),
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

  const comparisons = useMemo<KpiComparisons>(() => {
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

  return {
    start,
    end,
    compLabel,
    currentOrders,
    prevOrders,
    currentItems,
    prevItems,
    agg,
    comparisons,
  };
}

/** Consistent per-section Today / 7D / 30D pills. */
export function RangePills({
  value,
  onChange,
  small,
}: {
  value: Range;
  onChange: (r: Range) => void;
  small?: boolean;
}) {
  const opts: { key: Range; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
  ];
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-[var(--c-surface-solid)] shadow-2xs ${
        small ? 'p-0.5' : 'p-1'
      }`}
    >
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-full font-extrabold transition-all ${
            small ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-[12px]'
          } ${value === o.key ? 'bg-brand text-white shadow-xs' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
