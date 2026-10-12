import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, PageHeader } from '@/components/ui';
import { fmtPKR } from '@/lib/format';

export default async function AdminDashboard() {
  const supabase = createClient();
  const now = Date.now();
  const day = 86400000;
  const todayStr = new Date().toISOString().slice(0, 10);

  const [{ count: restaurantCount }, { data: todayOrders }, { data: restaurants }, { data: weekOrders }] =
    await Promise.all([
      supabase.from('restaurants').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id, total, restaurant_id, status').gte('created_at', `${todayStr}T00:00:00`),
      supabase.from('restaurants').select('id, name, slug, subscription_tier').order('created_at', { ascending: false }),
      supabase.from('orders').select('total, created_at').gte('created_at', new Date(now - 7 * day).toISOString()),
    ]);

  const todayRevenue = (todayOrders ?? []).reduce((s, o) => s + Number(o?.total ?? 0), 0);
  const activeOrders = (todayOrders ?? []).filter((o) =>
    ['pending', 'preparing', 'ready'].includes(o?.status ?? '')
  ).length;

  // 7-day revenue bars
  const bars: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * day);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-PK', { weekday: 'short' });
    const value = (weekOrders ?? [])
      .filter((o) => (o?.created_at as string)?.slice(0, 10) === key)
      .reduce((s, o) => s + Number(o?.total ?? 0), 0);
    bars.push({ label, value });
  }
  const maxBar = Math.max(1, ...bars.map((b) => b.value));

  // Per-restaurant revenue today
  const revByRestaurant = new Map<string, number>();
  for (const o of todayOrders ?? []) {
    const rid = o?.restaurant_id as string;
    revByRestaurant.set(rid, (revByRestaurant.get(rid) ?? 0) + Number(o?.total ?? 0));
  }

  const stats = [
    { label: 'Total Restaurants', value: String(restaurantCount ?? 0), icon: '🏪', href: '/admin/restaurants' },
    { label: "Today's Orders", value: String((todayOrders ?? []).length), icon: '🧾', href: '/admin/analytics' },
    { label: "Today's Revenue", value: fmtPKR(todayRevenue), icon: '💰', href: '/admin/analytics' },
    { label: 'Active Orders Now', value: String(activeOrders), icon: '🔥', href: '/admin/analytics' },
  ];

  return (
    <div>
      <PageHeader title="Platform Dashboard" sub="Overview of all restaurant tenants on OrderKar" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="stat-card-luxury p-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40">
              <span className="text-[28px]">{s.icon}</span>
              <p className="mt-3 font-display text-[26px] font-black tracking-tight text-ink">{s.value}</p>
              <p className="mt-0.5 text-[13px] font-bold text-muted">{s.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* 7-day revenue chart */}
      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-[16px] font-extrabold text-ink">Platform Revenue — Last 7 Days</h3>
          <Link href="/admin/analytics" className="text-[13px] font-bold text-brand hover:underline">
            Full analytics →
          </Link>
        </div>
        <div className="flex h-44 items-end gap-2 sm:gap-3">
          {bars.map((b) => (
            <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <p className="text-[11px] font-extrabold text-muted">{b.value > 0 ? fmtPKR(b.value) : ''}</p>
              <div className="flex h-28 w-full items-end justify-center">
                <div
                  className="w-full max-w-[44px] rounded-t-[8px] bg-gradient-to-t from-brand-deep to-brand transition-all"
                  style={{ height: `${Math.max(4, (b.value / maxBar) * 100)}%` }}
                  title={`${b.label}: ${fmtPKR(b.value)}`}
                />
              </div>
              <p className="text-[11.5px] font-bold text-muted">{b.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-[16px] font-extrabold text-ink">Restaurants</h3>
            <Link href="/admin/restaurants" className="text-[13px] font-bold text-brand hover:underline">
              Manage all →
            </Link>
          </div>
          <div className="space-y-2.5">
            {(restaurants ?? []).slice(0, 5).map((r) => (
              <Link
                key={r.id}
                href={`/admin/restaurants/${r.id}`}
                className="flex items-center justify-between rounded-[12px] border border-line/12 px-4 py-3 transition-all hover:border-brand/40"
              >
                <div>
                  <p className="text-[14px] font-extrabold text-ink">{r.name}</p>
                  <p className="font-mono text-[12px] text-muted">/{r.slug}</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-brand">
                    {r.subscription_tier}
                  </span>
                  <p className="mt-1 text-[12px] font-bold text-muted">{fmtPKR(revByRestaurant.get(r.id) ?? 0)} today</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-display text-[16px] font-extrabold text-ink">Quick Actions</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { href: '/admin/restaurants', icon: '🏪', title: 'Manage Restaurants', sub: 'View, edit & access tenants' },
              { href: '/admin/restaurants', icon: '➕', title: 'Add Restaurant', sub: 'Create a new tenant' },
              { href: '/admin/analytics', icon: '📈', title: 'Platform Analytics', sub: 'Revenue & order trends' },
              { href: '/admin/settings', icon: '⚙️', title: 'Platform Settings', sub: 'Pricing tiers & defaults' },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-[12px] border border-line/12 p-4 transition-all hover:border-brand/40"
              >
                <p className="text-[22px]">{a.icon}</p>
                <p className="mt-2 text-[14px] font-extrabold text-ink">{a.title}</p>
                <p className="mt-0.5 text-[12.5px] text-muted">{a.sub}</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
