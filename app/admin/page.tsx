import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isServerConfigured } from '@/lib/supabase/server';
import { Card, Empty, PageHeader, Pill } from '@/components/ui';
import AdminPosToggle from '@/components/AdminPosToggle';
import AdminLangSelect from '@/components/AdminLangSelect';
import ThemeToggle from '@/components/ThemeToggle';
import { fmtPKR } from '@/lib/format';
import Logo from '@/components/Logo';

export default async function AdminPage() {
  if (!isServerConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Empty title="Supabase not configured" sub="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local" />
      </div>
    );
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!profile?.is_super_admin) redirect('/');

  const { data: restaurants } = await supabase.from('restaurants').select('id, name, slug, subscription_tier, theme_config, created_at').order('created_at');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-[var(--c-surface)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo size={36} />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-extrabold text-ink">OrderKar Platform</p>
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-muted">Super admin</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <h1 className="font-display text-[26px] font-black tracking-tight text-ink">
              All Restaurant Tenants
            </h1>
            <p className="mt-0.5 text-sm font-medium text-muted">
              {restaurants?.length ?? 0} active restaurant tenants provisioned on the platform
            </p>
          </div>
          <span className="rounded-full bg-brand/10 px-3 py-1 text-[12px] font-extrabold text-brand uppercase tracking-wider">
            Super Administrator Mode
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(restaurants ?? []).map((r) => (
            <Card key={r.id} className="stat-card-luxury p-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40">
              <Link href={`/r/${r.slug}/owner`} className="group block">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-black tracking-tight text-ink group-hover:text-brand transition-colors">
                    {r.name}
                  </h3>
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-extrabold text-brand uppercase tracking-wider">
                    {r.subscription_tier}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[12.5px] font-bold text-muted">/{r.slug}</p>
                <div className="mt-4 flex items-center justify-between border-t border-line/70 pt-2.5">
                  <span className="text-[12.5px] font-extrabold text-brand group-hover:underline">
                    Open Owner Dashboard &rarr;
                  </span>
                  <span className="text-[12px] text-muted">Manage tenant</span>
                </div>
              </Link>
              <div className="mt-3.5 space-y-2.5 border-t border-line/70 pt-3">
                <AdminPosToggle
                  restaurantId={r.id}
                  initial={(r.theme_config as Record<string, unknown> | null)?.pos_enabled !== false}
                />
                <AdminLangSelect
                  restaurantId={r.id}
                  initial={(r.theme_config as Record<string, unknown> | null)?.language === 'roman' ? 'roman' : 'english'}
                />
              </div>
            </Card>
          ))}
        </div>
        {(!restaurants || restaurants.length === 0) && (
          <Empty title="No restaurants yet" sub="Run seed.sql or sign up a new restaurant to get started." />
        )}
        <Card className="stat-card-luxury mt-8 p-5">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">💎</span>
            <h3 className="font-display text-[15px] font-extrabold text-ink">Platform Pricing & Tier Reference</h3>
          </div>
          <p className="mt-2 font-mono text-[13px] font-bold text-muted">
            Starter {fmtPKR(4999)}/mo &middot; Pro {fmtPKR(9999)}/mo &middot; Enterprise {fmtPKR(24999)}/mo
          </p>
        </Card>
      </main>
    </div>
  );
}
