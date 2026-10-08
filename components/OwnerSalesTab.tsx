'use client';

// Owner "Sales" tab: sales analytics, payment gateways, channel breakdown,
// cancellation audits, and one-click financial CSV reports.

import { useState, useMemo } from 'react';
import type { Order, OrderItem } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { printExecutivePdf, exportAsCsv } from '@/lib/report-export';
import { HourlyHeatmap, TopItems, WeekdayBars } from './charts';
import { Card, SectionHead } from './ui';
import { useT } from '@/lib/i18n';

const PAY_CONFIG: Record<string, { label: string; icon: string; color: string; badge: string }> = {
  cash: { label: 'Cash on Delivery / Counter', icon: '💵', color: '#10b981', badge: 'bg-emerald-500/10 text-emerald-600' },
  card: { label: 'Credit / Debit Card', icon: '💳', color: '#3b82f6', badge: 'bg-blue-500/10 text-blue-600' },
  jazzcash: { label: 'JazzCash Wallet', icon: '📱', color: '#ef4444', badge: 'bg-red-500/10 text-red-600' },
  easypaisa: { label: 'EasyPaisa Wallet', icon: '📲', color: '#10b981', badge: 'bg-emerald-500/10 text-emerald-600' },
};

function PaymentShareCard({ data }: { data: { key: string; name: string; revenue: number; orders: number }[] }) {
  const t = useT();
  const total = data.reduce((s, d) => s + d.revenue, 0) || 1;

  return (
    <Card className="p-5 sm:p-6 transition-all duration-300 hover:border-brand/30">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-[16px] font-extrabold text-ink">Payment Methods</h3>
          <p className="mt-0.5 text-[12.5px] font-medium text-muted">Settled revenue by payment instrument</p>
        </div>
        <span className="font-mono text-[13px] font-extrabold text-brand">
          {fmtPKR(total)} total
        </span>
      </div>

      {data.length === 0 ? (
        <p className="py-8 text-center text-sm font-medium text-muted">{t('own_no_data')}</p>
      ) : (
        <div className="space-y-3.5">
          {data.map((item) => {
            const cfg = PAY_CONFIG[item.key] || {
              label: item.name,
              icon: '💰',
              color: 'var(--c-brand)',
              badge: 'bg-brand/10 text-brand',
            };
            const pct = Math.round((item.revenue / total) * 100);

            return (
              <div
                key={item.key}
                className="group rounded-[14px] border border-line/60 bg-[var(--c-surface-solid)] p-3 transition-all hover:border-brand/40"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-soft text-[15px] shadow-sm">
                      {cfg.icon}
                    </span>
                    <div>
                      <p className="text-[13.5px] font-extrabold text-ink group-hover:text-brand transition-colors">
                        {cfg.label}
                      </p>
                      <p className="text-[11.5px] font-medium text-muted">
                        {fmtNum(item.orders)} transactions
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[14px] font-extrabold text-ink">{fmtPKR(item.revenue)}</p>
                    <span className="font-mono text-[11.5px] font-bold text-muted">{pct}% share</span>
                  </div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-soft">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                  />
                </div>
              </div>
            );
          })}
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
  restaurantName,
  logoUrl,
}: {
  orders: Order[];
  items: OrderItem[];
  hours: number[];
  weekdays: number[];
  topItems: { name: string; qty: number; revenue: number }[];
  rangeLabel: string;
  restaurantName?: string;
  logoUrl?: string;
}) {
  const t = useT();
  const [downloadOpen, setDownloadOpen] = useState(false);

  const payments = useMemo(() => {
    const revMap = new Map<string, number>();
    const countMap = new Map<string, number>();

    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      const k = o.payment_method ?? 'cash';
      revMap.set(k, (revMap.get(k) ?? 0) + Number(o.total_amount));
      countMap.set(k, (countMap.get(k) ?? 0) + 1);
    }

    return [...revMap.entries()]
      .map(([k, revenue]) => ({
        key: k,
        name: PAY_CONFIG[k]?.label ?? k,
        revenue,
        orders: countMap.get(k) ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const orderTypes = useMemo(() => {
    const m = new Map<string, { count: number; rev: number }>();
    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      const typeKey =
        o.order_type === 'dine_in'
          ? '🍽️ Dine-in Table'
          : o.order_type === 'takeaway'
          ? '🥡 Takeaway Pickup'
          : '🛵 Home Delivery';
      const cur = m.get(typeKey) ?? { count: 0, rev: 0 };
      cur.count += 1;
      cur.rev += Number(o.total_amount);
      m.set(typeKey, cur);
    }
    const totalCount = [...m.values()].reduce((s, v) => s + v.count, 0) || 1;
    return [...m.entries()].map(([name, data]) => ({
      name,
      count: data.count,
      revenue: data.rev,
      pct: (data.count / totalCount) * 100,
    }));
  }, [orders]);

  const cancelled = useMemo(() => {
    const list = orders.filter((o) => o.status === 'cancelled');
    const value = list.reduce((s, o) => s + Number(o.total_amount), 0);
    const reasons = new Map<string, number>();
    for (const o of list) {
      reasons.set(
        o.cancel_reason ?? t('own_cancel_no_reason'),
        (reasons.get(o.cancel_reason ?? t('own_cancel_no_reason')) ?? 0) + 1
      );
    }
    return { list, value, reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]) };
  }, [orders, t]);

  const handleExportSalesCsv = () => {
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
    exportAsCsv(
      `daily_sales_${rangeLabel}.csv`,
      ['Date', 'Orders Completed', 'Revenue (PKR)', 'Cancelled Voids'],
      [...byDay.entries()].map(([d, e]) => [d, e.orders, Math.round(e.revenue), e.cancelled])
    );
    setDownloadOpen(false);
  };

  const handleExportSalesPdf = () => {
    const byDay = new Map<string, { orders: number; revenue: number; cancelled: number }>();
    let totalRev = 0;
    let completedCount = 0;
    for (const o of orders) {
      const d = new Date(o.created_at).toLocaleDateString('en-PK');
      const e = byDay.get(d) ?? { orders: 0, revenue: 0, cancelled: 0 };
      if (o.status === 'cancelled') {
        e.cancelled += 1;
      } else {
        e.orders += 1;
        e.revenue += Number(o.total_amount);
        totalRev += Number(o.total_amount);
        completedCount += 1;
      }
      byDay.set(d, e);
    }

    printExecutivePdf({
      restaurantName,
      logoUrl,
      title: 'Sales & Revenue Daily Ledger',
      dateRange: rangeLabel,
      kpis: [
        { label: 'Completed Volume', value: fmtPKR(totalRev) },
        { label: 'Cancelled Voids', value: String(cancelled.list.length) },
        { label: 'Audit Range', value: rangeLabel },
      ],
      headers: ['Date', 'Completed Orders', 'Net Revenue', 'Cancelled Voids'],
      rows: [...byDay.entries()].map(([d, e]) => [
        d,
        String(e.orders),
        fmtPKR(e.revenue),
        String(e.cancelled),
      ]),
    });
    setDownloadOpen(false);
  };

  const handleExportMixCsv = () => {
    exportAsCsv(
      `product_mix_${rangeLabel}.csv`,
      ['Dish Name', 'Portions Sold', 'Revenue (PKR)'],
      topItems.map((t) => [t.name, t.qty, Math.round(t.revenue)])
    );
    setDownloadOpen(false);
  };

  const handleExportMixPdf = () => {
    const totalMixRevenue = topItems.reduce((acc, i) => acc + i.revenue, 0);
    const totalMixQty = topItems.reduce((acc, i) => acc + i.qty, 0);

    printExecutivePdf({
      restaurantName,
      logoUrl,
      title: 'Product Mix & Dish Performance Report',
      dateRange: rangeLabel,
      kpis: [
        { label: 'Dishes Tracked', value: String(topItems.length) },
        { label: 'Portions Sold', value: fmtNum(totalMixQty) },
        { label: 'Dishes Revenue', value: fmtPKR(totalMixRevenue) },
      ],
      headers: ['Rank', 'Dish Name', 'Portions Sold', 'Revenue (PKR)'],
      rows: topItems.map((t, idx) => [
        `#${idx + 1}`,
        t.name,
        fmtNum(t.qty),
        fmtPKR(t.revenue),
      ]),
    });
    setDownloadOpen(false);
  };

  const voidRate = orders.length > 0 ? (cancelled.list.length / orders.length) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* ── Top Header & Report Download Buttons ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
              Sales & Financial Intelligence
            </h2>
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
              {rangeLabel}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted">Detailed transaction channels, settlement breakdown, and audits</p>
        </div>

        <div className="relative">
          <button
            onClick={() => setDownloadOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-btn bg-brand px-4 py-2.5 text-[13px] font-bold text-white shadow-lift transition-all hover:brightness-105 active:translate-y-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download Reports</span>
            <svg
              className={`h-4 w-4 transition-transform duration-200 ${downloadOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {downloadOpen && (
            <div
              className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-line bg-[var(--c-surface-solid)] p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted">
                Daily Sales Ledger
              </div>
              <button
                onClick={handleExportSalesPdf}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12.5px] font-bold text-ink transition-colors hover:bg-brand/10 hover:text-brand"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                  📄
                </span>
                <div>
                  <div>Sales Ledger PDF</div>
                  <div className="text-[10px] font-medium text-muted">Printable with logo & branding</div>
                </div>
              </button>
              <button
                onClick={handleExportSalesCsv}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12.5px] font-bold text-ink transition-colors hover:bg-emerald-500/10 hover:text-emerald-600"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  📊
                </span>
                <div>
                  <div>Sales Ledger Excel / CSV</div>
                  <div className="text-[10px] font-medium text-muted">Spreadsheet raw data file</div>
                </div>
              </button>

              <div className="my-1.5 border-t border-line" />

              <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted">
                Product Mix Matrix
              </div>
              <button
                onClick={handleExportMixPdf}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12.5px] font-bold text-ink transition-colors hover:bg-rose-500/10 hover:text-rose-500"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                  📄
                </span>
                <div>
                  <div>Product Mix PDF</div>
                  <div className="text-[10px] font-medium text-muted">Printable with logo & branding</div>
                </div>
              </button>
              <button
                onClick={handleExportMixCsv}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12.5px] font-bold text-ink transition-colors hover:bg-emerald-500/10 hover:text-emerald-600"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  📊
                </span>
                <div>
                  <div>Product Mix Excel / CSV</div>
                  <div className="text-[10px] font-medium text-muted">Spreadsheet raw data file</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Analytics Grid ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <HourlyHeatmap hours={hours} />
        <WeekdayBars days={weekdays} />
        <TopItems items={topItems} />
        <PaymentShareCard data={payments} />

        {/* ── Order Channels ── */}
        <Card className="p-5 sm:p-6 transition-all duration-300 hover:border-brand/30">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-[16px] font-extrabold text-ink">Service Channels</h3>
              <p className="mt-0.5 text-[12.5px] font-medium text-muted">Dine-in vs takeaway vs delivery mix</p>
            </div>
            <span className="font-mono text-[13px] font-extrabold text-muted">
              {orders.length} tickets
            </span>
          </div>

          <div className="space-y-3.5">
            {orderTypes.length === 0 && (
              <p className="py-6 text-center text-sm font-medium text-muted">{t('own_no_data')}</p>
            )}
            {orderTypes.map((channel) => (
              <div
                key={channel.name}
                className="group rounded-[14px] border border-line/60 bg-[var(--c-surface-solid)] p-3 transition-all hover:border-brand/40"
              >
                <div className="mb-2 flex items-center justify-between text-[13px]">
                  <span className="font-extrabold text-ink group-hover:text-brand transition-colors">
                    {channel.name}
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-ink">{fmtPKR(channel.revenue)}</span>
                    <span className="ml-2 font-mono text-[11.5px] font-bold text-muted">
                      ({channel.count} · {channel.pct.toFixed(0)}%)
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-soft">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-teal transition-all duration-500"
                    style={{ width: `${channel.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Void & Cancellation Audit ── */}
        <Card className="p-5 sm:p-6 transition-all duration-300 hover:border-brand/30">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-[16px] font-extrabold text-ink">Cancellation & Void Audit</h3>
              <p className="mt-0.5 text-[12.5px] font-medium text-muted">
                {fmtNum(cancelled.list.length)} tickets voided · Total lost: {fmtPKR(cancelled.value)}
              </p>
            </div>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${
                voidRate <= 2
                  ? 'bg-ok/10 text-ok border-ok/20'
                  : 'bg-danger/10 text-danger border-danger/20'
              }`}
            >
              {voidRate.toFixed(1)}% Void Rate
            </span>
          </div>

          {cancelled.reasons.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-ok/30 bg-ok/5 p-6 text-center">
              <span className="text-2xl">✨</span>
              <p className="mt-1 font-display text-[14px] font-extrabold text-ok">No Cancellations Recorded</p>
              <p className="mt-0.5 text-[12px] text-muted">Zero voided orders during this selected timeline.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cancelled.reasons.map(([reason, count]) => {
                const ratio = Math.round((count / Math.max(1, cancelled.list.length)) * 100);
                return (
                  <div
                    key={reason}
                    className="rounded-[14px] border border-line/60 bg-[var(--c-surface-solid)] p-3 transition-all hover:border-danger/40"
                  >
                    <div className="mb-2 flex items-center justify-between text-[13px]">
                      <span className="font-extrabold capitalize text-ink">{reason}</span>
                      <span className="font-mono font-extrabold text-danger">
                        {count} orders ({ratio}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-soft">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-danger to-orange-500 transition-all duration-500"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
