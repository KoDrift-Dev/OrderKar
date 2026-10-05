'use client';

// Owner "Staff" tab: waiter performance leaderboard + staff directory.

import { useMemo } from 'react';
import type { Order, Profile } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { Card, Empty, SectionHead } from './ui';
import { useT, type TKey } from '@/lib/i18n';

const MEDALS = ['🥇', '🥈', '🥉'];

function Leaderboard({ orders, staff }: { orders: Order[]; staff: Profile[] }) {
  const t = useT();
  const rows = useMemo(() => {
    const nameOf = new Map(staff.map((s) => [s.id, s.name]));
    const m = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      if (!o.waiter_id || o.status === 'cancelled') continue;
      const e = m.get(o.waiter_id) ?? { orders: 0, revenue: 0 };
      e.orders += 1;
      e.revenue += Number(o.total_amount);
      m.set(o.waiter_id, e);
    }
    return [...m.entries()]
      .map(([id, e]) => ({ id, name: nameOf.get(id) ?? 'Unknown', ...e, aov: e.orders ? e.revenue / e.orders : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders, staff]);

  return (
    <div>
      <SectionHead title="Waiter leaderboard" sub={t('own_stf_sub' as TKey)} />
      {rows.length === 0 ? (
        <Empty title={t('own_stf_no_sales' as TKey)} sub={t('own_stf_no_sales_sub' as TKey)} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11.5px] uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Waiter</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Sales</th>
                <th className="px-4 py-3">Avg order</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-[16px]">{MEDALS[i] ?? <span className="font-mono text-[13px] font-bold text-muted">#{i + 1}</span>}</td>
                  <td className="px-4 py-3 font-extrabold text-ink">{r.name}</td>
                  <td className="px-4 py-3 font-mono font-bold text-body">{fmtNum(r.orders)}</td>
                  <td className="px-4 py-3 font-mono font-extrabold text-ink">{fmtPKR(r.revenue)}</td>
                  <td className="px-4 py-3 font-mono font-bold text-muted">{fmtPKR(r.aov)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

export default function OwnerStaffTab({ orders, staff }: { orders: Order[]; staff: Profile[] }) {
  const t = useT();
  return (
    <div className="space-y-8">
      <Leaderboard orders={orders} staff={staff} />
      <div>
        <SectionHead title="Staff directory" sub={`${staff.length} team members`} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {staff.map((s) => (
            <Card key={s.id} className="p-4">
              <p className="font-display text-[15px] font-extrabold text-ink">{s.name}</p>
              <p className="mt-0.5 text-[12.5px] font-bold uppercase tracking-wide text-brand">{s.role}</p>
              {s.phone && <p className="mt-1 font-mono text-[12.5px] text-muted">{s.phone}</p>}
              {!s.is_active && <p className="mt-1 text-[12px] font-bold text-danger">Inactive</p>}
            </Card>
          ))}
          {staff.length === 0 && <Empty title={t('own_stf_no_staff' as TKey)} sub={t('own_stf_no_staff_sub' as TKey)} />}
        </div>
      </div>
    </div>
  );
}
