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
        <PageHeader title="All restaurants" sub={`${restaurants?.length ?? 0} tenants on the platform`} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(restaurants ?? []).map((r) => (
            <Card key={r.id} className="p-5">
              <Link href={`/r/${r.slug}/owner`} className="block transition-transform hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-extrabold text-ink">{r.name}</h3>
                  <Pill tone="brand">{r.subscription_tier}</Pill>
                </div>
                <p className="mt-1 font-mono text-[12.5px] text-muted">/{r.slug}</p>
                <p className="mt-3 text-sm font-bold text-brand">Open dashboard →</p>
              </Link>
              <div className="mt-4 space-y-2.5 border-t border-line pt-3">
                <AdminPosToggle
                  restaurantId={r.id}
                  initial={(r.theme_config as Record<string, unknown> | null)?.pos_enabled !== false}
                />
                <AdminLangSelect
                  restaurantId={r.id}
                  initial={(r.theme_config as Record<string, unknown> | null)?.language === 'english' ? 'english' : 'roman'}
                />
              </div>
            </Card>
          ))}
        </div>
        {(!restaurants || restaurants.length === 0) && (
          <Empty title="No restaurants yet" sub="Run seed.sql or sign up a new restaurant to get started." />
        )}
        <Card className="mt-8 p-5">
          <h3 className="font-display text-[15px] font-extrabold text-ink">Platform pricing reference</h3>
          <p className="mt-2 font-mono text-[13px] text-muted">
            Starter {fmtPKR(4999)}/mo · Pro {fmtPKR(9999)}/mo · Enterprise {fmtPKR(24999)}/mo
          </p>
        </Card>
      </main>
    </div>
  );
}
