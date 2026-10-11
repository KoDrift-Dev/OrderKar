'use client';

// Owner "Reports" overview — Pic 6 (Restora) layout, OrderKar purple theme.
// KPI cards, revenue chart, category donut, top items, dine-in/takeaway trend,
// customer feedback and rule-based insights. 100% real data; multi-branch and
// fake "customers" cards are skipped (no such data).

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MenuCategory, MenuItem, Order, OrderItem, Review } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { Card, Empty } from './ui';
import { CategoryDonut } from './charts';
import { rangeBounds, type Range } from './useRangeAnalytics';

function AreaChart({ days, vals }: { days: string[]; vals: number[] }) {
  const W = 560;
  const H = 220;
  const PL = 64;
  const PR = 12;
  const PT = 14;
  const PB = 30;
  const iw = W - PL - PR;
  const ih = H - PT - PB;
  const max = Math.max(1, ...vals);
  const step = days.length > 1 ? iw / (days.length - 1) : 0;
  const pts = vals.map((v, i) => [PL + i * step, PT + ih - (v / max) * ih] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L ${(W - PR).toFixed(1)},${(PT + ih).toFixed(1)} L ${PL.toFixed(1)},${(PT + ih).toFixed(1)} Z`;
  const ticks = [0, 0.5, 1].map((f) => ({ v: max * f, y: PT + ih - f * ih }));
  const n = days.length;
  const showIdx = n <= 8 ? days.map((_, i) => i) : days.map((_, i) => i).filter((_, i) => i % Math.ceil(n / 8) === 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={t.y} y2={t.y} className="stroke-line" strokeWidth="1" opacity="0.5" />
          <text x={PL - 8} y={t.y + 4} textAnchor="end" fontSize="10" className="fill-muted font-mono">
            {t.v >= 1000 ? `${Math.round(t.v / 1000)}k` : Math.round(t.v)}
          </text>
        </g>
      ))}
      <path d={area} fill="var(--c-brand)" opacity="0.1" />
      <path d={line} fill="none" stroke="var(--c-brand)" strokeWidth="2.5" strokeLinejoin="round" />
      {showIdx.map((i) => (
        <text key={i} x={PL + i * step} y={H - 10} textAnchor="middle" fontSize="10" className="fill-muted">
          {days[i]}
        </text>
      ))}
    </svg>
  );
}

function ChannelBars({ days, dineIn, takeaway }: { days: string[]; dineIn: number[]; takeaway: number[] }) {
  const max = Math.max(1, ...dineIn, ...takeaway);
  const n = days.length;
  const showIdx = n <= 8 ? days.map((_, i) => i) : days.map((_, i) => i).filter((_, i) => i % Math.ceil(n / 7) === 0);
  return (
    <div>
      <div className="flex h-[170px] items-end gap-1.5">
        {days.map((d, i) => (
          <div key={d + i} className="flex flex-1 items-end justify-center gap-[3px]" title={`${d}`}>
            <div
              className="w-full max-w-[14px] rounded-t-[4px] bg-brand/85"
              style={{ height: `${Math.max(3, (dineIn[i] / max) * 150)}px` }}
            />
            <div
              className="w-full max-w-[14px] rounded-t-[4px] bg-amber/50"
              style={{ height: `${Math.max(3, (takeaway[i] / max) * 150)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 overflow-hidden">
        {showIdx.map((i) => (
          <div key={i} className="flex-1 text-center font-mono text-[9.5px] font-bold text-muted">
            {days[i]}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 text-[11px] font-bold text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" /> Dine-in</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber/60" /> Takeaway</span>
      </div>
    </div>
  );
}

export default function OwnerReportsOverview({
  restaurantId,
  orders,
  items,
  menu,
  categories,
  reviews,
  range,
}: {
  restaurantId?: string;
  orders: Order[];
  items: OrderItem[];
  menu: MenuItem[];
  categories: MenuCategory[];
  reviews: Review[];
  range: Range;
}) {
  const [wasteCost, setWasteCost] = useState<number | null>(null);
  const { start, end } = useMemo(() => rangeBounds(range), [range]);

  useEffect(() => {
    if (!restaurantId) {
      setWasteCost(null);
      return;
    }
    (async () => {
      const { data } = await createClient()
        .from('waste_logs')
        .select('estimated_cost,logged_at')
        .eq('restaurant_id', restaurantId)
        .gte('logged_at', start.toISOString())
        .lte('logged_at', end.toISOString());
      setWasteCost((data ?? []).reduce((s: number, w: any) => s + Number(w.estimated_cost), 0));
    })();
  }, [restaurantId, start, end]);

  const done = useMemo(() => orders.filter((o) => o.status !== 'cancelled'), [orders]);
  const revenue = useMemo(() => done.reduce((s, o) => s + Number(o.total_amount), 0), [done]);
  const aov = done.length > 0 ? revenue / done.length : 0;

  const avgPrep = useMemo(() => {
    const mins = done
      .filter((o) => (o.status === 'ready' || o.status === 'completed') && o.updated_at)
      .map((o) => (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000)
      .filter((m) => m > 2 && m < 180);
    return mins.length ? mins.reduce((s, m) => s + m, 0) / mins.length : null;
  }, [done]);

  const wastePct = wasteCost != null && revenue > 0 ? (wasteCost / revenue) * 100 : null;

  const daily = useMemo(() => {
    const days: string[] = [];
    const rev = new Map<string, number>();
    const dine = new Map<string, number>();
    const take = new Map<string, number>();
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    const stop = new Date(end);
    stop.setHours(0, 0, 0, 0);
    while (d <= stop) {
      const k = d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
      days.push(k);
      rev.set(k, 0);
      dine.set(k, 0);
      take.set(k, 0);
      d.setDate(d.getDate() + 1);
    }
    for (const o of done) {
      const k = new Date(o.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
      if (!rev.has(k)) continue;
      rev.set(k, (rev.get(k) ?? 0) + Number(o.total_amount));
      if (o.order_type === 'takeaway') take.set(k, (take.get(k) ?? 0) + 1);
      else dine.set(k, (dine.get(k) ?? 0) + 1);
    }
    return {
      days,
      rev: days.map((k) => rev.get(k) ?? 0),
      dine: days.map((k) => dine.get(k) ?? 0),
      take: days.map((k) => take.get(k) ?? 0),
    };
  }, [done, start, end]);

  const cats = useMemo(() => {
    const catName = new Map(categories.map((c) => [c.id, c.name]));
    const itemToCat = new Map(menu.map((m) => [m.id, m.category_id]));
    const rev = new Map<string, number>();
    for (const i of items) {
      const cid = i.menu_item_id ? itemToCat.get(i.menu_item_id) : undefined;
      const name = (cid && catName.get(cid)) || 'Other';
      rev.set(name, (rev.get(name) ?? 0) + i.quantity * Number(i.unit_price));
    }
    return [...rev.entries()]
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [items, menu, categories]);

  const topItems = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const i of items) {
      const e = m.get(i.item_name) ?? { name: i.item_name, qty: 0, revenue: 0 };
      e.qty += i.quantity;
      e.revenue += i.quantity * Number(i.unit_price);
      m.set(i.item_name, e);
    }
    const arr = [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const totalRev = arr.reduce((s, x) => s + x.revenue, 0) || 1;
    return arr.map((x) => ({ ...x, pct: Math.round((x.revenue / totalRev) * 100) }));
  }, [items]);

  const feedback = useMemo(() => {
    if (reviews.length === 0) return null;
    const avg = reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length;
    const dist = [5, 4, 3, 2, 1].map((star) => ({
      star,
      n: reviews.filter((r) => Math.round(Number(r.rating)) === star).length,
    }));
    const latest = reviews.find((r) => r.comment && r.comment.trim());
    return { avg, dist, latest };
  }, [reviews]);

  const insights = useMemo(() => {
    const out: { icon: string; title: string; body: string; tone: string }[] = [];
    // Peak hours
    const hours = new Array(24).fill(0);
    for (const o of done) hours[new Date(o.created_at).getHours()] += 1;
    let peak = 0;
    hours.forEach((v, i) => {
      if (v > hours[peak]) peak = i;
    });
    if (done.length > 0) {
      const fmt = (h: number) => {
        const ap = h >= 12 ? 'PM' : 'AM';
        const n = h % 12 === 0 ? 12 : h % 12;
        return `${n} ${ap}`;
      };
      out.push({
        icon: '⏰',
        title: 'Peak Hours',
        body: `Most orders were placed around ${fmt(peak)} – ${fmt((peak + 2) % 24)}.`,
        tone: 'text-brand',
      });
    }
    if (avgPrep != null && avgPrep > 25) {
      out.push({
        icon: '🐌',
        title: 'Slow Preparation',
        body: `Average prep time is ${Math.round(avgPrep)} min — above the 25 min target.`,
        tone: 'text-amber dark:text-amber',
      });
    }
    if (wastePct != null && wastePct > 3) {
      out.push({
        icon: '⚠️',
        title: 'Food Waste Alert',
        body: `Waste is ${wastePct.toFixed(1)}% of revenue. Review the waste log.`,
        tone: 'text-rose-600 dark:text-rose-400',
      });
    }
    if (feedback && feedback.avg < 4) {
      out.push({
        icon: '⭐',
        title: 'Rating Alert',
        body: `Average rating is ${feedback.avg.toFixed(1)} — check recent reviews.`,
        tone: 'text-amber dark:text-amber',
      });
    }
    if (out.length === 0 && done.length > 0) {
      out.push({
        icon: '📈',
        title: 'Sales Steady',
        body: `${fmtNum(done.length)} orders · ${fmtPKR(revenue)} revenue in this period.`,
        tone: 'text-emerald-600 dark:text-emerald-400',
      });
    }
    return out.slice(0, 4);
  }, [done, avgPrep, wastePct, feedback, revenue]);

  const kpis = [
    { label: 'Total Revenue', value: fmtPKR(revenue), icon: '💰', tone: 'text-brand' },
    { label: 'Total Orders', value: fmtNum(done.length), icon: '🧾', tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Avg. Order Value', value: fmtPKR(aov), icon: '🧮', tone: 'text-blue-600 dark:text-blue-400' },
    { label: 'Avg. Prep Time', value: avgPrep != null ? `${Math.round(avgPrep)} min` : '—', icon: '⏱️', tone: 'text-violet-600 dark:text-violet-400' },
    { label: 'Food Waste', value: wastePct != null ? `${wastePct.toFixed(1)}%` : '—', icon: '🗑️', tone: 'text-rose-600 dark:text-rose-400' },
  ];

  return (
    <div className="mb-6 space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-soft text-[17px]">{k.icon}</span>
              <p className="text-[12px] font-bold text-muted">{k.label}</p>
            </div>
            <p className={`mt-1.5 font-mono text-[21px] font-black ${k.tone}`}>{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          {/* Revenue overview */}
          <Card className="p-4">
            <h3 className="font-display text-[15px] font-extrabold text-ink">Revenue Overview</h3>
            <div className="mt-2">
              <AreaChart days={daily.days} vals={daily.rev} />
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Top selling items */}
            <Card className="p-4">
              <h3 className="font-display text-[15px] font-extrabold text-ink">Top Selling Items</h3>
              {topItems.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] font-medium text-muted">No sales in this period.</p>
              ) : (
                <ul className="mt-3 space-y-2.5">
                  {topItems.map((t, i) => (
                    <li key={t.name} className="flex items-center gap-2.5">
                      <span className="w-5 shrink-0 font-mono text-[12px] font-black text-muted">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-extrabold text-ink">{t.name}</p>
                        <p className="text-[11px] font-medium text-muted">{fmtNum(t.qty)} sold · {t.pct}%</p>
                      </div>
                      <p className="font-mono text-[12.5px] font-black text-ink">{fmtPKR(t.revenue)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Orders trend */}
            <Card className="p-4">
              <h3 className="font-display text-[15px] font-extrabold text-ink">Orders Trend</h3>
              <div className="mt-3">
                <ChannelBars days={daily.days} dineIn={daily.dine} takeaway={daily.take} />
              </div>
            </Card>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4 xl:col-span-4">
          <Card className="p-4">
            <h3 className="font-display text-[15px] font-extrabold text-ink">Sales by Category</h3>
            <div className="mt-2">
              {cats.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] font-medium text-muted">No category sales yet.</p>
              ) : (
                <CategoryDonut cats={cats} />
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-display text-[14px] font-extrabold text-ink">💡 Insights & Suggestions</h3>
            <ul className="mt-3 space-y-3">
              {insights.length === 0 && (
                <p className="text-[12.5px] font-medium text-muted">Not enough data for insights yet.</p>
              )}
              {insights.map((ins, i) => (
                <li key={i} className="rounded-[12px] bg-soft/50 p-3">
                  <p className={`flex items-center gap-1.5 text-[12.5px] font-extrabold ${ins.tone}`}>
                    <span>{ins.icon}</span> {ins.title}
                  </p>
                  <p className="mt-1 text-[12px] font-medium leading-relaxed text-muted">{ins.body}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <h3 className="font-display text-[14px] font-extrabold text-ink">⭐ Customer Feedback</h3>
            {!feedback ? (
              <div className="py-2">
                <Empty title="No reviews yet" sub="Customer feedback will appear here." />
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <p className="font-mono text-[26px] font-black text-ink">{feedback.avg.toFixed(1)}</p>
                  <p className="text-[12px] font-bold text-muted">/ 5 · {reviews.length} reviews</p>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {feedback.dist.map((d) => (
                    <li key={d.star} className="flex items-center gap-2 text-[11.5px] font-bold text-muted">
                      <span className="w-6 shrink-0 font-mono">{d.star} ★</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-soft">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber to-orange-500"
                          style={{ width: `${reviews.length ? (d.n / reviews.length) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono">{d.n}</span>
                    </li>
                  ))}
                </ul>
                {feedback.latest && (
                  <div className="mt-3 rounded-[12px] bg-soft/50 p-3">
                    <p className="text-[12px] font-medium italic leading-relaxed text-body">“{feedback.latest.comment}”</p>
                    <p className="mt-1 text-[11px] font-bold text-muted">— {feedback.latest.customer_name || 'Guest'}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
