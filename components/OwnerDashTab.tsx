'use client';

// Owner "Dashboard" tab: today hero cards (clickable), branch performance,
// stock alerts, recent activity, smart summary, charts, QR setup.

import type { Order, OrderItem, Profile, DiningTable } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { CategoryDonut, RevenueTrend } from './charts';
import QrSection from './QrSection';
import OwnerSmartSummary from './OwnerSmartSummary';
import { useT } from '@/lib/i18n';
import type { OwnerTabKey } from './OwnerShell';
import type { BranchStat, HeroStats, HistEvent, StockItem } from './OwnerWidgets';
import { timeAgo } from './OwnerWidgets';

export interface DashAgg {
  revenue: number;
  orders: number;
  itemsSold: number;
  trend: { label: string; value: number }[];
  cats: { name: string; revenue: number }[];
}

function SectionTitle({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#7c3aed]/15 to-[#0d9488]/15 text-[17px]">
        {icon}
      </span>
      <div>
        <h2 className="font-display text-[16px] font-extrabold leading-tight text-ink">{title}</h2>
        {sub && <p className="text-[12px] text-muted">{sub}</p>}
      </div>
    </div>
  );
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null || !isFinite(pct))
    return <span className="text-[11.5px] font-semibold text-muted">— vs yesterday</span>;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
        up ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function HeroCard({
  label,
  value,
  icon,
  tint,
  delta,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  icon: string;
  tint: string;
  delta?: React.ReactNode;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-[20px] border border-line bg-[var(--c-surface-solid)] p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-12px_rgba(109,40,217,0.25)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted">{label}</p>
          <p className="mt-2 truncate font-mono text-[24px] font-extrabold leading-none text-ink sm:text-[28px]">
            {value}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {delta}
            {sub && <span className="text-[11.5px] font-semibold text-muted">{sub}</span>}
          </div>
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[20px] transition-transform group-hover:scale-110 ${tint}`}
        >
          {icon}
        </span>
      </div>
    </button>
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
  hero,
  branches,
  stockLow,
  history,
  onNavigate,
  onOpenHistory,
}: {
  agg: DashAgg;
  orders: Order[];
  items: OrderItem[];
  staff: Profile[];
  itemOrderDate: Map<string, string>;
  slug: string;
  tables: DiningTable[];
  restaurantName: string;
  hero: HeroStats;
  branches: BranchStat[];
  stockLow: StockItem[];
  history: HistEvent[];
  onNavigate: (t: OwnerTabKey) => void;
  onOpenHistory: () => void;
}) {
  const t = useT();
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const cancelledValue = cancelled.reduce((s, o) => s + Number(o.total_amount), 0);
  const voidRate = orders.length > 0 ? (cancelled.length / orders.length) * 100 : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero cards — tap to jump to the right section */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <HeroCard
          label="Today's sale"
          value={fmtPKR(hero.todayRev)}
          icon="💰"
          tint="bg-emerald-500/15"
          delta={<Delta pct={hero.revPct} />}
          sub={`${hero.todayOrders} orders`}
          onClick={() => onNavigate('sales')}
        />
        <HeroCard
          label="Active orders"
          value={fmtNum(hero.activeCount)}
          icon="🧾"
          tint="bg-violet-500/15"
          sub="Tap to view all →"
          onClick={() => onNavigate('operations')}
        />
        <HeroCard
          label="Customers today"
          value={fmtNum(hero.todayCust)}
          icon="👥"
          tint="bg-teal-500/15"
          delta={<Delta pct={hero.custPct} />}
          onClick={() => onNavigate('customers')}
        />
      </div>

      {/* Branch performance — only when more than one branch is visible */}
      {branches.length > 1 && (
        <section>
          <SectionTitle icon="🏪" title="Branch performance" sub="Today's revenue by branch" />
          <div className="space-y-4 rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-4 sm:p-5">
            {branches.map((b, i) => (
              <div key={b.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[13.5px] font-bold text-ink">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-soft text-[11px] font-extrabold text-muted">
                      {i + 1}
                    </span>
                    {b.name}
                  </p>
                  <p className="shrink-0 font-mono text-[15px] font-extrabold text-ink">{fmtPKR(b.revenue)}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#7c3aed] to-[#0d9488]"
                    style={{ width: `${Math.max(3, Math.min(100, b.share))}%` }}
                  />
                </div>
                <p className="mt-1 text-[11.5px] font-semibold text-muted">{b.share.toFixed(1)}% of total</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stock alerts */}
      <section>
        <SectionTitle
          icon="📦"
          title="Stock alerts"
          sub={stockLow.length > 0 ? `${stockLow.length} item${stockLow.length > 1 ? 's' : ''} low` : undefined}
        />
        {stockLow.length === 0 ? (
          <div className="flex items-center gap-3 rounded-[16px] border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3.5">
            <span className="text-[20px]">✅</span>
            <p className="text-[13.5px] font-bold text-emerald-700 dark:text-emerald-300">
              All stocked — nothing below par level.
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {stockLow.slice(0, 6).map((s) => (
              <div key={s.id} className="rounded-[16px] border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13.5px] font-bold text-ink">{s.name}</p>
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-extrabold text-amber-600">
                    LOW
                  </span>
                </div>
                <p className="mt-1 font-mono text-[13px] font-bold text-muted">
                  {s.stock} <span className="font-sans font-semibold">/ {s.par} {s.unit}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section>
        <div className="flex items-start justify-between gap-3">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#7c3aed]/15 to-[#0d9488]/15 text-[17px]">
              🕘
            </span>
            <div>
              <h2 className="font-display text-[16px] font-extrabold leading-tight text-ink">History</h2>
              <p className="text-[12px] text-muted">Recorded actions</p>
            </div>
          </div>
          <button
            onClick={onOpenHistory}
            className="shrink-0 rounded-[10px] px-3 py-1.5 text-[12.5px] font-extrabold text-brand hover:bg-brand/10"
          >
            View all →
          </button>
        </div>
        <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] px-4 py-1">
          {history.length === 0 && (
            <p className="py-6 text-center text-[13px] font-semibold text-muted">No actions recorded yet.</p>
          )}
          {history.slice(0, 6).map((e) => (
            <div key={e.id} className="flex items-center gap-3 border-b border-line/60 py-2.5 last:border-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-soft text-[15px]">
                {e.icon}
              </span>
              <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{e.text}</p>
              <span className="shrink-0 text-[11.5px] font-semibold text-muted">{timeAgo(e.at)}</span>
            </div>
          ))}
        </div>
      </section>

      <OwnerSmartSummary orders={orders} items={items} staff={staff} itemOrderDate={itemOrderDate} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MiniKpi label="Cancelled" value={fmtNum(cancelled.length)} bar="!border-t-rose-500" />
        <MiniKpi label={t('own_kpi_lost')} value={fmtPKR(cancelledValue)} bar="!border-t-orange-500" />
        <MiniKpi label="Void rate" value={`${voidRate.toFixed(1)}%`} bar="!border-t-amber-500" />
        <MiniKpi label="Net revenue" value={fmtPKR(agg.revenue)} bar="!border-t-emerald-500" />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <RevenueTrend points={agg.trend.map((x) => x.value)} labels={agg.trend.map((x) => x.label)} />
        </div>
        <div className="xl:col-span-2">
          <CategoryDonut cats={agg.cats} />
        </div>
      </div>

      <QrSection slug={slug} tables={tables} restaurantName={restaurantName} />
    </div>
  );
}
