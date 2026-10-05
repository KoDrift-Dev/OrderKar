'use client';

// Owner "Dashboard" tab: KPIs + smart summary + key charts + QR setup.

import type { Order, OrderItem, Profile, DiningTable } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { CategoryDonut, RevenueTrend } from './charts';
import QrSection from './QrSection';
import OwnerSmartSummary from './OwnerSmartSummary';
import { Kpi } from './ui';

export interface DashAgg {
  revenue: number;
  orders: number;
  itemsSold: number;
  trend: { label: string; value: number }[];
  cats: { name: string; revenue: number }[];
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
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const cancelledValue = cancelled.reduce((s, o) => s + Number(o.total_amount), 0);
  const voidRate = orders.length > 0 ? (cancelled.length / orders.length) * 100 : 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue" value={fmtPKR(agg.revenue)} />
        <Kpi label="Orders" value={fmtNum(agg.orders)} />
        <Kpi label="Avg order value" value={fmtPKR(agg.orders ? agg.revenue / agg.orders : 0)} />
        <Kpi label="Items sold" value={fmtNum(agg.itemsSold)} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Cancelled" value={fmtNum(cancelled.length)} />
        <Kpi label="Lost to cancels" value={fmtPKR(cancelledValue)} />
        <Kpi label="Void rate" value={`${voidRate.toFixed(1)}%`} />
        <Kpi label="Net revenue" value={fmtPKR(agg.revenue)} />
      </div>

      <OwnerSmartSummary orders={orders} items={items} staff={staff} itemOrderDate={itemOrderDate} />

      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueTrend points={agg.trend.map((t) => t.value)} labels={agg.trend.map((t) => t.label)} />
        <CategoryDonut cats={agg.cats} />
      </div>

      <QrSection slug={slug} tables={tables} restaurantName={restaurantName} />
    </div>
  );
}
