import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, isServerConfigured } from '@/lib/supabase/server';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import AdminNav from '@/components/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isServerConfigured()) redirect('/login');
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  if (!profile?.is_super_admin) redirect('/');

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line/12 bg-[var(--c-surface)] md:flex">
        <div className="flex items-center gap-2.5 border-b border-line/12 px-5 py-4">
          <Logo size={36} />
          <div className="leading-tight">
            <p className="font-display text-[15px] font-extrabold text-ink">OrderKar Platform</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Super Admin</p>
          </div>
        </div>
        <AdminNav />
        <div className="mt-auto border-t border-line/12 p-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-[12.5px] font-bold text-muted hover:text-ink"
            >
              ← Back to Site
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-line/12 bg-[var(--c-surface)] backdrop-blur-xl md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Logo size={32} />
              <p className="font-display text-[14px] font-extrabold text-ink">Super Admin</p>
            </div>
            <ThemeToggle />
          </div>
          <div className="border-t border-line/12 px-4 py-2">
            <AdminNav mobile />
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
