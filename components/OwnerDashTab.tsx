'use client';

// Owner "Dashboard" tab: Executive command center with luxury KPI cards,
// loss prevention telemetry, realtime operational pulse, smooth charts, and floor QR launchpad.

import type { Order, OrderItem, Profile, DiningTable } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { CategoryDonut, RevenueTrend } from './charts';
import QrSection from './QrSection';
import OwnerSmartSummary from './OwnerSmartSummary';
import { Card } from './ui';
import { useT } from '@/lib/i18n';

export interface DashAgg {
  revenue: number;
  orders: number;
  itemsSold: number;
  trend: { label: string; value: number }[];
  cats: { name: string; revenue: number }[];
}

export interface MetricComparison {
  text: string;
  isPositive: boolean;
  isNeutral?: boolean;
}

export interface KpiComparisons {
  compLabel: string;
  revenue: MetricComparison;
  orders: MetricComparison;
  aov: MetricComparison;
  itemsSold: MetricComparison;
  net: MetricComparison;
  cancelled: MetricComparison;
  lost: MetricComparison;
  voidRate: MetricComparison;
}

interface ExecutiveKpiProps {
  label: string;
  value: string;
  sub?: string;
  comparison?: MetricComparison;
  badge?: { text: string; tone: 'emerald' | 'violet' | 'amber' | 'teal' | 'rose' };
  icon: React.ReactNode;
  iconBgClass: string;
  borderClass: string;
  glowClass?: string;
  onClick?: () => void;
}

function ExecutiveKpi({
  label,
  value,
  sub,
  comparison,
  badge,
  icon,
  iconBgClass,
  borderClass,
  glowClass = '',
  onClick,
}: ExecutiveKpiProps) {
  const toneMap = {
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    violet: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    teal: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
    rose: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  };

  return (
    <Card
      onClick={onClick}
      className={`stat-card-luxury p-5 transition-all duration-300 hover:-translate-y-1 ${borderClass} ${
        onClick ? 'cursor-pointer hover:shadow-lg active:scale-[0.98] group' : ''
      } ${glowClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[12px] font-extrabold uppercase tracking-wider text-muted truncate">
              {label}
            </p>
            {onClick && (
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-muted group-hover:text-ink text-[12px] font-black">
                ↗
              </span>
            )}
          </div>
          <p className="mt-2 font-mono text-[24px] sm:text-[28px] font-black tracking-tight text-ink leading-tight truncate">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${iconBgClass} shadow-md group-hover:scale-105 transition-transform`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2.5 text-[12px]">
        {comparison ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-black tracking-tight ${
                comparison.isNeutral
                  ? 'bg-soft text-muted'
                  : comparison.isPositive
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
              }`}
            >
              {comparison.text}
            </span>
            {sub && <span className="font-medium text-muted truncate text-[11px]">{sub}</span>}
          </div>
        ) : sub ? (
          <span className="font-medium text-muted truncate">{sub}</span>
        ) : (
          <div />
        )}

        {badge && (
          <span
            className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold ${
              toneMap[badge.tone]
            }`}
          >
            {badge.text}
          </span>
        )}
      </div>
    </Card>
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
  comparisons,
  onNavigate,
}: {
  agg: DashAgg;
  orders: Order[];
  items: OrderItem[];
  staff: Profile[];
  itemOrderDate: Map<string, string>;
  slug: string;
  tables: DiningTable[];
  restaurantName: string;
  comparisons?: KpiComparisons;
  onNavigate?: (tab: any, subTab?: any) => void;
}) {
  const t = useT();
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const cancelledValue = cancelled.reduce((s, o) => s + Number(o.total_amount), 0);
  const voidRate = orders.length > 0 ? (cancelled.length / orders.length) * 100 : 0;
  const aov = agg.orders ? agg.revenue / agg.orders : 0;

  return (
    <div className="space-y-8">
      {/* ── 1. Top Executive Performance KPIs ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-[16px] font-extrabold tracking-tight text-ink">
            Core Performance Metrics
          </h2>
          <span className="text-[12px] font-bold text-muted">
            {fmtNum(agg.orders)} orders fulfilled
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <ExecutiveKpi
            label="Gross Revenue"
            value={fmtPKR(agg.revenue)}
            comparison={comparisons?.revenue}
            badge={{ text: 'Realized', tone: 'emerald' }}
            iconBgClass="bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-emerald-500/25"
            borderClass="border-2 border-emerald-500/40 hover:border-emerald-500 hover:shadow-emerald-500/10"
            onClick={() => onNavigate?.('reports', 'revenue')}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
          />

          <ExecutiveKpi
            label="Total Orders"
            value={fmtNum(agg.orders)}
            comparison={comparisons?.orders}
            badge={{ text: 'Processed', tone: 'violet' }}
            iconBgClass="bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] text-white shadow-violet-500/25"
            borderClass="border-2 border-violet-500/40 hover:border-violet-500 hover:shadow-violet-500/10"
            onClick={() => onNavigate?.('reports', 'orders')}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            }
          />

          <ExecutiveKpi
            label="Avg Order Value"
            value={fmtPKR(aov)}
            comparison={comparisons?.aov}
            badge={{ text: 'Per Ticket', tone: 'amber' }}
            iconBgClass="bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white shadow-amber-500/30"
            borderClass="border-2 border-amber-500/40 hover:border-amber-500 hover:shadow-amber-500/10"
            onClick={() => onNavigate?.('reports', 'revenue')}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />

          <ExecutiveKpi
            label="Dishes Sold"
            value={fmtNum(agg.itemsSold)}
            comparison={comparisons?.itemsSold}
            badge={{ text: 'Kitchen Output', tone: 'teal' }}
            iconBgClass="bg-gradient-to-br from-[#06b6d4] to-[#0284c7] text-white shadow-cyan-500/30"
            borderClass="border-2 border-cyan-500/40 hover:border-cyan-500 hover:shadow-cyan-500/10"
            onClick={() => onNavigate?.('reports', 'dishes')}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
            }
          />
        </div>
      </div>

      {/* ── 2. Loss Prevention & Risk Audit ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
            </span>
            <h2 className="font-display text-[15px] font-extrabold tracking-tight text-ink">
              Loss Prevention & Risk Audit
            </h2>
          </div>
          <span className="text-[12px] font-bold text-muted">
            Target Void Rate &lt; 2.0%
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <ExecutiveKpi
            label="Net Collected"
            value={fmtPKR(agg.revenue)}
            comparison={comparisons?.net}
            badge={{ text: '100% Retained', tone: 'emerald' }}
            iconBgClass="bg-gradient-to-br from-[#059669] to-[#047857] text-white shadow-emerald-500/25"
            borderClass="border-2 border-emerald-600/40 hover:border-emerald-600 hover:shadow-emerald-600/10"
            onClick={() => onNavigate?.('reports', 'revenue')}
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            }
          />

          <ExecutiveKpi
            label="Cancelled Orders"
            value={fmtNum(cancelled.length)}
            comparison={comparisons?.cancelled}
            badge={{ text: cancelled.length === 0 ? 'Optimal' : 'Investigate', tone: cancelled.length === 0 ? 'emerald' : 'rose' }}
            iconBgClass="bg-gradient-to-br from-[#ef4444] to-[#dc2626] text-white shadow-rose-500/25"
            borderClass="border-2 border-rose-500/40 hover:border-rose-500 hover:shadow-rose-500/10"
            onClick={() => onNavigate?.('audit')}
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            }
          />

          <ExecutiveKpi
            label="Lost Sales (Void)"
            value={fmtPKR(cancelledValue)}
            comparison={comparisons?.lost}
            badge={{ text: cancelledValue === 0 ? 'Nil' : 'Unrecovered', tone: cancelledValue === 0 ? 'emerald' : 'amber' }}
            iconBgClass="bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white shadow-orange-500/30"
            borderClass="border-2 border-orange-500/40 hover:border-orange-500 hover:shadow-orange-500/10"
            onClick={() => onNavigate?.('audit')}
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
          />

          <ExecutiveKpi
            label="Void Rate"
            value={`${voidRate.toFixed(1)}%`}
            comparison={comparisons?.voidRate}
            badge={{
              text: voidRate <= 2 ? 'Healthy' : 'Attention',
              tone: voidRate <= 2 ? 'emerald' : 'rose',
            }}
            iconBgClass={
              voidRate <= 2
                ? 'bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-emerald-500/25'
                : 'bg-gradient-to-br from-[#ef4444] to-[#b91c1c] text-white shadow-rose-500/25'
            }
            borderClass={
              voidRate <= 2
                ? 'border-2 border-emerald-500/40 hover:border-emerald-500 hover:shadow-emerald-500/10'
                : 'border-2 border-rose-500/40 hover:border-rose-500 hover:shadow-rose-500/10'
            }
            onClick={() => onNavigate?.('audit')}
            icon={
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            }
          />
        </div>
      </div>

      {/* ── 3. Executive AI Pulse (Smart Highlights) ── */}
      <OwnerSmartSummary
        orders={orders}
        items={items}
        staff={staff}
        itemOrderDate={itemOrderDate}
      />

      {/* ── 4. Visual Trend & Revenue Mix ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RevenueTrend
          points={agg.trend.map((t) => t.value)}
          labels={agg.trend.map((t) => t.label)}
        />
        <CategoryDonut cats={agg.cats} />
      </div>

      {/* ── 5. Floor & QR Code Hub ── */}
      <div className="rounded-[24px] border border-line bg-gradient-to-br from-brand/5 via-transparent to-teal/5 p-1">
        <QrSection slug={slug} tables={tables} restaurantName={restaurantName} />
      </div>
    </div>
  );
}
