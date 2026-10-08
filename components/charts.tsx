'use client';

// Hand-rolled high-fidelity SVG charts with theme-aware styling, smooth bezier curves,
// interactive hover tooltips, and executive summary stats.

import { useId, useMemo, useState } from 'react';
import { Card } from './ui';
import { fmtPKR, fmtNum } from '@/lib/format';

function ChartCard({
  title,
  sub,
  badge,
  action,
  children,
}: {
  title: string;
  sub?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6 transition-all duration-300 hover:border-brand/30">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-[16px] font-extrabold tracking-tight text-ink">{title}</h3>
            {badge}
          </div>
          {sub && <p className="mt-0.5 text-[12.5px] font-medium text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const n = v / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * base;
}

function compactPKR(v: number): string {
  if (v >= 1000000) return `Rs ${(v / 1000000).toFixed(v >= 10000000 ? 0 : 1)}M`;
  if (v >= 1000) return `Rs ${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `Rs ${Math.round(v)}`;
}

/* ── Smooth Bezier Path Generator ─────────────────────────────── */
function getSmoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length <= 1) return '';
  if (points.length === 2) {
    return `M ${points[0][0]},${points[0][1]} L ${points[1][0]},${points[1][1]}`;
  }

  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/* ── Revenue Area Trend (Smooth Curves + Interactive Insights) ── */
export function RevenueTrend({ points, labels }: { points: number[]; labels: string[] }) {
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);

  const W = 620;
  const H = 230;
  const PL = 58;
  const PR = 16;
  const PT = 20;
  const PB = 34;
  const iw = W - PL - PR;
  const ih = H - PT - PB;

  const totalRev = useMemo(() => points.reduce((s, p) => s + p, 0), [points]);
  const avgRev = useMemo(() => (points.length > 0 ? Math.round(totalRev / points.length) : 0), [totalRev, points]);
  const maxIdx = useMemo(() => {
    let max = -1;
    let idx = 0;
    points.forEach((v, i) => {
      if (v > max) {
        max = v;
        idx = i;
      }
    });
    return idx;
  }, [points]);

  const max = niceCeil(Math.max(1, ...points));
  const step = points.length > 1 ? iw / (points.length - 1) : 0;
  const xy = points.map((v, i) => [PL + i * step, PT + ih - (v / max) * ih] as const);

  const smoothLine = getSmoothPath(xy);
  const area = `${smoothLine} L ${(W - PR).toFixed(1)},${(PT + ih).toFixed(1)} L ${PL.toFixed(1)},${(PT + ih).toFixed(1)} Z`;

  // y ticks: 0, 33%, 66%, 100%
  const yTicks = [0, 0.33, 0.66, 1].map((f) => ({ v: max * f, y: PT + ih - f * ih }));

  // x ticks: max 6 labels
  const xCount = Math.min(6, points.length);
  const xTicks = Array.from({ length: xCount }, (_, k) => {
    const i = xCount === 1 ? 0 : Math.round((k * (points.length - 1)) / (xCount - 1));
    return { i, x: PL + i * step, label: labels[i] ?? '' };
  });

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = W / rect.width;
    const x = (e.clientX - rect.left) * sx - PL;
    const i = Math.round(x / (step || 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  };

  const peakLabel = labels[maxIdx] || '';
  const peakVal = points[maxIdx] || 0;

  return (
    <ChartCard
      title="Revenue Trend"
      sub="Hover across the timeline for daily breakdown"
      badge={
        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-live-pulse" />
          Interactive
        </span>
      }
      action={
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="text-[11.5px] font-black uppercase tracking-wider text-muted">Daily Avg</p>
            <p className="font-mono text-[16px] sm:text-[18px] font-black text-ink">{fmtPKR(avgRev)}</p>
          </div>
          {peakVal > 0 && (
            <div className="hidden sm:block border-l border-line pl-4">
              <p className="text-[11.5px] font-black uppercase tracking-wider text-muted">Peak ({peakLabel})</p>
              <p className="font-mono text-[16px] sm:text-[18px] font-black text-brand">{fmtPKR(peakVal)}</p>
            </div>
          )}
        </div>
      }
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-52 w-full cursor-crosshair overflow-visible"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-brand)" stopOpacity="0.38" />
              <stop offset="60%" stopColor="var(--c-brand)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--c-brand)" stopOpacity="0.0" />
            </linearGradient>
            <filter id={`glow-${gid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="var(--c-brand)" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* y gridlines + labels */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={PL}
                x2={W - PR}
                y1={t.y}
                y2={t.y}
                stroke="var(--c-line)"
                strokeWidth="1"
                strokeDasharray={i === 0 ? '' : '3 4'}
                opacity={i === 0 ? 0.9 : 0.6}
              />
              <text
                x={PL - 10}
                y={t.y + 4}
                textAnchor="end"
                fontSize="12.5"
                fontWeight="800"
                fill="var(--c-muted)"
                fontFamily="var(--font-mono)"
              >
                {compactPKR(t.v)}
              </text>
            </g>
          ))}

          {/* x labels */}
          {xTicks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={H - 8}
              textAnchor="middle"
              fontSize="12"
              fontWeight="800"
              fill="var(--c-muted)"
            >
              {t.label}
            </text>
          ))}

          {/* Area fill */}
          {points.length > 0 && <path d={area} fill={`url(#${gid})`} />}

          {/* Smooth line */}
          {points.length > 0 && (
            <path
              d={smoothLine}
              fill="none"
              stroke="var(--c-brand)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#glow-${gid})`}
            />
          )}

          {/* Hover crosshair & point */}
          {hover !== null && xy[hover] && (
            <g>
              <line
                x1={xy[hover][0]}
                x2={xy[hover][0]}
                y1={PT}
                y2={PT + ih}
                stroke="var(--c-brand)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.8"
              />
              {/* Outer pulsing ring */}
              <circle
                cx={xy[hover][0]}
                cy={xy[hover][1]}
                r="10"
                fill="var(--c-brand)"
                fillOpacity="0.25"
                className="animate-pulse"
              />
              {/* Core point */}
              <circle
                cx={xy[hover][0]}
                cy={xy[hover][1]}
                r="5.5"
                fill="var(--c-brand)"
                stroke="var(--c-surface-solid)"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Popup */}
        {hover !== null && xy[hover] && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-[14px] border border-line bg-[var(--c-surface-solid)] px-3.5 py-2 text-center shadow-xl backdrop-blur-md"
            style={{
              left: `${Math.min(92, Math.max(8, (xy[hover][0] / W) * 100))}%`,
              top: `${Math.max(10, (xy[hover][1] / H) * 100 - 8)}%`,
            }}
          >
            <p className="whitespace-nowrap text-[11.5px] font-black uppercase tracking-wider text-muted">
              {labels[hover]}
            </p>
            <p className="whitespace-nowrap font-mono text-[17px] font-black text-ink">
              {fmtPKR(points[hover])}
            </p>
          </div>
        )}
      </div>
    </ChartCard>
  );
}

/* ── Hourly Rush Heatmap (24-Hour Intensity Console) ─────────── */
export function HourlyHeatmap({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  const peakHour = hours.indexOf(Math.max(...hours));
  const peakOrders = hours[peakHour] || 0;

  const formatHour = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const num = h % 12 === 0 ? 12 : h % 12;
    return `${num} ${ampm}`;
  };

  return (
    <ChartCard
      title="Rush-Hour Traffic"
      sub="Volume of orders across each hour of the day"
      badge={
        peakOrders > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2.5 py-0.5 text-[11px] font-bold text-amber">
            🔥 Peak: {formatHour(peakHour)} ({peakOrders} orders)
          </span>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-12 gap-1.5 sm:gap-2">
          {hours.map((v, h) => {
            const ratio = v / max;
            const isPeak = h === peakHour && v > 0;
            return (
              <div
                key={h}
                className="group relative flex flex-col items-center gap-1.5 cursor-pointer"
                title={`${formatHour(h)}: ${v} orders`}
              >
                <div
                  className={`h-11 w-full rounded-[9px] transition-all duration-200 group-hover:scale-105 group-hover:shadow-md ${
                    isPeak ? 'ring-2 ring-amber shadow-sm' : ''
                  }`}
                  style={{
                    backgroundColor:
                      v === 0
                        ? 'var(--c-soft)'
                        : `color-mix(in srgb, var(--c-brand) ${Math.round(20 + ratio * 80)}%, transparent)`,
                  }}
                />
                <span className="text-[10px] font-bold text-muted group-hover:text-ink">
                  {h % 3 === 0 ? formatHour(h).replace(' ', '') : ''}
                </span>

                {/* Micro Hover Tag */}
                <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-ink px-2 py-1 text-[10.5px] font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {formatHour(h)}: {v} orders
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between border-t border-line pt-2 text-[11.5px] text-muted">
          <span>Less active</span>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-6 rounded-[4px] bg-soft" />
            <span
              className="h-2.5 w-6 rounded-[4px]"
              style={{ backgroundColor: 'color-mix(in srgb, var(--c-brand) 30%, transparent)' }}
            />
            <span
              className="h-2.5 w-6 rounded-[4px]"
              style={{ backgroundColor: 'color-mix(in srgb, var(--c-brand) 70%, transparent)' }}
            />
            <span className="h-2.5 w-6 rounded-[4px] bg-brand" />
          </div>
          <span>Busiest</span>
        </div>
      </div>
    </ChartCard>
  );
}

/* ── Weekday Bars (Pillar Columns + Peak Day Trophy) ─────────── */
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekdayBars({ days }: { days: number[] }) {
  const max = Math.max(1, ...days);
  const best = days.indexOf(Math.max(...days));
  const total = days.reduce((s, d) => s + d, 0);

  return (
    <ChartCard
      title="Busiest Days"
      sub="Weekly order distribution"
      badge={
        total > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal/15 px-2.5 py-0.5 text-[11px] font-bold text-teal">
            ⭐ Top Day: {WD[best]}
          </span>
        ) : undefined
      }
    >
      <div className="flex h-44 items-end gap-2.5 sm:gap-3.5 pt-4">
        {days.map((v, i) => {
          const isBest = i === best && v > 0;
          const heightPx = Math.max(10, (v / max) * 115);
          return (
            <div key={i} className="group flex flex-1 flex-col items-center gap-2">
              <span className={`font-mono text-[11.5px] font-extrabold ${isBest ? 'text-brand' : 'text-muted'}`}>
                {fmtNum(v)}
              </span>
              <div className="relative w-full">
                <div
                  className={`w-full rounded-t-[10px] transition-all duration-300 group-hover:brightness-110 ${
                    isBest
                      ? 'shadow-lift bg-gradient-to-t from-brand-deep to-brand'
                      : 'bg-gradient-to-t from-brand/15 to-brand/35'
                  }`}
                  style={{ height: `${heightPx}px` }}
                />
              </div>
              <span
                className={`text-[12px] font-bold transition-colors ${
                  isBest ? 'text-brand font-extrabold' : 'text-muted group-hover:text-ink'
                }`}
              >
                {WD[i]}
              </span>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

/* ── Top Items Leaderboard (Podium Badges + Revenue Share) ───── */
const RANK_BADGES = [
  { label: '1', tone: 'bg-amber-400 text-amber-950 shadow-amber-400/30 shadow-md ring-1 ring-amber-300' },
  { label: '2', tone: 'bg-slate-300 text-slate-800 shadow-slate-300/30 shadow-md ring-1 ring-slate-200' },
  { label: '3', tone: 'bg-amber-700 text-amber-100 shadow-amber-700/30 shadow-md ring-1 ring-amber-600' },
];

export function TopItems({ items }: { items: { name: string; qty: number; revenue: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.qty));

  return (
    <ChartCard
      title="Top Selling Dishes"
      sub="Most ordered items ranked by quantity"
      badge={
        <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
          {items.length} items
        </span>
      }
    >
      <div className="space-y-3">
        {items.slice(0, 8).map((it, idx) => {
          const rank = idx + 1;
          const badge = RANK_BADGES[idx];
          const pct = Math.round((it.qty / max) * 100);

          return (
            <div
              key={it.name}
              className="group rounded-[14px] border border-transparent p-2 transition-all duration-200 hover:border-line hover:bg-soft/50"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                      badge ? badge.tone : 'bg-soft text-muted font-bold'
                    }`}
                  >
                    {rank}
                  </span>
                  <p className="truncate text-[13.5px] font-extrabold text-ink group-hover:text-brand transition-colors">
                    {it.name}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="font-mono text-[13.5px] font-extrabold text-ink">{fmtPKR(it.revenue)}</span>
                  <span className="ml-2 font-mono text-[12px] font-bold text-muted">({fmtNum(it.qty)} sold)</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-soft">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background:
                      idx === 0
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, var(--c-brand), var(--c-teal))',
                  }}
                />
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <p className="py-8 text-center text-sm font-medium text-muted">No dishes sold in this date range.</p>
        )}
      </div>
    </ChartCard>
  );
}

/* ── Category Revenue Donut ──────────────────────────────────── */
const DONUT_COLORS = [
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#f43f5e', // Rose
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#64748b', // Slate
];

export function CategoryDonut({ cats }: { cats: { name: string; revenue: number }[] }) {
  const total = cats.reduce((s, c) => s + c.revenue, 0) || 1;
  let acc = 0;
  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <ChartCard title="Category Revenue Mix" sub="Share of sales across food categories">
      {cats.length === 0 ? (
        <p className="py-8 text-center text-sm font-medium text-muted">No category data recorded yet.</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
          {/* Donut SVG */}
          <div className="relative shrink-0">
            <svg viewBox="0 0 140 140" className="h-36 w-36">
              {cats.map((c, i) => {
                const frac = c.revenue / total;
                const dash = Math.max(0, frac * C - 1.5);
                const off = -acc * C;
                acc += frac;
                return (
                  <circle
                    key={c.name}
                    cx="70"
                    cy="70"
                    r={R}
                    fill="none"
                    stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
                    strokeWidth="16"
                    strokeDasharray={`${dash} ${C - dash}`}
                    strokeDashoffset={off}
                    strokeLinecap="round"
                    transform="rotate(-90 70 70)"
                    className="transition-all duration-300 hover:opacity-85"
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted">Total Sales</span>
              <span className="font-mono text-[14.5px] font-extrabold text-ink leading-tight">
                {compactPKR(total)}
              </span>
            </div>
          </div>

          {/* Category Chips List */}
          <div className="min-w-0 flex-1 w-full space-y-2">
            {cats.slice(0, 6).map((c, i) => {
              const color = DONUT_COLORS[i % DONUT_COLORS.length];
              const pct = Math.round((c.revenue / total) * 100);
              return (
                <div
                  key={c.name}
                  className="flex items-center justify-between gap-3 text-[13px] rounded-[10px] p-1.5 transition-colors hover:bg-soft/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                    <span className="truncate font-bold text-ink">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[12px] font-extrabold text-ink">{fmtPKR(c.revenue)}</span>
                    <span className="rounded-md bg-soft px-1.5 py-0.5 text-[11px] font-bold text-muted">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
