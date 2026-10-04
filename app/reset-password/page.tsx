'use client';

// Handles Supabase password-recovery links (/reset-password#access_token=…&type=recovery).
// Supabase-js picks the session up from the URL hash automatically; we then
// let the user set a new password.

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Btn, Card, Input, Label } from '@/components/ui';
import Logo from '@/components/Logo';

function ResetForm() {
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Give the client a moment to parse the recovery token from the URL hash.
    const t = window.setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setValid(!!session);
      setReady(true);
    }, 800);
    return () => window.clearTimeout(t);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (p1.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (p1 !== p2) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) throw new Error(error.message);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <Logo size={40} />
          <span className="font-display text-xl font-extrabold text-ink">OrderKar</span>
        </div>
        <Card deep className="p-8">
          <h1 className="font-display text-2xl font-extrabold text-ink">Set new password</h1>
          {!ready ? (
            <p className="mt-4 text-sm text-muted">Checking your reset link…</p>
          ) : done ? (
            <>
              <p className="mt-4 rounded-btn bg-ok/10 p-3 text-sm font-bold text-ok">
                Password updated! Ab naye password se login karo.
              </p>
              <Link href="/login">
                <Btn className="mt-4 w-full" size="lg">Go to login</Btn>
              </Link>
            </>
          ) : !valid ? (
            <>
              <p className="mt-4 rounded-btn bg-danger/10 p-3 text-sm font-bold text-danger">
                Ye reset link invalid ya expire ho chuka hai. Login page se dobara link mangwao.
              </p>
              <Link href="/login">
                <Btn className="mt-4 w-full" size="lg">Back to login</Btn>
              </Link>
            </>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <Label>New password</Label>
                <div className="relative">
                  <Input type={show ? 'text' : 'password'} required value={p1} onChange={(e) => setP1(e.target.value)} placeholder="min 6 characters" className="!pr-12" />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-muted">
                    {show ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div>
                <Label>Confirm password</Label>
                <Input type={show ? 'text' : 'password'} required value={p2} onChange={(e) => setP2(e.target.value)} placeholder="repeat password" />
              </div>
              {error && <p className="text-sm font-bold text-danger">{error}</p>}
              <Btn type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? 'Updating…' : 'Update password'}
              </Btn>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
