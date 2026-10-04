'use client';

// Restaurant owner signup: creates auth user + restaurant tenant + owner
// profile + trial subscription via the server action.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { signupRestaurant } from './actions';
import { Btn, Card, Input, Label } from '@/components/ui';
import ThemeToggle from '@/components/ThemeToggle';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ restaurantName: '', ownerName: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured || busy) return;
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    setError('');
    const res = await signupRestaurant(form);
    if (res.needsConfirmation) {
      setError('Check your email to confirm your account, then log in to finish setup.');
    } else if (!res.ok) {
      setError(res.error ?? 'Signup failed');
    } else {
      router.push(`/r/${res.slug}/owner?welcome=1`);
      router.refresh();
    }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="btn-3d flex h-10 w-10 items-center justify-center rounded-[12px] font-display text-xl font-extrabold text-white">O</div>
            <span className="font-display text-xl font-extrabold text-ink">OrderKar</span>
          </Link>
          <ThemeToggle />
        </div>
        <Card deep className="p-8">
          <h1 className="font-display text-2xl font-extrabold text-ink">Start your free trial</h1>
          <p className="mt-1 text-sm text-muted">14 days free · your restaurant live in minutes.</p>
          {!configured && (
            <p className="mt-4 rounded-btn bg-amber/15 p-3 text-sm font-bold text-amber">
              Supabase is not configured. Add keys to .env.local first.
            </p>
          )}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label>Restaurant name</Label>
              <Input required value={form.restaurantName} onChange={set('restaurantName')} placeholder="Spice Villa" />
            </div>
            <div>
              <Label>Your name (owner)</Label>
              <Input required value={form.ownerName} onChange={set('ownerName')} placeholder="Ali Raza" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" required value={form.email} onChange={set('email')} placeholder="owner@restaurant.pk" />
            </div>
            <div>
              <Label>Phone (optional)</Label>
              <Input value={form.phone} onChange={set('phone')} placeholder="0300-1234567" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" required value={form.password} onChange={set('password')} placeholder="Min. 6 characters" />
            </div>
            {error && <p className="text-sm font-bold text-danger">{error}</p>}
            <Btn type="submit" className="w-full" size="lg" disabled={busy || !configured}>
              {busy ? 'Creating…' : 'Create my restaurant'}
            </Btn>
          </form>
          <p className="mt-5 text-center text-sm text-muted">
            Already have an account? <Link href="/login" className="font-bold text-brand hover:underline">Log in</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
