'use client';

// Owner "Customers" tab: review analytics — avg trend, distribution, recent.

import { useMemo } from 'react';
import type { Review } from '@/lib/types';
import { Card, Empty, SectionHead } from './ui';

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span style={{ fontSize: size }} aria-label={`${n} stars`}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  );
}

export default function OwnerCustomersTab({ reviews }: { reviews: Review[] }) {
  const data = useMemo(() => {
    if (reviews.length === 0) return null;
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    const dist = [0, 0, 0, 0, 0];
    for (const r of reviews) dist[5 - r.rating] += 1;
    // avg per day (last 14 days)
    const byDay = new Map<string, { sum: number; n: number }>();
    for (const r of reviews) {
      const d = new Date(r.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
      const e = byDay.get(d) ?? { sum: 0, n: 0 };
      e.sum += r.rating;
      e.n += 1;
      byDay.set(d, e);
    }
    const trend = [...byDay.entries()].slice(-14).map(([d, e]) => ({ d, avg: e.sum / e.n }));
    const low = reviews.filter((r) => r.rating <= 2).length;
    return { avg, dist, trend, low, total: reviews.length };
  }, [reviews]);

  return (
    <div className="space-y-8">
      <SectionHead title="Customer reviews" sub={`${reviews.length} reviews total`} />
      {!data ? (
        <Empty title="No reviews yet" sub="QR feedback se reviews aayenge." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Avg rating</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-ink">
                {data.avg.toFixed(1)} <Stars n={Math.round(data.avg)} />
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Low ratings (≤2★)</p>
              <p className={`mt-1 font-display text-3xl font-extrabold ${data.low > 0 ? 'text-danger' : 'text-ok'}`}>{data.low}</p>
              <p className="mt-1 text-[12px] text-muted">{data.low > 0 ? 'Foran follow-up karo' : 'Sab khush 🎉'}</p>
            </Card>
            <Card className="p-5">
              <p className="text-[12.5px] font-bold uppercase tracking-wide text-muted">Response needed</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-ink">{data.low}</p>
              <p className="mt-1 text-[12px] text-muted">low reviews ka jawab do</p>
            </Card>
          </div>

          <Card className="p-5">
            <p className="font-display text-[15px] font-extrabold text-ink">Rating distribution</p>
            <div className="mt-3 space-y-2">
              {data.dist.map((n, i) => {
                const stars = 5 - i;
                const pct = data.total > 0 ? (n / data.total) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-3">
                    <span className="w-14 shrink-0 text-[13px] font-bold text-body">
                      <Stars n={stars} size={12} />
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-soft">
                      <div
                        className={`h-full rounded-full ${stars >= 4 ? 'bg-ok' : stars === 3 ? 'bg-amber' : 'bg-danger'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right font-mono text-[12.5px] font-bold text-muted">{n}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <div>
            <SectionHead title="Recent reviews" sub="Latest feedback" />
            <div className="space-y-2.5">
              {reviews.slice(0, 10).map((r) => (
                <Card key={r.id} className={`border-l-4 p-4 ${r.rating <= 2 ? 'border-l-danger' : 'border-l-transparent'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13.5px] font-extrabold text-ink">{r.customer_name ?? 'Guest'}</p>
                    <span className={r.rating <= 2 ? 'text-danger' : 'text-amber'}>
                      <Stars n={r.rating} />
                    </span>
                  </div>
                  {r.comment && <p className="mt-1 text-[13px] text-body">{r.comment}</p>}
                  <p className="mt-1 text-[11.5px] text-muted">{new Date(r.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
