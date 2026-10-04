'use client';

// Hand-rolled SVG charts (no chart lib). Theme-aware via CSS variables.

import { useId, useState } from 'react';
import { Card } from './ui';
import { fmtPKR, fmtNum } from '@/lib/format';

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="font-display text-[15px] font-extrabold text-ink">{title}</h3>
      {sub && <p className="mb-3 text-[12.5px] text-muted">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </Card>
  );
}

/* ── Revenue area trend ─────────────────────────────────────── */
// Proper axes: y gridlines with PKR ticks, smart x labels, hover tooltip.
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

export function RevenueTrend({ points, labels }: { points: number[]; labels: string[] }) {
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 210;
  const PL = 48;
  const PR = 12;
  const PT = 12;
  const PB = 28;
  const iw = W - PL - PR;
  const ih = H - PT - PB;
  const max = niceCeil(Math.max(1, ...points));
  const step = points.length > 1 ? iw / (points.length - 1) : 0;
  const xy = points.map((v, i) => [PL + i * step, PT + ih - (v / max) * ih] as const);
  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${(W - PR).toFixed(1)},${PT + ih} L${PL},${PT + ih} Z`;

  // y ticks: 0, 25%, 50%, 75%, 100%
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: max * f, y: PT + ih - f * ih }));
  // x ticks: ~6 evenly spaced
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

  return (
    <ChartCard title="Revenue trend" sub="Har point pe hover karo — exact value dekho">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-48 w-full cursor-crosshair"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-brand)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--c-brand)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {/* y gridlines + labels */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PL} x2={W - PR} y1={t.y} y2={t.y} stroke="var(--c-line)" strokeWidth="1" strokeDasharray={i === 0 ? '' : '4 4'} opacity="0.7" />
              <text x={PL - 8} y={t.y + 4} textAnchor="end" fontSize="10.5" fontWeight="700" fill="var(--c-muted)" fontFamily="monospace">
                {compactPKR(t.v)}
              </text>
            </g>
          ))}
          {/* x labels */}
          {xTicks.map((t, i) => (
            <text key={i} x={t.x} y={H - 8} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--c-muted)">
              {t.label}
            </text>
          ))}
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke="var(--c-brand)" strokeWidth="2.5" strokeLinecap="round" />
          {hover !== null && xy[hover] && (
            <g>
              <line x1={xy[hover][0]} x2={xy[hover][0]} y1={PT} y2={PT + ih} stroke="var(--c-brand)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={xy[hover][0]} cy={xy[hover][1]} r="5" fill="var(--c-brand)" stroke="var(--c-surface-solid)" strokeWidth="2.5" />
            </g>
          )}
        </svg>
        {hover !== null && xy[hover] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-[10px] bg-ink px-3 py-1.5 text-center shadow-xl"
            style={{ left: `${(xy[hover][0] / W) * 100}%`, top: 0 }}
          >
            <p className="whitespace-nowrap text-[11px] font-bold text-white/70">{labels[hover]}</p>
            <p className="whitespace-nowrap font-mono text-[13px] font-extrabold text-white">{fmtPKR(points[hover])}</p>
          </div>
        )}
      </div>
    </ChartCard>
  );
}

/* ── Hourly rush heatmap (24 cells) ─────────────────────────── */
export function HourlyHeatmap({ hours }: { hours: number[] }) {
  const max = Math.max(1, ...hours);
  return (
    <ChartCard title="Rush hours" sub="Orders per hour — darker = busier">
      <div className="grid grid-cols-12 gap-1">
        {hours.map((v, h) => {
          const t = v / max;
          return (
            <div key={h} className="flex flex-col items-center gap-1" title={`${h}:00 — ${v} orders`}>
              <div
                className="h-9 w-full rounded-[7px]"
                style={{
                  backgroundColor: `color-mix(in srgb, var(--c-brand) ${Math.round(8 + t * 82)}%, transparent)`,
                }}
              />
              <span className="text-[9.5px] font-bold text-muted">{h}</span>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

/* ── Weekday bars (busiest day highlighted) ─────────────────── */
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function WeekdayBars({ days }: { days: number[] }) {
  const max = Math.max(1, ...days);
  const best = days.indexOf(Math.max(...days));
  return (
    <ChartCard title="Busiest days" sub={`${WD[best]} brings the most orders`}>
      <div className="flex h-36 items-end gap-2">
        {days.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="font-mono text-[10.5px] font-bold text-muted">{fmtNum(v)}</span>
            <div
              className="w-full rounded-t-[8px]"
              style={{
                height: `${Math.max(6, (v / max) * 104)}px`,
                background:
                  i === best
                    ? 'linear-gradient(180deg, var(--c-brand), var(--c-brand-deep))'
                    : 'var(--c-brand-soft)',
              }}
            />
            <span className={`text-[10.5px] font-bold ${i === best ? 'text-brand' : 'text-muted'}`}>{WD[i]}</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

/* ── Top items horizontal bars ──────────────────────────────── */
export function TopItems({ items }: { items: { name: string; qty: number; revenue: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.qty));
  return (
    <ChartCard title="Top items" sub="By quantity sold">
      <div className="space-y-2.5">
        {items.slice(0, 8).map((it) => (
          <div key={it.name}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] font-bold text-ink">{it.name}</span>
              <span className="shrink-0 font-mono text-[12px] font-bold text-muted">
                {fmtNum(it.qty)} × · {fmtPKR(it.revenue)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-soft">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(it.qty / max) * 100}%`,
                  background: 'linear-gradient(90deg, var(--c-brand), var(--c-teal))',
                }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted">No sales in this period.</p>}
      </div>
    </ChartCard>
  );
}

/* ── Category donut ─────────────────────────────────────────── */
const DONUT_COLORS = ['var(--c-brand)', 'var(--c-teal)', 'var(--c-amber)', 'var(--c-ok)', 'var(--c-danger)', '#6366f1', '#ec4899', '#14b8a6'];

export function CategoryDonut({ cats }: { cats: { name: string; revenue: number }[] }) {
  const total = cats.reduce((s, c) => s + c.revenue, 0) || 1;
  let acc = 0;
  const R = 54;
  const C = 2 * Math.PI * R;
  return (
    <ChartCard title="Category mix" sub="Revenue share">
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0">
          {cats.map((c, i) => {
            const frac = c.revenue / total;
            const dash = frac * C;
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
                strokeWidth="18"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={off}
                strokeLinecap="butt"
                transform="rotate(-90 70 70)"
              />
            );
          })}
          <text x="70" y="66" textAnchor="middle" fill="var(--c-ink)" fontSize="15" fontWeight="800" fontFamily="var(--font-mono)">
            {fmtPKR(total)}
          </text>
          <text x="70" y="84" textAnchor="middle" fill="var(--c-muted)" fontSize="10">
            total
          </text>
        </svg>
        <div className="min-w-0 flex-1 space-y-1.5">
          {cats.slice(0, 6).map((c, i) => (
            <div key={c.name} className="flex items-center gap-2 text-[12.5px]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="truncate font-bold text-body">{c.name}</span>
              <span className="ml-auto font-mono font-bold text-muted">{Math.round((c.revenue / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
