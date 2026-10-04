'use client';

// Login for all staff roles. After sign-in we read the profile and route to
// the right tenant home: /r/[slug]/owner|manager|waiter|kitchen (super_admin
// goes to /admin).

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { Btn, Card, Input, Label } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';

const ROLE_HOME: Record<string, string> = {
  owner: 'owner',
  manager: 'manager',
  waiter: 'waiter',
  kitchen: 'kitchen',
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(params.get('error') === 'no-profile' ? 'No staff profile found for this account.' : '');
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured || busy) return;
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signErr) throw new Error(signErr.message);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign-in succeeded but no session was created.');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, restaurant_id, role, is_super_admin, is_active')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || !profile.is_active) throw new Error('No staff profile found for this account. Ask your owner to create one.');

      const next = params.get('next');
      if (next) {
        router.push(next);
        router.refresh();
        return;
      }
      if (profile.is_super_admin) {
        router.push('/admin');
      } else {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('slug')
          .eq('id', profile.restaurant_id)
          .maybeSingle();
        if (!restaurant) throw new Error('Your restaurant could not be found.');
        router.push(`/r/${restaurant.slug}/${ROLE_HOME[profile.role] ?? 'waiter'}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="btn-3d flex h-10 w-10 items-center justify-center rounded-[12px] font-display text-xl font-extrabold text-white">O</div>
            <span className="font-display text-xl font-extrabold text-ink">OrderKar</span>
          </Link>
          <ThemeToggle />
        </div>
        <Card deep className="p-8">
          <h1 className="font-display text-2xl font-extrabold text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">Log in to your restaurant workspace.</p>
          {!configured && (
            <p className="mt-4 rounded-btn bg-amber/15 p-3 text-sm font-bold text-amber">
              Supabase is not configured. Add keys to .env.local first.
            </p>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.pk" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm font-bold text-danger">{error}</p>}
            <Btn type="submit" className="w-full" size="lg" disabled={busy || !configured}>
              {busy ? 'Logging in…' : 'Log in'}
            </Btn>
          </form>
          <p className="mt-5 text-center text-sm text-muted">
            New restaurant? <Link href="/signup" className="font-bold text-brand hover:underline">Start free trial</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
