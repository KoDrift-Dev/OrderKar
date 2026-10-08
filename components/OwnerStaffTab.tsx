'use client';

// Owner "Staff" tab: Waiter performance leaderboard with podium showcase,
// sales generation rankings, and staff directory.

import { useMemo } from 'react';
import type { Order, Profile } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { Card, Empty } from './ui';
import { useT, type TKey } from '@/lib/i18n';

const PODIUM_CONFIG = [
  {
    medal: '🥇',
    title: '1st Place',
    border: 'border-amber-400/60 shadow-amber-400/20 shadow-lg',
    badge: 'bg-amber-400/15 text-amber-600 border-amber-400/30',
    headerBg: 'from-amber-400/20 to-orange-400/5',
  },
  {
    medal: '🥈',
    title: '2nd Place',
    border: 'border-slate-300 shadow-slate-400/15 shadow-md',
    badge: 'bg-slate-400/15 text-slate-700 dark:text-slate-200 border-slate-400/30',
    headerBg: 'from-slate-400/20 to-slate-500/5',
  },
  {
    medal: '🥉',
    title: '3rd Place',
    border: 'border-amber-700/50 shadow-amber-700/15 shadow-md',
    badge: 'bg-amber-700/15 text-amber-700 dark:text-amber-300 border-amber-700/30',
    headerBg: 'from-amber-700/20 to-yellow-800/5',
  },
];

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
      .map(([id, e]) => ({
        id,
        name: nameOf.get(id) ?? 'Unknown Waiter',
        ...e,
        aov: e.orders ? e.revenue / e.orders : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders, staff]);

  const topThree = rows.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[16px] font-extrabold tracking-tight text-ink">
            Waiter Sales Leaderboard
          </h2>
          <p className="mt-0.5 text-[12.5px] font-medium text-muted">
            Individual floor performance and revenue generation across tables
          </p>
        </div>
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
          {rows.length} active servers
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty title={t('own_stf_no_sales' as TKey)} sub={t('own_stf_no_sales_sub' as TKey)} />
      ) : (
        <>
          {/* ── Top 3 Podium Cards ── */}
          {topThree.length > 0 && (
            <div className="grid gap-3.5 sm:grid-cols-3">
              {topThree.map((server, i) => {
                const pod = PODIUM_CONFIG[i];
                return (
                  <Card
                    key={server.id}
                    className={`relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 ${pod.border}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{pod.medal}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${pod.badge}`}>
                        {pod.title}
                      </span>
                    </div>

                    <div className="mt-3">
                      <p className="font-display text-[16px] font-black text-ink truncate">
                        {server.name}
                      </p>
                      <p className="mt-1 font-mono text-[24px] font-black text-brand leading-none">
                        {fmtPKR(server.revenue)}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-2.5 text-[12px] font-medium text-muted">
                      <span>{fmtNum(server.orders)} orders taken</span>
                      <span>Avg: {fmtPKR(server.aov)}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Full Waiter Ranking Table ── */}
          <Card className="overflow-hidden p-0 transition-all hover:border-brand/30">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-soft/60 text-[11.5px] font-extrabold uppercase tracking-wider text-muted">
                    <th className="px-5 py-3.5">Rank</th>
                    <th className="px-5 py-3.5">Staff Member</th>
                    <th className="px-5 py-3.5 text-center">Orders Taken</th>
                    <th className="px-5 py-3.5 text-right">Total Revenue</th>
                    <th className="px-5 py-3.5 text-right">Avg Order Ticket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r, i) => (
                    <tr
                      key={r.id}
                      className="transition-colors hover:bg-soft/40"
                    >
                      <td className="px-5 py-3.5">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-soft text-[11.5px] font-black text-ink">
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-extrabold text-ink">
                        {r.name}
                      </td>
                      <td className="px-5 py-3.5 text-center font-mono font-bold text-body">
                        {fmtNum(r.orders)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[14px] font-black text-ink">
                        {fmtPKR(r.revenue)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-muted">
                        {fmtPKR(r.aov)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const ROLE_COLORS: Record<string, { label: string; badge: string }> = {
  owner: { label: 'Owner', badge: 'bg-amber-500/15 text-amber-600 border-amber-500/25' },
  manager: { label: 'Manager', badge: 'bg-violet-500/15 text-violet-600 border-violet-500/25' },
  kitchen: { label: 'Kitchen Chef', badge: 'bg-teal-500/15 text-teal-600 border-teal-500/25' },
  waiter: { label: 'Floor Server', badge: 'bg-blue-500/15 text-blue-600 border-blue-500/25' },
};

export default function OwnerStaffTab({ orders, staff }: { orders: Order[]; staff: Profile[] }) {
  const t = useT();

  return (
    <div className="space-y-8">
      {/* Waiter Leaderboard */}
      <Leaderboard orders={orders} staff={staff} />

      {/* Staff Directory Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-[16px] font-extrabold tracking-tight text-ink">
              Staff Directory
            </h2>
            <p className="mt-0.5 text-[12.5px] font-medium text-muted">
              Team members authorized on this restaurant workspace
            </p>
          </div>
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
            {staff.length} staff accounts
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {staff.map((s) => {
            const roleInfo = ROLE_COLORS[s.role] || {
              label: s.role,
              badge: 'bg-soft text-muted border-line',
            };

            return (
              <Card
                key={s.id}
                className="group p-5 transition-all duration-200 hover:-translate-y-1 hover:border-brand/40 flex flex-col justify-between min-h-[170px]"
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-brand/20 to-teal/10 font-display text-[16px] font-black text-brand shadow-sm">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider ${roleInfo.badge}`}
                    >
                      {roleInfo.label}
                    </span>
                  </div>

                  <div className="mt-3.5">
                    <p className="font-display text-[15px] font-black text-ink truncate group-hover:text-brand transition-colors">
                      {s.name}
                    </p>
                    {s.phone ? (
                      <p className="mt-1 font-mono text-[12px] font-medium text-muted truncate">
                        {s.phone}
                      </p>
                    ) : (
                      <p className="mt-1 text-[12px] italic text-muted">No phone recorded</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-2.5 text-[11.5px]">
                  <span className="font-semibold text-muted">Status</span>
                  <span
                    className={`inline-flex items-center gap-1.5 font-bold ${
                      s.is_active ? 'text-ok' : 'text-danger'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${s.is_active ? 'bg-ok' : 'bg-danger'}`}
                    />
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </Card>
            );
          })}

          {staff.length === 0 && (
            <div className="col-span-full">
              <Empty title={t('own_stf_no_staff' as TKey)} sub={t('own_stf_no_staff_sub' as TKey)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
