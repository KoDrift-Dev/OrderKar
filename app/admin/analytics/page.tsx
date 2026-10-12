import { createClient } from '@/lib/supabase/server';
import { Card, PageHeader } from '@/components/ui';
import { fmtPKR } from '@/lib/format';

export default async function AdminAnalytics() {
  const supabase = createClient();
  const now = Date.now();
  const day = 86400000;

  const ranges = [
    { label: 'Today', since: new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00').toISOString() },
    { label: 'Last 7 days', since: new Date(now - 7 * day).toISOString() },
    { label: 'Last 30 days', since: new Date(now - 30 * day).toISOString() },
  ];

  const { data: restaurants } = await supabase.from('restaurants').select('id, name, slug');

  const rangeStats = await Promise.all(
    ranges.map(async (r) => {
      const { data: orders } = await supabase
        .from('orders')
        .select('total, restaurant_id')
        .gte('created_at', r.since);
      const revenue = (orders ?? []).reduce((s, o) => s + Number(o?.total ?? 0), 0);
      return { label: r.label, orders: (orders ?? []).length, revenue };
    })
  );

  // Per-restaurant 30d breakdown
  const { data: monthOrders } = await supabase
    .from('orders')
    .select('total, restaurant_id')
    .gte('created_at', new Date(now - 30 * day).toISOString());

  const perRestaurant = new Map<string, { orders: number; revenue: number }>();
  for (const o of monthOrders ?? []) {
    const rid = o?.restaurant_id as string;
    const cur = perRestaurant.get(rid) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o?.total ?? 0);
    perRestaurant.set(rid, cur);
  }

  const nameOf = (id: string) => (restaurants ?? []).find((r) => r.id === id)?.name ?? id.slice(0, 8);
  const slugOf = (id: string) => (restaurants ?? []).find((r) => r.id === id)?.slug ?? '';

  const sorted = [...perRestaurant.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const maxRev = sorted[0]?.[1].revenue ?? 1;

  return (
    <div>
      <PageHeader title="Platform Analytics" sub="Revenue and order trends across all tenants" />

      <div className="grid gap-4 sm:grid-cols-3">
        {rangeStats.map((s) => (
          <Card key={s.label} className="stat-card-luxury p-5">
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted">{s.label}</p>
            <p className="mt-2 font-display text-[26px] font-black tracking-tight text-ink">{fmtPKR(s.revenue)}</p>
            <p className="mt-1 text-[13px] font-bold text-muted">{s.orders} orders</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <h3 className="mb-4 font-display text-[16px] font-extrabold text-ink">Revenue by Restaurant (30 days)</h3>
        <div className="space-y-3">
          {sorted.map(([rid, s]) => (
            <div key={rid}>
              <div className="flex items-center justify-between text-[13px] font-bold">
                <span className="text-ink">
                  {nameOf(rid)}{' '}
                  <span className="font-mono text-[11px] text-muted">/{slugOf(rid)}</span>
                </span>
                <span className="text-muted">
                  {s.orders} orders · <span className="text-ink">{fmtPKR(s.revenue)}</span>
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line/20">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-brand-deep transition-all"
                  style={{ width: `${Math.max(4, (s.revenue / maxRev) * 100)}%` }}
                />
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="py-6 text-center text-[13px] text-muted">No orders in the last 30 days.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
