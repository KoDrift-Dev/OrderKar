'use client';

// Owner "Sales" tab: sales analytics, payments, order types, cancellations,
// one-click CSV exports.

import { useMemo } from 'react';
import type { Order, OrderItem } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { HourlyHeatmap, TopItems, WeekdayBars } from './charts';
import { Btn, Card, Empty, SectionHead } from './ui';

const PAY_LABELS: Record<string, string> = {
  cash: '💵 Cash',
  card: '💳 Card',
  jazzcash: '📱 JazzCash',
  easypaisa: '📱 EasyPaisa',
};

function MiniDonut({ title, sub, data }: { title: string; sub: string; data: { name: string; revenue: number }[] }) {
  const total = data.reduce((s, d) => s + d.revenue, 0) || 1;
  let acc = 0;
  const R = 54;
  const C = 2 * Math.PI * R;
  const COLORS = ['#6D28D9', '#0D9488', '#F59E0B', '#EF4444', '#64748B'];
  return (
    <Card className="p-5">
      <p className="font-display text-[15px] font-extrabold text-ink">{title}</p>
      <p className="mb-3 text-[12.5px] text-muted">{sub}</p>
      {data.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted">No data yet</p>
      ) : (
        <div className="flex items-center gap-5">
          <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0 -rotate-90">
            {data.map((d, i) => {
              const frac = d.revenue / total;
              const dash = Math.max(0, frac * C - 2);
              const off = -acc * C;
              acc += frac;
              return (
                <circle key={d.name} cx="70" cy="70" r={R} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth="20" strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={off} />
              );
            })}
          </svg>
          <ul className="min-w-0 flex-1 space-y-1.5">
            {data.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="truncate font-semibold text-body">{d.name}</span>
                </span>
                <span className="font-mono font-bold text-ink">{((d.revenue / total) * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function OwnerSalesTab({
  orders,
  items,
  hours,
  weekdays,
  topItems,
  rangeLabel,
}: {
  orders: Order[];
  items: OrderItem[];
  hours: number[];
  weekdays: number[];
  topItems: { name: string; qty: number; revenue: number }[];
  rangeLabel: string;
}) {
  const payments = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      const k = o.payment_method ?? 'not_recorded';
      m.set(k, (m.get(k) ?? 0) + Number(o.total_amount));
    }
    return [...m.entries()]
      .map(([k, revenue]) => ({ name: PAY_LABELS[k] ?? '❓ Not recorded', revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const orderTypes = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      const k = o.order_type === 'dine_in' ? '🍽️ Dine-in' : o.order_type === 'takeaway' ? '🥡 Takeaway' : '🛵 Delivery';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    const total = [...m.values()].reduce((s, v) => s + v, 0) || 1;
    return [...m.entries()].map(([name, count]) => ({ name, count, pct: (count / total) * 100 }));
  }, [orders]);

  const cancelled = useMemo(() => {
    const list = orders.filter((o) => o.status === 'cancelled');
    const value = list.reduce((s, o) => s + Number(o.total_amount), 0);
    const reasons = new Map<string, number>();
    for (const o of list) reasons.set(o.cancel_reason ?? 'no reason given', (reasons.get(o.cancel_reason ?? 'no reason given') ?? 0) + 1);
    return { list, value, reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]) };
  }, [orders]);

  const exportSales = () => {
    const byDay = new Map<string, { orders: number; revenue: number; cancelled: number }>();
    for (const o of orders) {
      const d = new Date(o.created_at).toLocaleDateString('en-PK');
      const e = byDay.get(d) ?? { orders: 0, revenue: 0, cancelled: 0 };
      if (o.status === 'cancelled') e.cancelled += 1;
      else {
        e.orders += 1;
        e.revenue += Number(o.total_amount);
      }
      byDay.set(d, e);
    }
    downloadCsv('daily-sales.csv', [
      ['Date', 'Orders', 'Revenue (PKR)', 'Cancelled'],
      ...[...byDay.entries()].map(([d, e]) => [d, e.orders, Math.round(e.revenue), e.cancelled]),
    ]);
  };

  const exportMix = () => {
    downloadCsv('product-mix.csv', [
      ['Item', 'Qty sold', 'Revenue (PKR)'],
      ...topItems.map((t) => [t.name, t.qty, Math.round(t.revenue)]),
    ]);
  };

  const voidRate = orders.length > 0 ? (cancelled.list.length / orders.length) * 100 : 0;

  return (
    <div className="space-y-8">
      <div>
        <SectionHead title="Sales analytics" sub={rangeLabel} action={
          <div className="flex gap-2">
            <Btn size="sm" onClick={exportSales}>⬇ Daily sales CSV</Btn>
            <Btn size="sm" onClick={exportMix}>⬇ Product mix CSV</Btn>
          </div>
        } />
        <div className="grid gap-4 lg:grid-cols-2">
          <HourlyHeatmap hours={hours} />
          <WeekdayBars days={weekdays} />
          <TopItems items={topItems} />
          <MiniDonut title="Payment methods" sub="Revenue share" data={payments} />
          <Card className="p-5">
            <p className="font-display text-[15px] font-extrabold text-ink">Order types</p>
            <p className="mb-3 text-[12.5px] text-muted">Dine-in vs takeaway vs delivery</p>
            <div className="space-y-2.5">
              {orderTypes.length === 0 && <p className="py-4 text-center text-[13px] text-muted">No data yet</p>}
              {orderTypes.map((t) => (
                <div key={t.name}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="font-bold text-body">{t.name}</span>
                    <span className="font-mono font-bold text-ink">{t.count} · {t.pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-soft">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${t.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <p className="font-display text-[15px] font-extrabold text-ink">Cancellations</p>
            <p className="mb-3 text-[12.5px] text-muted">
              {fmtNum(cancelled.list.length)} cancelled · {fmtPKR(cancelled.value)} lost · void rate{' '}
              <span className={`font-extrabold ${voidRate > 2 ? 'text-danger' : 'text-ok'}`}>{voidRate.toFixed(1)}%</span>
              {voidRate > 2 && <span className="text-danger"> — target &lt;2%!</span>}
            </p>
            {cancelled.reasons.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted">No cancellations 🎉</p>
            ) : (
              <div className="space-y-2.5">
                {cancelled.reasons.map(([r, n]) => (
                  <div key={r}>
                    <div className="mb-1 flex justify-between text-[13px]">
                      <span className="font-bold capitalize text-body">{r}</span>
                      <span className="font-mono font-bold text-ink">{n}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-soft">
                      <div className="h-full rounded-full bg-danger" style={{ width: `${(n / Math.max(1, cancelled.list.length)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
