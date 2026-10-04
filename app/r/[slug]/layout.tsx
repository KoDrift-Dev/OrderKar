import { notFound } from 'next/navigation';
import { getRestaurantBySlug } from '@/lib/tenant';
import { isServerConfigured } from '@/lib/supabase/server';
import { TenantProvider } from '@/components/TenantProvider';
import { Empty } from '@/components/ui';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  if (!isServerConfigured()) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Empty
          title="Supabase not configured"
          sub="Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then run supabase/schema.sql and supabase/seed.sql in the Supabase SQL editor. See README.md."
        />
      </div>
    );
  }
  const restaurant = await getRestaurantBySlug(params.slug);
  if (!restaurant) notFound();
  return <TenantProvider restaurant={restaurant}>{children}</TenantProvider>;
}
