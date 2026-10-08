'use client';

// Owner "Customers" tab: Customer Satisfaction (CSAT), star distribution,
// dissatisfaction follow-up alerts, and feedback log.

import { useMemo } from 'react';
import type { Review } from '@/lib/types';
import { Card, Empty } from './ui';
import { useT, type TKey } from '@/lib/i18n';

function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span
      className="inline-flex tracking-wider text-amber-400"
      style={{ fontSize: size }}
      aria-label={`${n} stars`}
    >
      {'★'.repeat(Math.max(0, Math.min(5, n)))}
      <span className="opacity-25">{'★'.repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

export default function OwnerCustomersTab({ reviews }: { reviews: Review[] }) {
  const t = useT();

  const data = useMemo(() => {
    if (reviews.length === 0) return null;
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    const dist = [0, 0, 0, 0, 0];
    for (const r of reviews) {
      const idx = Math.max(0, Math.min(4, 5 - r.rating));
      dist[idx] += 1;
    }

    const low = reviews.filter((r) => r.rating <= 2).length;
    const positive = reviews.filter((r) => r.rating >= 4).length;
    const csatPct = Math.round((positive / reviews.length) * 100);

    return { avg, dist, low, total: reviews.length, csatPct };
  }, [reviews]);

  return (
    <div className="space-y-8">
      {/* ── Section Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
        <div>
          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
            Customer Experience & Reviews
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Direct guest feedback captured through digital QR table ordering
          </p>
        </div>
        <span className="rounded-full bg-brand/10 px-3 py-1 text-[12px] font-bold text-brand">
          {reviews.length} total reviews
        </span>
      </div>

      {!data ? (
        <Empty title={t('own_cst_no_rev' as TKey)} sub={t('own_cst_no_rev_sub' as TKey)} />
      ) : (
        <>
          {/* ── Top Executive CSAT Cards ── */}
          <div className="grid gap-3.5 sm:grid-cols-3">
            {/* Average Rating Card */}
            <Card className="stat-card-luxury p-5 flex flex-col justify-between">
              <div>
                <span className="text-[12px] font-extrabold uppercase tracking-wider text-muted">
                  Overall Rating
                </span>
                <div className="mt-3 flex items-baseline gap-2.5">
                  <p className="font-mono text-[36px] font-black text-ink leading-none">
                    {data.avg.toFixed(1)}
                  </p>
                  <span className="text-[14px] font-bold text-muted">/ 5.0</span>
                </div>
                <div className="mt-2">
                  <Stars n={Math.round(data.avg)} size={18} />
                </div>
              </div>
              <p className="mt-4 border-t border-line/70 pt-2.5 text-[12px] font-medium text-muted">
                Based on {data.total} authenticated dining ratings
              </p>
            </Card>

            {/* Satisfaction Score (CSAT) */}
            <Card className="stat-card-luxury p-5 flex flex-col justify-between">
              <div>
                <span className="text-[12px] font-extrabold uppercase tracking-wider text-muted">
                  Customer Satisfaction (CSAT)
                </span>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="font-mono text-[36px] font-black text-emerald-600 leading-none">
                    {data.csatPct}%
                  </p>
                  <span className="text-[14px] font-bold text-muted">positive</span>
                </div>
              </div>
              <p className="mt-4 border-t border-line/70 pt-2.5 text-[12px] font-medium text-muted">
                Guests rating 4 or 5 stars on service & taste
              </p>
            </Card>

            {/* Low Ratings / Dissatisfaction Alert */}
            <Card className="stat-card-luxury p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-extrabold uppercase tracking-wider text-muted">
                    Low Ratings (&le; 2★)
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold ${
                      data.low > 0
                        ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    }`}
                  >
                    {data.low > 0 ? 'Requires Review' : 'Optimal'}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <p
                    className={`font-mono text-[36px] font-black leading-none ${
                      data.low > 0 ? 'text-danger' : 'text-ok'
                    }`}
                  >
                    {data.low}
                  </p>
                  <span className="text-[14px] font-bold text-muted">dissatisfied</span>
                </div>
              </div>
              <p className="mt-4 border-t border-line/70 pt-2.5 text-[12px] font-medium text-muted">
                {data.low > 0 ? t('own_cst_followup' as TKey) : t('own_cst_allhappy' as TKey)}
              </p>
            </Card>
          </div>

          {/* ── Rating Distribution ── */}
          <Card className="p-5 sm:p-6 transition-all hover:border-brand/30">
            <h3 className="font-display text-[16px] font-extrabold text-ink">
              Rating Distribution
            </h3>
            <p className="mt-0.5 text-[12.5px] font-medium text-muted">
              Count and percentage of ratings received across all tiers
            </p>

            <div className="mt-4 space-y-2.5">
              {data.dist.map((count, i) => {
                const stars = 5 - i;
                const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
                return (
                  <div key={stars} className="flex items-center gap-3">
                    <span className="flex w-16 shrink-0 items-center gap-1 font-mono text-[13px] font-extrabold text-ink">
                      <span>{stars}</span>
                      <span className="text-amber-400">★</span>
                    </span>

                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-soft">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          stars >= 4
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : stars === 3
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="w-16 shrink-0 text-right font-mono text-[12px]">
                      <span className="font-black text-ink">{count}</span>
                      <span className="text-muted ml-1">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* ── Recent Guest Feedback Feed ── */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-[16px] font-extrabold text-ink">
                  Recent Guest Feedback
                </h3>
                <p className="mt-0.5 text-[12.5px] font-medium text-muted">
                  Latest customer comments and ratings
                </p>
              </div>
              <span className="text-[12px] font-bold text-muted">
                Showing latest {Math.min(10, reviews.length)} reviews
              </span>
            </div>

            <div className="space-y-3">
              {reviews.slice(0, 10).map((r) => {
                const isNegative = r.rating <= 2;
                const dateStr = new Date(r.created_at).toLocaleDateString('en-PK', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <Card
                    key={r.id}
                    className={`group p-4.5 transition-all duration-200 hover:-translate-y-0.5 ${
                      isNegative ? 'border-l-4 border-l-rose-500 bg-rose-500/5' : 'hover:border-brand/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-soft font-display text-[13px] font-extrabold text-ink shadow-sm">
                          {(r.customer_name ?? 'G').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-display text-[14px] font-extrabold text-ink">
                            {r.customer_name ?? 'Anonymous Guest'}
                          </p>
                          <p className="text-[11.5px] font-medium text-muted">{dateStr}</p>
                        </div>
                      </div>

                      <div className="text-right">
                        <Stars n={r.rating} size={15} />
                      </div>
                    </div>

                    {r.comment && (
                      <p className="mt-3 text-[13px] leading-relaxed text-body pl-12 italic opacity-95">
                        &ldquo;{r.comment}&rdquo;
                      </p>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
