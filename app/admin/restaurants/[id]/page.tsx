import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, PageHeader } from '@/components/ui';
import { fmtPKR } from '@/lib/format';
import AdminPosToggle from '@/components/AdminPosToggle';
import AdminPlanEditor from '@/components/AdminPlanEditor';
import AdminLangSelect from '@/components/AdminLangSelect';
import AdminRestaurantEditor from '@/components/AdminRestaurantEditor';
import AdminSectionToggles from '@/components/AdminSectionToggles';
import UsageMeters, { buildUsageMetrics } from '@/components/UsageMeters';

export default async function AdminRestaurantDetail({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: r } = await supabase.from('restaurants').select('*').eq('id', params.id).maybeSingle();
  if (!r) notFound();

  const tc = (r.theme_config ?? {}) as Record<string, unknown>;
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    { data: todayOrders },
    { data: weekOrders },
    { count: staffCount },
    { count: menuCount },
    { count: tableCount },
    { count: monthOrderCount },
    { count: photoCount },
  ] = await Promise.all([
    supabase.from('orders').select('total').eq('restaurant_id', r.id).gte('created_at', `${today}T00:00:00`),
    supabase.from('orders').select('total').eq('restaurant_id', r.id).gte('created_at', weekAgo),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('restaurant_id', r.id),
    supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', r.id),
    supabase.from('dining_tables').select('id', { count: 'exact', head: true }).eq('restaurant_id', r.id),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', r.id).gte('created_at', monthStart.toISOString()),
    supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', r.id).not('photo_url', 'is', null),
  ]);

  const usageMetrics = buildUsageMetrics({
    tables: tableCount ?? 0,
    ordersThisMonth: monthOrderCount ?? 0,
    menuItems: menuCount ?? 0,
    staff: staffCount ?? 0,
    files: photoCount ?? 0,
  });

  const todayRevenue = (todayOrders ?? []).reduce((s, o) => s + Number(o?.total ?? 0), 0);
  const weekRevenue = (weekOrders ?? []).reduce((s, o) => s + Number(o?.total ?? 0), 0);

  const quickLinks = [
    { href: `/r/${r.slug}/owner`, label: 'Owner Console', icon: '🖥️' },
    { href: `/r/${r.slug}/kitchen`, label: 'Kitchen', icon: '👨‍🍳' },
    { href: `/r/${r.slug}/waiter`, label: 'Waiter', icon: '🧑‍💼' },
    { href: `/r/${r.slug}/pos`, label: 'POS Register', icon: '🧾' },
    { href: `/r/${r.slug}/menu`, label: 'Menu', icon: '🍽️' },
    { href: `/r/${r.slug}/team`, label: 'Team', icon: '👥' },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/restaurants" className="text-[13px] font-bold text-muted hover:text-ink">
          ← All Restaurants
        </Link>
      </div>
      <PageHeader title={r.name} sub={`/${r.slug} · ${r.subscription_tier?.toUpperCase()} plan`} />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Today's Revenue", value: fmtPKR(todayRevenue), icon: '💰' },
          { label: "Today's Orders", value: String((todayOrders ?? []).length), icon: '🧾' },
          { label: '7-Day Revenue', value: fmtPKR(weekRevenue), icon: '📈' },
          { label: 'Staff / Menu / Tables', value: `${staffCount ?? 0} / ${menuCount ?? 0} / ${tableCount ?? 0}`, icon: '🏪' },
        ].map((s) => (
          <Card key={s.label} className="stat-card-luxury p-5">
            <span className="text-[24px]">{s.icon}</span>
            <p className="mt-2 font-display text-[22px] font-black tracking-tight text-ink">{s.value}</p>
            <p className="mt-0.5 text-[13px] font-bold text-muted">{s.label}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Edit details */}
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[16px] font-extrabold text-ink">Restaurant Details</h3>
          <AdminRestaurantEditor
            restaurantId={r.id}
            initial={{
              name: r.name ?? '',
              logo_url: (tc.logo_url as string) ?? '',
              address: (tc.address as string) ?? '',
              phone: (tc.phone as string) ?? '',
              email: (tc.email as string) ?? '',
              brand_color: (tc.brand_color as string) ?? '',
            }}
          />
        </Card>

        {/* Platform controls */}
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[16px] font-extrabold text-ink">Platform Controls</h3>
          <div className="space-y-3">
            <AdminPosToggle restaurantId={r.id} initial={tc.pos_enabled !== false} />
            <AdminPlanEditor restaurantId={r.id} initialTier={r.subscription_tier ?? 'monthly'} />
            <AdminLangSelect restaurantId={r.id} initial={tc.language === 'roman' ? 'roman' : 'english'} />
          </div>
          <div className="mt-5 border-t border-line/70 pt-4">
            <p className="text-[12px] font-bold uppercase tracking-wider text-muted">Slug (immutable)</p>
            <p className="mt-1 font-mono text-[14px] font-bold text-ink">/{r.slug}</p>
            <p className="mt-0.5 text-[12px] text-muted">Slug cannot be changed — printed QR codes are based on it.</p>
          </div>
        </Card>
      </div>

      {/* Usage vs fair-use limits */}
      <Card className="mt-6 p-5">
        <h3 className="mb-4 font-display text-[16px] font-extrabold text-ink">Usage & Fair-Use Limits</h3>
        <UsageMeters metrics={usageMetrics} />
      </Card>

      {/* Section visibility */}
      <Card className="mt-6 p-5">
        <h3 className="mb-4 font-display text-[16px] font-extrabold text-ink">Section Visibility</h3>
        <AdminSectionToggles
          restaurantId={r.id}
          initial={((tc.sections ?? {}) as Record<string, boolean>)}
        />
      </Card>

      {/* Quick access */}
      <Card className="mt-6 p-5">
        <h3 className="mb-4 font-display text-[16px] font-extrabold text-ink">Access Restaurant Pages</h3>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              prefetch={false}
              className="rounded-[12px] border border-line/12 p-4 text-center transition-all hover:border-brand/40"
            >
              <p className="text-[24px]">{l.icon}</p>
              <p className="mt-1.5 text-[13px] font-extrabold text-ink">{l.label}</p>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
