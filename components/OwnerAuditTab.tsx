'use client';

// Owner "Loss & Risk Audit" tab: In-depth financial loss prevention,
// cancellation root-cause analytics, voided ticket logs, and staff audit trails.

import { useMemo } from 'react';
import type { Order, Profile } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { Card } from './ui';

export default function OwnerAuditTab({
  orders,
  staff,
  rangeLabel,
}: {
  orders: Order[];
  staff: Profile[];
  rangeLabel: string;
}) {
  const staffNameMap = useMemo(() => new Map(staff.map((s) => [s.id, s.name])), [staff]);

  const cancelledOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'cancelled')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [orders]
  );

  const completedOrders = useMemo(() => orders.filter((o) => o.status !== 'cancelled'), [orders]);

  const totalLostAmount = useMemo(
    () => cancelledOrders.reduce((sum, o) => sum + Number(o.total_amount), 0),
    [cancelledOrders]
  );

  const totalOrders = orders.length;
  const voidRate = totalOrders > 0 ? (cancelledOrders.length / totalOrders) * 100 : 0;
  const isSafe = voidRate <= 2.0;

  // Breakdown by reasons
  const reasonBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const o of cancelledOrders) {
      const reason = o.cancel_reason?.trim() || 'Unspecified Reason';
      const existing = map.get(reason) || { count: 0, value: 0 };
      existing.count += 1;
      existing.value += Number(o.total_amount);
      map.set(reason, existing);
    }
    return [...map.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [cancelledOrders]);

  return (
    <div className="space-y-8">
      {/* ── 1. Audit Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </span>
            <h2 className="font-display text-[20px] font-black tracking-tight text-ink">
              Loss Prevention & Risk Audit
            </h2>
          </div>
          <p className="mt-1 text-[13px] font-medium text-muted">
            Cancellation telemetry, voided ticket forensic logs, and financial risk mitigation ({rangeLabel})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[12px] font-black ${
              isSafe
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-600'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${isSafe ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}
            />
            {isSafe ? 'Healthy (Void Rate < 2.0%)' : 'Attention: Exceeds 2.0% Safe Threshold'}
          </span>
        </div>
      </div>

      {/* ── 2. Top Summary KPI Cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Lost Sales */}
        <Card className="stat-card-luxury border-2 border-orange-500/40 p-5 shadow-xs hover:border-orange-500 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] font-black uppercase tracking-wider text-muted">Total Lost Sales</p>
              <p className="mt-2 font-mono text-[26px] font-black text-ink">{fmtPKR(totalLostAmount)}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-md shadow-orange-500/25">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          </div>
          <div className="mt-3.5 border-t border-line/70 pt-2.5 text-[12px] font-bold text-muted">
            Unrecovered ticket revenue
          </div>
        </Card>

        {/* Void Tickets */}
        <Card className="stat-card-luxury border-2 border-rose-500/40 p-5 shadow-xs hover:border-rose-500 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] font-black uppercase tracking-wider text-muted">Cancelled Tickets</p>
              <p className="mt-2 font-mono text-[26px] font-black text-ink">{fmtNum(cancelledOrders.length)}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#ef4444] to-[#dc2626] text-white shadow-md shadow-rose-500/25">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>
          <div className="mt-3.5 border-t border-line/70 pt-2.5 text-[12px] font-bold text-muted">
            {cancelledOrders.length === 0 ? 'Optimal: Zero voids' : 'Requires manager review'}
          </div>
        </Card>

        {/* Void Rate */}
        <Card
          className={`stat-card-luxury border-2 p-5 shadow-xs transition-all ${
            isSafe ? 'border-emerald-500/40 hover:border-emerald-500' : 'border-rose-500/40 hover:border-rose-500'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] font-black uppercase tracking-wider text-muted">Void Rate</p>
              <p className="mt-2 font-mono text-[26px] font-black text-ink">{voidRate.toFixed(1)}%</p>
            </div>
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-[14px] text-white shadow-md ${
                isSafe
                  ? 'bg-gradient-to-br from-[#10b981] to-[#059669] shadow-emerald-500/25'
                  : 'bg-gradient-to-br from-[#ef4444] to-[#b91c1c] shadow-rose-500/25'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
          </div>
          <div className="mt-3.5 border-t border-line/70 pt-2.5 text-[12px] font-bold text-muted">
            Target benchmark &lt; 2.0%
          </div>
        </Card>

        {/* Retained Sales */}
        <Card className="stat-card-luxury border-2 border-emerald-500/40 p-5 shadow-xs hover:border-emerald-500 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] font-black uppercase tracking-wider text-muted">Retained Orders</p>
              <p className="mt-2 font-mono text-[26px] font-black text-ink">{fmtNum(completedOrders.length)}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-md shadow-emerald-500/25">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div className="mt-3.5 border-t border-line/70 pt-2.5 text-[12px] font-bold text-muted">
            Successfully prepared & billed
          </div>
        </Card>
      </div>

      {/* ── 3. Cancellation Reason Breakdown ── */}
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-display text-[17px] font-black text-ink">Root Cause Analysis</h3>
            <p className="text-[13px] font-medium text-muted">
              Classification of order cancellations by primary reported reason
            </p>
          </div>
          <span className="font-mono text-[13px] font-black text-muted">
            {reasonBreakdown.length} unique reasons
          </span>
        </div>

        {reasonBreakdown.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-emerald-500/40 bg-emerald-500/5 p-8 text-center">
            <span className="text-3xl">🎉</span>
            <h4 className="mt-2 font-display text-[16px] font-black text-emerald-600">No Cancellations Recorded</h4>
            <p className="mt-1 text-[13px] text-muted">
              All placed orders in this window have been retained with 0 voided tickets.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reasonBreakdown.map(([reason, data]) => {
              const pctOfVoids = Math.round((data.count / cancelledOrders.length) * 100);
              const pctOfLostVal = totalLostAmount > 0 ? Math.round((data.value / totalLostAmount) * 100) : 0;
              return (
                <div
                  key={reason}
                  className="rounded-[14px] border border-line bg-[var(--c-surface-solid)] p-4 transition-all hover:border-brand/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-500/10 text-[11px] font-black text-rose-600">
                        ✕
                      </span>
                      <span className="font-extrabold capitalize text-[14px] text-ink">{reason}</span>
                    </div>
                    <div className="flex items-center gap-4 text-right font-mono">
                      <span className="text-[13px] font-extrabold text-muted">
                        {fmtNum(data.count)} orders ({pctOfVoids}%)
                      </span>
                      <span className="text-[14px] font-black text-rose-600">
                        {fmtPKR(data.value)} ({pctOfLostVal}%)
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-soft">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-500 transition-all duration-500"
                      style={{ width: `${Math.max(5, pctOfVoids)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── 4. Detailed Voided Tickets Audit Log ── */}
      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="font-display text-[17px] font-black text-ink">Voided Tickets Log</h3>
            <p className="text-[13px] font-medium text-muted">
              Chronological log of voided orders for audit and staff accountability
            </p>
          </div>
          <span className="font-mono text-[13px] font-bold text-muted">
            {cancelledOrders.length} records
          </span>
        </div>

        {cancelledOrders.length === 0 ? (
          <p className="py-6 text-center text-sm font-medium text-muted">No voided tickets found in this period.</p>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11.5px] font-black uppercase tracking-wider text-muted">
                  <th className="pb-3 pr-4">Order #</th>
                  <th className="pb-3 pr-4">Time</th>
                  <th className="pb-3 pr-4">Server / Waiter</th>
                  <th className="pb-3 pr-4">Order Type</th>
                  <th className="pb-3 pr-4">Cancellation Reason</th>
                  <th className="pb-3 text-right">Lost Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 font-medium">
                {cancelledOrders.map((o) => {
                  const d = new Date(o.created_at);
                  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                  const waiterName = o.waiter_id ? staffNameMap.get(o.waiter_id) || 'Staff' : 'Self / Counter';

                  return (
                    <tr key={o.id} className="hover:bg-soft/50 transition-colors">
                      <td className="py-3.5 pr-4 font-mono font-black text-ink">
                        #{o.order_number || o.id.slice(0, 6)}
                      </td>
                      <td className="py-3.5 pr-4 text-muted">
                        {dateStr} &middot; {timeStr}
                      </td>
                      <td className="py-3.5 pr-4 text-ink font-bold">{waiterName}</td>
                      <td className="py-3.5 pr-4 capitalize text-muted">{o.order_type || 'dine_in'}</td>
                      <td className="py-3.5 pr-4">
                        <span className="inline-flex rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11.5px] font-black text-rose-600">
                          {o.cancel_reason || 'Unspecified'}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-mono font-black text-rose-600">
                        {fmtPKR(o.total_amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
