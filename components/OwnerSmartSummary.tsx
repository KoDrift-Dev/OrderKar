'use client';

// Executive Smart Summary: deterministic intelligence console highlighting
// revenue velocity, kitchen speed, top performers, and loss prevention.

import { useMemo } from 'react';
import type { Order, OrderItem, Profile } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { Card } from './ui';

export default function OwnerSmartSummary({
  orders,
  items,
  staff,
  itemOrderDate,
}: {
  orders: Order[];
  items: OrderItem[];
  staff: Profile[];
  itemOrderDate: Map<string, string>;
}) {
  const insights = useMemo(() => {
    const list: {
      tag: string;
      title: string;
      desc: string;
      badge?: string;
      tone: 'good' | 'warn' | 'info';
      icon: string;
      gradient: string;
    }[] = [];

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const yStart = new Date(start);
    yStart.setDate(yStart.getDate() - 1);

    const today = orders.filter((o) => new Date(o.created_at) >= start && o.status !== 'cancelled');
    const yday = orders.filter(
      (o) => new Date(o.created_at) >= yStart && new Date(o.created_at) < start && o.status !== 'cancelled'
    );
    const revT = today.reduce((s, o) => s + Number(o.total_amount), 0);
    const revY = yday.reduce((s, o) => s + Number(o.total_amount), 0);

    if (today.length === 0) {
      return [
        {
          tag: 'Daily Activity',
          title: 'Awaiting Today’s Orders',
          desc: 'No completed orders registered today yet. Highlights and pace insights will generate automatically as orders flow in.',
          tone: 'info' as const,
          icon: '📊',
          gradient: 'bg-brand/10 text-brand border border-brand/20',
        },
      ];
    }

    // 1. Revenue velocity vs yesterday
    if (revY > 0) {
      const pct = Math.round(((revT - revY) / revY) * 100);
      const isUp = pct >= 0;
      list.push({
        tag: 'Revenue Momentum',
        title: isUp ? `Pacing ${pct}% Ahead of Yesterday` : `Trailing ${Math.abs(pct)}% Behind Yesterday`,
        desc: `Collected ${fmtPKR(revT)} across ${fmtNum(today.length)} orders today, compared to ${fmtPKR(revY)} yesterday.`,
        badge: isUp ? `+${pct}%` : `${pct}%`,
        tone: isUp ? 'good' : 'warn',
        icon: isUp ? '📈' : '📉',
        gradient: isUp ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
      });
    } else {
      list.push({
        tag: 'Revenue Momentum',
        title: `Today's Revenue: ${fmtPKR(revT)}`,
        desc: `Generated across ${fmtNum(today.length)} orders processed today.`,
        tone: 'info',
        icon: '💰',
        gradient: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
      });
    }

    // 2. Best selling dish
    const qty = new Map<string, number>();
    for (const i of items) {
      const d = itemOrderDate.get(i.order_id);
      if (d && new Date(d) >= start) qty.set(i.item_name, (qty.get(i.item_name) ?? 0) + i.quantity);
    }
    const top = [...qty.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) {
      list.push({
        tag: 'Crowd Favorite',
        title: `${top[0]} is Today’s Top Seller`,
        desc: `Fulfilled ${fmtNum(top[1])} portions so far. Keep an eye on ingredient inventory for this item.`,
        badge: `${top[1]} Sold`,
        tone: 'info',
        icon: '🔥',
        gradient: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
      });
    }

    // 3. Kitchen fulfillment pace
    const done = today.filter((o) => (o.status === 'ready' || o.status === 'completed') && o.updated_at);
    if (done.length > 0) {
      const avgMin =
        done.reduce((s, o) => s + (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()), 0) /
        done.length /
        60000;
      const roundedMin = Math.round(avgMin);
      const isSlow = roundedMin > 25;
      list.push({
        tag: 'Kitchen Efficiency',
        title: isSlow ? `Kitchen Bottleneck: ${roundedMin} min Avg Wait` : `Swift Fulfillment: ${roundedMin} min Average`,
        desc: isSlow
          ? 'Average time from order placement to food ready is above the 25 min benchmark. Check kitchen queue.'
          : 'Kitchen is operating well within the recommended 25 min table fulfillment window.',
        badge: `${roundedMin} min`,
        tone: isSlow ? 'warn' : 'good',
        icon: '⏱️',
        gradient: isSlow ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
      });
    }

    // 4. Void rate and cancellation risk
    const cancelledToday = orders.filter((o) => new Date(o.created_at) >= start && o.status === 'cancelled');
    const voidRate = (cancelledToday.length / Math.max(1, today.length + cancelledToday.length)) * 100;
    if (cancelledToday.length > 0) {
      const reasons = new Map<string, number>();
      for (const o of cancelledToday) {
        reasons.set(o.cancel_reason ?? 'unspecified', (reasons.get(o.cancel_reason ?? 'unspecified') ?? 0) + 1);
      }
      const topReason = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const isHigh = voidRate > 2;
      list.push({
        tag: 'Risk & Loss Audit',
        title: `${fmtNum(cancelledToday.length)} Orders Cancelled (${voidRate.toFixed(1)}% Void Rate)`,
        desc: `Primary cancellation reason reported: "${topReason}". Target void rate is < 2.0%.`,
        badge: `${voidRate.toFixed(1)}% Voids`,
        tone: isHigh ? 'warn' : 'info',
        icon: '⚠️',
        gradient: isHigh ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
      });
    }

    // 5. MVP Waiter of the day
    const wRev = new Map<string, number>();
    const nameOf = new Map(staff.map((s) => [s.id, s.name]));
    for (const o of today) {
      if (o.waiter_id) wRev.set(o.waiter_id, (wRev.get(o.waiter_id) ?? 0) + Number(o.total_amount));
    }
    const best = [...wRev.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && nameOf.has(best[0])) {
      list.push({
        tag: 'Staff Spotlight',
        title: `${nameOf.get(best[0])} Leads Floor Service`,
        desc: `Generated ${fmtPKR(best[1])} in sales today across assigned tables.`,
        badge: 'Top Performer',
        tone: 'good',
        icon: '🏅',
        gradient: 'bg-brand/10 text-brand border border-brand/20',
      });
    }

    return list;
  }, [orders, items, staff, itemOrderDate]);

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand shadow-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </span>
          <div>
            <h3 className="font-display text-[15px] font-extrabold text-ink">Executive Daily Pulse</h3>
            <p className="text-[12px] font-medium text-muted">Automated operational intelligence based on today’s active service</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-[var(--c-surface-solid)] px-3 py-1 text-[11px] font-bold text-muted">
          <span className="h-2 w-2 rounded-full bg-ok animate-live-pulse" />
          Live Telemetry
        </span>
      </div>

      <div className={`grid gap-3.5 ${insights.length === 1 ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {insights.map((item, i) => {
          const toneBadge =
            item.tone === 'good'
              ? 'bg-ok/10 text-ok border-ok/20'
              : item.tone === 'warn'
              ? 'bg-danger/10 text-danger border-danger/20'
              : 'bg-brand/10 text-brand border-brand/20';

          return (
            <Card
              key={i}
              className={`group relative flex flex-col justify-between p-5 transition-all duration-300 hover:border-brand/40 hover:-translate-y-0.5 ${
                insights.length === 1 ? 'w-full' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="mb-2.5 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${item.gradient} text-[15px] font-bold shadow-xs`}
                    >
                      {item.icon}
                    </span>
                    <span className="text-[11.5px] font-black uppercase tracking-wider text-muted truncate">
                      {item.tag}
                    </span>
                  </div>
                  {item.badge && (
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold ${toneBadge}`}>
                      {item.badge}
                    </span>
                  )}
                </div>

                <h4 className="font-display text-[15px] font-extrabold leading-snug text-ink group-hover:text-brand transition-colors break-words">
                  {item.title}
                </h4>
                <p className="mt-1.5 text-[13px] leading-relaxed text-body opacity-90 break-words">
                  {item.desc}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
