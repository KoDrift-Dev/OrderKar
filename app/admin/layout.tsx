import { redirect } from 'next/navigation';
import { createClient, isServerConfigured } from '@/lib/supabase/server';
import AdminSidebar from '@/components/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isServerConfigured()) redirect('/login');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin, name')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.is_super_admin) redirect('/');

  return (
    <div className="flex min-h-screen bg-[var(--c-bg)]">
      <AdminSidebar adminName={profile?.name ?? 'Super Admin'} />
      <div className="min-w-0 flex-1 lg:pl-0">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
