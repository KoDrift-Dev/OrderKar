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
import Logo from '@/components/Logo';

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
  const [showPass, setShowPass] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const configured = isSupabaseConfigured();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured || busy) return;
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signErr) {
        const msg = /invalid login credentials/i.test(signErr.message)
          ? 'Email or password is incorrect. Please try again.'
          : signErr.message;
        throw new Error(msg);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Sign-in succeeded but no session was created.');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, is_super_admin, is_active, restaurants(slug)')
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
        const slug = (profile as unknown as { restaurants?: { slug?: string } }).restaurants?.slug;
        if (!slug) throw new Error('Your restaurant could not be found.');
        router.push(`/r/${slug}/${ROLE_HOME[profile.role] ?? 'waiter'}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetBusy || !resetEmail.trim()) return;
    setResetBusy(true);
    setResetMsg('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
      setResetMsg('Reset link sent — apna inbox check karo (spam folder bhi).');
    } catch (err) {
      setResetMsg(err instanceof Error ? err.message : 'Could not send reset link.');
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={40} />
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
              <Input type="email" required disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.pk" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Password</Label>
                <button type="button" onClick={() => { setForgot((f) => !f); setResetMsg(''); }} className="text-[12.5px] font-bold text-brand hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input type={showPass ? 'text' : 'password'} required disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="!pr-12" />
                <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-muted" title={showPass ? 'Hide password' : 'Show password'}>
                  {showPass ? '\u{1F648}' : '\u{1F441}\uFE0F'}
                </button>
              </div>
            </div>
            {error && <p className="text-sm font-bold text-danger">{error}</p>}
            <Btn type="submit" className="w-full" size="lg" disabled={busy || !configured}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin" width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Logging in…
                </span>
              ) : (
                'Log in'
              )}
            </Btn>
            {busy && (
              <p className="text-center text-[12px] font-semibold text-muted">Account verify ho raha hai — chand second lagein ge…</p>
            )}
          </form>
          {forgot && (
            <form onSubmit={sendReset} className="mt-5 rounded-btn border border-dashed border-line p-4">
              <p className="text-[13.5px] font-bold text-ink">Reset password</p>
              <p className="mt-0.5 text-[12.5px] text-muted">Apna login email likho — reset link bhej dunga.</p>
              <div className="mt-2.5 flex gap-2">
                <Input type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@restaurant.pk" className="flex-1" />
                <Btn type="submit" disabled={resetBusy}>{resetBusy ? 'Sending…' : 'Send link'}</Btn>
              </div>
              {resetMsg && <p className="mt-2 text-[12.5px] font-bold text-ink">{resetMsg}</p>}
            </form>
          )}
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
