'use client';

// Owner "Operations" tab: Live kitchen command monitor, table revenue performance,
// and kitchen fulfillment velocity benchmarks.

import { useMemo } from 'react';
import type { DiningTable, Order } from '@/lib/types';
import TableCard, { tableState } from './TableCard';
import { fmtPKR, fmtNum } from '@/lib/format';
import OwnerKitchenView from './OwnerKitchenView';
import { Card, Empty, SectionHead } from './ui';
import { useT, type TKey } from '@/lib/i18n';

function TablePerformance({ orders, tables }: { orders: Order[]; tables: DiningTable[] }) {
  const t = useT();

  const stats = useMemo(() => {
    const m = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      if (!o.table_id || o.status === 'cancelled') continue;
      const e = m.get(o.table_id) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue += Number(o.total_amount);
      m.set(o.table_id, e);
    }
    return tables
      .filter((t) => t.is_active)
      .map((t) => {
        const e = m.get(t.id) ?? { orders: 0, revenue: 0 };
        return { table: t, ...e, state: tableState(t.id, orders) };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders, tables]);

  const totalTableRev = stats.reduce((s, t) => s + t.revenue, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[16px] font-extrabold tracking-tight text-ink">
              Table Performance & Turnaround
            </h2>
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
              {stats.length} active tables
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] font-medium text-muted">
            Revenue generated and live occupancy by dining station
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Table Sales</span>
          <p className="font-mono text-[14px] font-black text-ink">{fmtPKR(totalTableRev)}</p>
        </div>
      </div>

      {stats.length === 0 ? (
        <Empty title="No Active Tables" sub="Add dining tables in the Floor & Tables section." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((s) => (
            <TableCard
              key={s.table.id}
              table={s.table}
              state={s.state}
              meta={
                <div className="flex items-baseline justify-between gap-1 pt-1">
                  <p className="font-mono text-[14px] font-extrabold">{fmtPKR(s.revenue)}</p>
                  <p className="text-[11.5px] font-bold opacity-80">{fmtNum(s.orders)} orders</p>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Fulfillment({ orders }: { orders: Order[] }) {
  const t = useT();

  const data = useMemo(() => {
    const done = orders.filter(
      (o) => (o.status === 'ready' || o.status === 'completed') && o.updated_at
    );
    if (done.length === 0) return null;

    const mins = done.map(
      (o) => (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60000
    );
    const avg = mins.reduce((s, m) => s + m, 0) / mins.length;

    // avg by hour to find bottleneck rush slots
    const byHour = new Map<number, { sum: number; n: number }>();
    done.forEach((o, i) => {
      const h = new Date(o.created_at).getHours();
      const e = byHour.get(h) ?? { sum: 0, n: 0 };
      e.sum += mins[i];
      e.n += 1;
      byHour.set(h, e);
    });

    const hours = [...byHour.entries()]
      .map(([h, e]) => ({ h, avg: e.sum / e.n, count: e.n }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);

    return { avg, count: done.length, slowestHours: hours };
  }, [orders]);

  const formatHour = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const num = h % 12 === 0 ? 12 : h % 12;
    return `${num}:00 ${ampm}`;
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-display text-[16px] font-extrabold tracking-tight text-ink">
          Kitchen Speed & Fulfillment Velocity
        </h2>
        <p className="mt-0.5 text-[12.5px] font-medium text-muted">
          Elapsed duration from customer order submission to kitchen &ldquo;Ready&rdquo; status
        </p>
      </div>

      {!data ? (
        <Empty title={t('own_ops_no_done' as TKey)} sub="Speed metrics will appear when orders are marked ready." />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-3">
          {/* Main Average Velocity Card */}
          <Card className="stat-card-luxury p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-extrabold uppercase tracking-wider text-muted">
                  {t('own_ops_avg_ready' as TKey)}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold ${
                    data.avg <= 20
                      ? 'bg-ok/10 text-ok border-ok/20'
                      : data.avg <= 25
                      ? 'bg-amber/10 text-amber border-amber/20'
                      : 'bg-danger/10 text-danger border-danger/20'
                  }`}
                >
                  {data.avg <= 20 ? 'Optimal' : data.avg <= 25 ? 'Normal' : 'Slow'}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <p
                  className={`font-mono text-[36px] font-black leading-none ${
                    data.avg > 25 ? 'text-danger' : 'text-ink'
                  }`}
                >
                  {Math.round(data.avg)}
                </p>
                <span className="text-base font-bold text-muted">minutes avg</span>
              </div>
            </div>

            <p className="mt-4 border-t border-line/70 pt-2.5 text-[12px] font-medium text-muted">
              Standard target &le; 25 min &middot; {fmtNum(data.count)} orders audited
            </p>
          </Card>

          {/* Peak Bottleneck Hours */}
          <Card className="stat-card-luxury p-5 sm:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-extrabold uppercase tracking-wider text-muted">
                  {t('own_ops_slowest' as TKey)}
                </span>
                <span className="text-[11px] font-bold text-muted">Peak wait times</span>
              </div>

              {data.slowestHours.length === 0 ? (
                <p className="mt-4 text-[13px] text-muted">No bottleneck intervals identified yet.</p>
              ) : (
                <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                  {data.slowestHours.map((slot) => {
                    const isHigh = slot.avg > 25;
                    return (
                      <div
                        key={slot.h}
                        className={`rounded-[14px] border p-3 transition-all ${
                          isHigh
                            ? 'border-danger/30 bg-danger/5'
                            : 'border-line/70 bg-[var(--c-surface-solid)]'
                        }`}
                      >
                        <p className="text-[12px] font-bold text-muted">
                          {formatHour(slot.h)} &ndash; {formatHour(slot.h + 1)}
                        </p>
                        <p
                          className={`mt-1 font-mono text-[20px] font-black leading-tight ${
                            isHigh ? 'text-danger' : 'text-ink'
                          }`}
                        >
                          {Math.round(slot.avg)} min
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-muted">
                          {slot.count} orders prepared
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="mt-4 border-t border-line/70 pt-2.5 text-[12px] font-medium text-muted">
              Review kitchen staffing schedules during identified rush periods.
            </p>
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
      {/* Live Kitchen Kanban Monitor */}
      <div className="rounded-[24px] border border-line bg-[var(--c-surface)] p-1 shadow-sm">
        <OwnerKitchenView restaurantId={restaurantId} />
      </div>

      {/* Table Turnaround & Performance */}
      <TablePerformance orders={orders} tables={tables} />

      {/* Kitchen Velocity & Bottlenecks */}
      <Fulfillment orders={orders} />
    </div>
  );
}
