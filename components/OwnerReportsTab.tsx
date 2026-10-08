'use client';

// Order-level reports: date filter (today / yesterday / 7d / 30d),
// summary strip, full order table, CSV download.

import { useMemo, useState } from 'react';
import type { DiningTable, Order, OrderItem } from '@/lib/types';
import { fmtPKR } from '@/lib/format';
import { Tabs, Empty } from './ui';
import { downloadCsv } from '@/lib/csv';

type FKey = 'today' | 'yesterday' | '7d' | '30d';

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function OwnerReportsTab({
  orders,
  items,
  tables,
}: {
  orders: Order[];
  items: OrderItem[];
  tables: DiningTable[];
}) {
  const [f, setF] = useState<FKey>('today');

  const tableNo = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tables) m.set(t.id, t.table_number);
    return m;
  }, [tables]);

  const itemCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.order_id, (m.get(i.order_id) ?? 0) + i.quantity);
    return m;
  }, [items]);

  const rows = useMemo(() => {
    const now = new Date();
    const t0 = dayStart(now).getTime();
    const y0 = t0 - 86400000;
    let from = t0;
    let to = Infinity;
    if (f === 'today') {
      from = t0;
    } else if (f === 'yesterday') {
      from = y0;
      to = t0;
    } else if (f === '7d') {
      from = t0 - 6 * 86400000;
    } else {
      from = t0 - 29 * 86400000;
    }
    return orders
      .filter((o) => {
        const t = +new Date(o.created_at);
        return t >= from && t < to;
      })
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [orders, f]);

  const sum = useMemo(() => {
    const live = rows.filter((o) => o.status !== 'cancelled');
    const rev = live.reduce((a, o) => a + Number(o.total_amount), 0);
    const cx = rows.filter((o) => o.status === 'cancelled').length;
    return { n: rows.length, rev, avg: live.length ? rev / live.length : 0, cx };
  }, [rows]);

  const csv = () => {
    downloadCsv(
      `orders-${f}.csv`,
      [
        ['Order', 'Date', 'Time', 'Type', 'Table', 'Items', 'Total (Rs)', 'Payment', 'Status'],
        ...rows.map((o) => {
          const d = new Date(o.created_at);
          return [
            o.order_number,
            d.toLocaleDateString(),
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            o.order_type,
            o.table_id ? `T${tableNo.get(o.table_id) ?? '?'}` : o.order_type,
            itemCount.get(o.id) ?? 0,
            Number(o.total_amount),
            o.payment_method || '',
            o.status,
          ];
        }),
      ],
    );
  };

  const statusStyle = (s: string) =>
    s === 'cancelled'
      ? 'bg-rose-500/15 text-rose-600'
      : s === 'completed'
        ? 'bg-emerald-500/15 text-emerald-600'
        : 'bg-amber-500/15 text-amber-600';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs<FKey>
          wrap
          active={f}
          onChange={setF}
          tabs={[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: '7d', label: '7 days' },
            { key: '30d', label: '30 days' },
          ]}
        />
        <button
          onClick={csv}
          disabled={rows.length === 0}
          className="btn-3d rounded-[12px] px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
        >
          ⬇ CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[
          { l: 'Orders', v: String(sum.n), icon: '🧾', bar: '!border-t-violet-500' },
          { l: 'Revenue', v: fmtPKR(sum.rev), icon: '💰', bar: '!border-t-emerald-500' },
          { l: 'Avg order', v: fmtPKR(sum.avg), icon: '📈', bar: '!border-t-amber-500' },
          { l: 'Cancelled', v: String(sum.cx), icon: '❌', bar: '!border-t-rose-500' },
        ].map((k) => (
          <div key={k.l} className={`rounded-[16px] border border-line border-t-[3px] bg-[var(--c-surface-solid)] p-4 ${k.bar}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted">{k.l}</p>
                <p className="mt-1.5 truncate font-mono text-[22px] font-extrabold leading-none text-ink">{k.v}</p>
              </div>
              <span className="text-[20px]">{k.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty title="No orders in this period." />
      ) : (
        <div className="overflow-x-auto rounded-[18px] border border-line bg-[var(--c-surface-solid)]">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                {['Order', 'Time', 'Type', 'Table', 'Items', 'Total', 'Payment', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 font-extrabold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const d = new Date(o.created_at);
                return (
                  <tr key={o.id} className="border-b border-line/60 last:border-0 hover:bg-soft/60">
                    <td className="px-4 py-3 font-mono font-extrabold text-ink">#{o.order_number}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {d.toLocaleDateString([], { day: 'numeric', month: 'short' })}{' '}
                      {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 capitalize text-ink">{o.order_type}</td>
                    <td className="px-4 py-3 text-ink">
                      {o.table_id ? `T${tableNo.get(o.table_id) ?? '?'}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink">{itemCount.get(o.id) ?? 0}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-ink">
                      {fmtPKR(Number(o.total_amount))}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted">{o.payment_method || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold capitalize ${statusStyle(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
