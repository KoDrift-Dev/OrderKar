'use client';

// Owner "Dashboard" tab: KPIs + smart summary + key charts + QR setup.

import type { Order, OrderItem, Profile, DiningTable } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { CategoryDonut, RevenueTrend } from './charts';
import QrSection from './QrSection';
import OwnerSmartSummary from './OwnerSmartSummary';
import { useT } from '@/lib/i18n';

export interface DashAgg {
  revenue: number;
  orders: number;
  itemsSold: number;
  trend: { label: string; value: number }[];
  cats: { name: string; revenue: number }[];
}

// Hero KPI card: icon tile + label + big value, type-colored top accent.
function HeroKpi({
  label,
  value,
  icon,
  tint,
  bar,
}: {
  label: string;
  value: string;
  icon: string;
  tint: string;
  bar: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-[20px] border border-line border-t-[3px] bg-[var(--c-surface-solid)] p-4 sm:p-5 ${bar}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted sm:text-[11px]">
            {label}
          </p>
          <p className="mt-2 truncate font-mono text-[24px] font-extrabold leading-none text-ink sm:text-[30px]">
            {value}
          </p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[20px] ${tint}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}

// Compact secondary KPI.
function MiniKpi({ label, value, bar }: { label: string; value: string; bar: string }) {
  return (
    <div className={`rounded-[16px] border border-line border-t-[3px] bg-[var(--c-surface-solid)] px-4 py-3.5 ${bar}`}>
      <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1.5 truncate font-mono text-[20px] font-extrabold leading-none text-ink">{value}</p>
    </div>
  );
}

export default function OwnerDashTab({
  agg,
  orders,
  items,
  staff,
  itemOrderDate,
  slug,
  tables,
  restaurantName,
}: {
  agg: DashAgg;
  orders: Order[];
  items: OrderItem[];
  staff: Profile[];
  itemOrderDate: Map<string, string>;
  slug: string;
  tables: DiningTable[];
  restaurantName: string;
}) {
  const t = useT();
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const cancelledValue = cancelled.reduce((s, o) => s + Number(o.total_amount), 0);
  const voidRate = orders.length > 0 ? (cancelled.length / orders.length) * 100 : 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <HeroKpi label="Revenue" value={fmtPKR(agg.revenue)} icon="💰" tint="bg-emerald-500/15" bar="!border-t-emerald-500" />
        <HeroKpi label="Orders" value={fmtNum(agg.orders)} icon="🧾" tint="bg-violet-500/15" bar="!border-t-violet-500" />
        <HeroKpi label="Avg order value" value={fmtPKR(agg.orders ? agg.revenue / agg.orders : 0)} icon="📈" tint="bg-amber-500/15" bar="!border-t-amber-500" />
        <HeroKpi label="Items sold" value={fmtNum(agg.itemsSold)} icon="🍽️" tint="bg-teal-500/15" bar="!border-t-teal-500" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MiniKpi label="Cancelled" value={fmtNum(cancelled.length)} bar="!border-t-rose-500" />
        <MiniKpi label={t('own_kpi_lost')} value={fmtPKR(cancelledValue)} bar="!border-t-orange-500" />
        <MiniKpi label="Void rate" value={`${voidRate.toFixed(1)}%`} bar="!border-t-amber-500" />
        <MiniKpi label="Net revenue" value={fmtPKR(agg.revenue)} bar="!border-t-emerald-500" />
      </div>

      <section>
        <div className="mb-3 flex items-center gap-2.5">
          <h2 className="font-display text-[17px] font-extrabold text-ink">Smart summary</h2>
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-brand">
            Auto
          </span>
        </div>
        <OwnerSmartSummary orders={orders} items={items} staff={staff} itemOrderDate={itemOrderDate} />
      </section>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <RevenueTrend points={agg.trend.map((t) => t.value)} labels={agg.trend.map((t) => t.label)} />
        </div>
        <div className="xl:col-span-2">
          <CategoryDonut cats={agg.cats} />
        </div>
      </div>

      <QrSection slug={slug} tables={tables} restaurantName={restaurantName} />
    </div>
  );
}
