'use client';

// Subscription & billing UI: current billing period / trial status, period
// picker, Stripe Checkout + Customer Portal. Gracefully degrades when Stripe
// isn't configured (shows a contact fallback instead of buttons).

import { useEffect, useState } from 'react';
import { Btn, Card } from './ui';
import {
  BILLING_PERIODS,
  PLAN_FEATURES,
  TRIAL_DAYS,
  toBillingPeriod,
  accessState,
  type BillingPeriod,
  type AccessState,
  type SubRow,
} from '@/lib/subscription';
import { fetchSubscription } from '@/lib/subscription-client';

const PERIOD_ORDER: BillingPeriod[] = ['monthly', '6month', 'yearly'];

export default function SubscriptionCard({ restaurantId }: { restaurantId: string }) {
  const [state, setState] = useState<AccessState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [hasCustomer, setHasCustomer] = useState(false);

  useEffect(() => {
    let live = true;
    fetchSubscription(restaurantId)
      .then((sub: SubRow | null) => {
        if (!live) return;
        setState(accessState(sub));
        setHasCustomer(Boolean(sub?.stripe_customer_id));
      })
      .catch(() => live && setState({ kind: 'unknown' }));
    return () => {
      live = false;
    };
  }, [restaurantId]);

  const startCheckout = async (period: BillingPeriod) => {
    setBusy(period);
    setNotice('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ restaurantId, period }),
      });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !j.url) {
        setNotice(j.error || 'Could not start checkout. Please try again.');
        return;
      }
      window.location.href = j.url;
    } catch {
      setNotice('Could not start checkout. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy('portal');
    setNotice('');
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ restaurantId }),
      });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !j.url) {
        setNotice(j.error || 'Could not open billing portal.');
        return;
      }
      window.location.href = j.url;
    } catch {
      setNotice('Could not open billing portal.');
    } finally {
      setBusy(null);
    }
  };

  const currentPeriod: BillingPeriod =
    state && state.kind !== 'unknown' ? state.period : 'monthly';

  const statusBanner = () => {
    if (!state || state.kind === 'unknown') return null;
    if (state.kind === 'trialing') {
      return (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-[13px] font-medium text-sky-700 dark:text-sky-300">
          🎉 You are on a <b>free trial</b>
          {state.daysLeft <= 3 ? (
            <>
              {' '}— <b>{state.daysLeft} day{state.daysLeft === 1 ? '' : 's'} left</b>. Pick a billing
              option below to keep everything running.
            </>
          ) : (
            <> — {state.daysLeft} days left. No card required yet.</>
          )}
        </div>
      );
    }
    if (state.kind === 'active') {
      return (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-[13px] font-medium text-emerald-700 dark:text-emerald-300">
          ✅ Subscription <b>active</b> ({BILLING_PERIODS[state.period].name} billing).
        </div>
      );
    }
    if (state.kind === 'past_due') {
      return (
        <div className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-[13px] font-medium text-amber dark:text-amber">
          ⚠️ Last payment <b>failed</b>. Update your payment method to avoid interruption.
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[13px] font-medium text-rose-700 dark:text-rose-300">
        ⏳ Your trial/subscription has <b>expired</b>. Pick a billing option below to reactivate.
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {statusBanner()}
      {notice && (
        <div className="rounded-xl border border-amber/40 bg-amber/10 px-4 py-3 text-[13px] font-medium text-amber dark:text-amber">
          {notice}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {PERIOD_ORDER.map((key) => {
          const p = BILLING_PERIODS[key];
          const isCurrent = key === currentPeriod;
          const price = `Rs ${p.pricePKR.toLocaleString('en-PK')}`;
          const per = key === 'monthly' ? '/month' : key === '6month' ? '/6 months' : '/year';
          return (
            <Card key={key} className={`p-5 ${isCurrent ? 'ring-2 ring-brand' : ''}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-extrabold text-ink">{p.name}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-brand">
                    Current
                  </span>
                )}
              </div>
              <p className="mt-1 text-[22px] font-black text-ink">
                {price}
                <span className="text-[13px] font-bold text-muted">{per}</span>
              </p>
              <p className="mt-1 text-[12px] text-muted">{p.tagline}</p>
              <ul className="mt-3 space-y-1.5">
                {PLAN_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink">
                    <span className="text-emerald-500" aria-hidden>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <Btn variant="secondary" className="w-full" disabled>
                    Current Billing
                  </Btn>
                ) : (
                  <Btn
                    className="w-full"
                    disabled={busy === key}
                    onClick={() => startCheckout(key)}
                  >
                    {busy === key ? 'Starting…' : `Choose ${p.name}`}
                  </Btn>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {hasCustomer && (
        <div className="flex justify-end">
          <Btn variant="secondary" disabled={busy === 'portal'} onClick={openPortal}>
            {busy === 'portal' ? 'Opening…' : '💳 Manage billing (card, invoices, cancel)'}
          </Btn>
        </div>
      )}
      <p className="text-[11.5px] text-muted">
        {TRIAL_DAYS}-day free trial included. Payments are processed securely by Stripe. Prices exclude any applicable taxes.
      </p>
    </div>
  );
}

// Re-export for the paywall in OwnerApp.
export { toBillingPeriod as toPlanKey };
