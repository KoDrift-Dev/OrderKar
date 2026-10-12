import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, PageHeader } from '@/components/ui';
import { fmtPKR } from '@/lib/format';

export default async function AdminDashboard() {
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);

  const [{ count: restaurantCount }, { data: todayOrders }, { data: restaurants }] = await Promise.all([
    supabase.from('restaurants').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('id, total, restaurant_id, status').gte('created_at', `${today}T00:00:00`),
    supabase.from('restaurants').select('id, name, slug, subscription_tier, created_at').order('created_at', { ascending: false }).limit(5),
  ]);

  const todayRevenue = (todayOrders ?? []).reduce((s, o) => s + Number(o?.total ?? 0), 0);
  const todayOrderCount = (todayOrders ?? []).length;
  const activeOrders = (todayOrders ?? []).filter((o) =>
    ['pending', 'preparing', 'ready'].includes(o?.status ?? '')
  ).length;

  // Per-restaurant revenue today
  const revByRestaurant = new Map<string, number>();
  for (const o of todayOrders ?? []) {
    const rid = o?.restaurant_id as string;
    revByRestaurant.set(rid, (revByRestaurant.get(rid) ?? 0) + Number(o?.total ?? 0));
  }

  const stats = [
    { label: 'Total Restaurants', value: String(restaurantCount ?? 0), icon: '🏪', href: '/admin/restaurants' },
    { label: "Today's Orders", value: String(todayOrderCount), icon: '🧾', href: '/admin/analytics' },
    { label: "Today's Revenue", value: fmtPKR(todayRevenue), icon: '💰', href: '/admin/analytics' },
    { label: 'Active Orders Now', value: String(activeOrders), icon: '🔥', href: '/admin/analytics' },
  ];

  return (
    <div>
      <PageHeader
        title="Platform Dashboard"
        sub="Overview of all restaurant tenants on OrderKar"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="stat-card-luxury p-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40">
              <div className="flex items-center justify-between">
                <span className="text-[28px]">{s.icon}</span>
              </div>
              <p className="mt-3 font-display text-[26px] font-black tracking-tight text-ink">{s.value}</p>
              <p className="mt-0.5 text-[13px] font-bold text-muted">{s.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-[16px] font-extrabold text-ink">Recent Restaurants</h3>
            <Link href="/admin/restaurants" className="text-[13px] font-bold text-brand hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-2.5">
            {(restaurants ?? []).map((r) => (
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
            {(!restaurants || restaurants.length === 0) && (
              <p className="py-6 text-center text-[13px] text-muted">No restaurants yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 font-display text-[16px] font-extrabold text-ink">Quick Actions</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/admin/restaurants"
              className="rounded-[12px] border border-line/12 p-4 transition-all hover:border-brand/40"
            >
              <p className="text-[22px]">🏪</p>
              <p className="mt-2 text-[14px] font-extrabold text-ink">Manage Restaurants</p>
              <p className="mt-0.5 text-[12.5px] text-muted">View, edit & access tenants</p>
            </Link>
            <Link
              href="/admin/analytics"
              className="rounded-[12px] border border-line/12 p-4 transition-all hover:border-brand/40"
            >
              <p className="text-[22px]">📈</p>
              <p className="mt-2 text-[14px] font-extrabold text-ink">Platform Analytics</p>
              <p className="mt-0.5 text-[12.5px] text-muted">Revenue & order trends</p>
            </Link>
            <Link
              href="/admin/settings"
              className="rounded-[12px] border border-line/12 p-4 transition-all hover:border-brand/40"
            >
              <p className="text-[22px]">⚙️</p>
              <p className="mt-2 text-[14px] font-extrabold text-ink">Platform Settings</p>
              <p className="mt-0.5 text-[12.5px] text-muted">Pricing tiers & defaults</p>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
