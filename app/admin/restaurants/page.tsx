import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, PageHeader, Empty } from '@/components/ui';
import { fmtPKR } from '@/lib/format';
import AdminAddRestaurant from '@/components/AdminAddRestaurant';

export default async function AdminRestaurants() {
  const supabase = createClient();
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select('id, name, slug, subscription_tier, theme_config, created_at')
    .order('created_at', { ascending: false });

  const today = new Date().toISOString().slice(0, 10);
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('restaurant_id, total')
    .gte('created_at', `${today}T00:00:00`);

  const revByRestaurant = new Map<string, number>();
  const ordersByRestaurant = new Map<string, number>();
  for (const o of todayOrders ?? []) {
    const rid = o?.restaurant_id as string;
    revByRestaurant.set(rid, (revByRestaurant.get(rid) ?? 0) + Number(o?.total ?? 0));
    ordersByRestaurant.set(rid, (ordersByRestaurant.get(rid) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="Restaurants"
        sub={`${restaurants?.length ?? 0} tenants on the platform — click any card for details, edit & access`}
        right={<AdminAddRestaurant />}
      />

      {(restaurants ?? []).length === 0 && (
        <Empty title="No restaurants yet" sub="Run seed.sql or sign up a new restaurant to get started." />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(restaurants ?? []).map((r) => (
          <Card key={r.id} className="stat-card-luxury h-full p-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-[17px] font-black tracking-tight text-ink">{r.name}</h3>
              <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-brand">
                {r.subscription_tier}
              </span>
            </div>
            <p className="mt-1 font-mono text-[12.5px] font-bold text-muted">/{r.slug}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line/70 pt-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Today revenue</p>
                <p className="text-[15px] font-black text-ink">{fmtPKR(revByRestaurant.get(r.id) ?? 0)}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Today orders</p>
                <p className="text-[15px] font-black text-ink">{ordersByRestaurant.get(r.id) ?? 0}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Link href={`/admin/restaurants/${r.id}`} className="text-[12.5px] font-extrabold text-brand hover:underline">
                Details & Edit →
              </Link>
              <Link
                href={`/r/${r.slug}/owner`}
                prefetch={false}
                className="rounded-[8px] border border-line/12 px-2.5 py-1 text-[12px] font-bold text-muted transition-all hover:border-brand/40 hover:text-ink"
              >
                Open Dashboard ↗
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
