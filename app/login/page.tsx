'use client';

// Login for all staff roles. After sign-in we read the profile and route to
// the right tenant home: /r/[slug]/owner|manager|waiter|kitchen (super_admin
// goes to /admin).

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { logActivity, ACT } from '@/lib/activity';
import { Btn, Card, Input, Label } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';
import Logo from '@/components/Logo';
import { LangProvider, normalizeLang, useT, type Lang } from '@/lib/i18n';

const ROLE_HOME: Record<string, string> = {
  // Owner and Manager share one unified console with full access.
  owner: 'owner',
  manager: 'owner',
  waiter: 'waiter',
  kitchen: 'kitchen',
};

const LANG_KEY = 'orderkar-lang';

// Only allow safe in-app redirect targets: a relative path starting with a
// single '/'. Rejects absolute URLs, protocol-relative '//', backslashes, and
// URL-encoded tricks (decoded twice to catch %252f-style double encoding).
function safeNext(raw: string | null): string | null {
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(decoded);
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (!decoded.startsWith('/')) return null;
  if (decoded.startsWith('//')) return null;
  if (decoded.includes('\\')) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(decoded)) return null;
  if (/[\r\n]/.test(decoded)) return null;
  return decoded;
}

function LoginForm({ lang, onLang }: { lang: Lang; onLang: (l: Lang) => void }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(params.get('error') === 'no-profile' ? t('lgn_no_profile') : '');
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const configured = isSupabaseConfigured();

  // If already signed in (e.g. browser back after replace fails, or direct
  // visit), send them to their home instead of showing the login form.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!live || !user) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_super_admin, is_active, restaurants(slug)')
          .eq('id', user.id)
          .maybeSingle();
        if (!live || !profile || !profile.is_active) return;
        const next = safeNext(params.get('next'));
        if (next) {
          router.replace(next);
        } else if (profile.is_super_admin) {
          router.replace('/admin');
        } else {
          const slug = (profile as unknown as { restaurants?: { slug?: string } }).restaurants?.slug;
          if (slug) router.replace(`/r/${slug}/${ROLE_HOME[profile.role] ?? 'waiter'}`);
        }
      } finally {
        if (live) setChecking(false);
      }
    })();
    return () => { live = false; };
  }, []);

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
          ? t('lgn_bad_credentials')
          : signErr.message;
        throw new Error(msg);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(t('lgn_no_session'));

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, restaurant_id, is_super_admin, is_active, restaurants(slug)')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || !profile.is_active) throw new Error(t('lgn_no_profile_owner'));

      if (profile.restaurant_id) {
        logActivity(supabase, {
          restaurantId: profile.restaurant_id,
          action: ACT.STAFF_LOGIN,
          entityType: 'profile',
          entityId: profile.id,
          details: { role: profile.role },
        });
      }

      const next = safeNext(params.get('next'));
      // Use replace (not push) so the login page is removed from browser
      // history — pressing back won't return to the login form.
      if (next) {
        router.replace(next);
        router.refresh();
        return;
      }
      if (profile.is_super_admin) {
        router.replace('/admin');
      } else {
        const slug = (profile as unknown as { restaurants?: { slug?: string } }).restaurants?.slug;
        if (!slug) throw new Error(t('lgn_no_restaurant'));
        router.replace(`/r/${slug}/${ROLE_HOME[profile.role] ?? 'waiter'}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('lgn_failed'));
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
      setResetMsg(t('lgn_reset_sent'));
    } catch (err) {
      setResetMsg(err instanceof Error ? err.message : t('lgn_reset_failed'));
    } finally {
      setResetBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[14px] font-bold text-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={40} />
            <span className="font-display text-xl font-extrabold text-ink">OrderKar</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="glass flex items-center !rounded-full p-1" role="group" aria-label="Language">
              {(['roman', 'english'] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => onLang(l)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-extrabold transition-all ${
                    lang === l ? 'btn-3d text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  {l === 'roman' ? 'Roman Urdu' : 'English'}
                </button>
              ))}
            </div>
            <ThemeToggle />
          </div>
        </div>
        <Card deep className="p-8">
          <h1 className="font-display text-2xl font-extrabold text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-muted">{t('lgn_sub')}</p>
          {!configured && (
            <p className="mt-4 rounded-btn bg-amber/15 p-3 text-sm font-bold text-amber">
              {t('lgn_not_configured')}
            </p>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4" autoComplete="off">
            <div>
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" name="ok-email" autoComplete="off" required disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.pk" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <button type="button" onClick={() => { setForgot((f) => !f); setResetMsg(''); }} className="text-[12.5px] font-bold text-brand hover:underline">
                  {t('lgn_forgot')}
                </button>
              </div>
              <div className="relative">
                <Input id="login-password" type={showPass ? 'text' : 'password'} name="ok-password" autoComplete="new-password" required disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="!pr-12" />
                <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-muted" title={showPass ? t('lgn_hide_pass') : t('lgn_show_pass')}>
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
                  {t('lgn_logging_in')}
                </span>
              ) : (
                'Log in'
              )}
            </Btn>
            {busy && (
              <p className="text-center text-[12px] font-semibold text-muted">{t('lgn_verifying')}</p>
            )}
          </form>
          {forgot && (
            <form onSubmit={sendReset} className="mt-5 rounded-btn border border-dashed border-line/12 p-4">
              <p className="text-[13.5px] font-bold text-ink">{t('lgn_reset_title')}</p>
              <p className="mt-0.5 text-[12.5px] text-muted">{t('lgn_reset_hint')}</p>
              <div className="mt-2.5 flex gap-2">
                <Input id="login-reset-email" type="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@restaurant.pk" className="flex-1" aria-label="Reset email" />
                <Btn type="submit" disabled={resetBusy}>{resetBusy ? t('lgn_sending') : t('lgn_send_link')}</Btn>
              </div>
              {resetMsg && <p className="mt-2 text-[12.5px] font-bold text-ink">{resetMsg}</p>}
            </form>
          )}
          <p className="mt-5 text-center text-sm text-muted">
            {t('lgn_new_rest')} <Link href="/signup" className="font-bold text-brand hover:underline">{t('lgn_start_trial')}</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [lang, setLang] = useState<Lang>('english');

  useEffect(() => {
    setLang(normalizeLang(localStorage.getItem(LANG_KEY)));
  }, []);

  const changeLang = (l: Lang) => {
    setLang(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* storage unavailable — ignore */
    }
  };

  return (
    <LangProvider value={lang}>
      <Suspense>
        <LoginForm lang={lang} onLang={changeLang} />
      </Suspense>
    </LangProvider>
  );
}
