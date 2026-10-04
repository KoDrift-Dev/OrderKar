'use client';

// Owner "Operations" tab: live kitchen monitor + table performance +
// fulfillment times.

import { useMemo } from 'react';
import type { DiningTable, Order } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import OwnerKitchenView from './OwnerKitchenView';
import { Card, Empty, SectionHead } from './ui';

function TablePerformance({ orders, tables }: { orders: Order[]; tables: DiningTable[] }) {
  const stats = useMemo(() => {
    const m = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      if (!o.table_id || o.status === 'cancelled') continue;
      const e = m.get(o.table_id) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue += Number(o.total_amount);
      m.set(o.table_id, e);
    }
    const maxRev = Math.max(1, ...[...m.values()].map((e) => e.revenue));
    return tables
      .filter((t) => t.is_active)
      .map((t) => {
        const e = m.get(t.id) ?? { orders: 0, revenue: 0 };
        return { table: t, ...e, heat: e.revenue / maxRev };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders, tables]);

  const heatBg = (h: number) =>
    h >= 0.66 ? 'bg-ok/15 border-ok/30' : h >= 0.33 ? 'bg-amber/10 border-amber/30' : 'bg-danger/10 border-danger/30';

  return (
    <div>
      <SectionHead title="Table performance" sub="Kaunsi table kitna kama rahi — green = top, red = slow" />
      {stats.length === 0 ? (
        <Empty title="No tables" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.table.id} className={`border p-4 ${heatBg(s.heat)}`}>
              <p className="font-display text-xl font-extrabold text-ink">T{s.table.table_number}</p>
              <p className="text-[11.5px] font-semibold text-muted">{s.table.floor_section} · {s.table.capacity} seats</p>
              <p className="mt-2 font-mono text-[15px] font-extrabold text-ink">{fmtPKR(s.revenue)}</p>
              <p className="text-[12px] font-bold text-muted">{fmtNum(s.orders)} orders</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Fulfillment({ orders }: { orders: Order[] }) {
  const data = useMemo(() => {
    const done = orders.filter((o) => (o.status === 'ready' || o.status === 'completed') && o.updated_at);
    if (done.length === 0) return null;
    const mins = done.map((o) => (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000);
    const avg = mins.reduce((s, m) => s + m, 0) / mins.length;
    // avg by hour (peak bottlenecks)
    const byHour = new Map<number, { sum: number; n: number }>();
    done.forEach((o, i) => {
      const h = new Date(o.created_at).getHours();
      const e = byHour.get(h) ?? { sum: 0, n: 0 };
      e.sum += mins[i];
      e.n += 1;
      byHour.set(h, e);
    });
    const hours = [...byHour.entries()]
      .map(([h, e]) => ({ h, avg: e.sum / e.n }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);
    return { avg, count: done.length, slowestHours: hours };
  }, [orders]);

  return (
    <div>
      <SectionHead title="Fulfillment times" sub="Order placed → ready (estimate)" />
      {!data ? (
        <Empty title="No completed orders yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Avg order-to-ready</p>
            <p className={`mt-1 font-display text-3xl font-extrabold ${data.avg > 25 ? 'text-danger' : 'text-ink'}`}>
              {Math.round(data.avg)} <span className="text-base">min</span>
            </p>
            <p className="mt-1 text-[12px] text-muted">Target &lt; 25 min · {fmtNum(data.count)} orders</p>
          </Card>
          <Card className="p-5 sm:col-span-2">
            <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Slowest hours (bottlenecks)</p>
            {data.slowestHours.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted">—</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {data.slowestHours.map((h) => (
                  <li key={h.h} className="flex justify-between text-[13.5px]">
                    <span className="font-bold text-body">
                      {h.h}:00 – {h.h + 1}:00
                    </span>
                    <span className={`font-mono font-extrabold ${h.avg > 25 ? 'text-danger' : 'text-ink'}`}>{Math.round(h.avg)} min avg</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default function OwnerOpsTab({
  restaurantId,
  orders,
  tables,
}: {
  restaurantId: string;
  orders: Order[];
  tables: DiningTable[];
}) {
  return (
    <div className="space-y-8">
      <OwnerKitchenView restaurantId={restaurantId} />
      <TablePerformance orders={orders} tables={tables} />
      <Fulfillment orders={orders} />
    </div>
  );
}
