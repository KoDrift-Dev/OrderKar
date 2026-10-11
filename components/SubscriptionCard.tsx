'use client';

// Subscription & billing UI: current plan / trial status, plan picker,
// Stripe Checkout + Customer Portal. Gracefully degrades when Stripe
// isn't configured (shows a contact fallback instead of buttons).

import { useEffect, useState } from 'react';
import { Btn, Card } from './ui';
import {
  PLANS,
  toPlanKey,
  accessState,
  type PlanKey,
  type AccessState,
  type SubRow,
} from '@/lib/subscription';
import { fetchSubscription } from '@/lib/subscription-client';

const PLAN_ORDER: PlanKey[] = ['starter', 'pro', 'enterprise'];

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

  const startCheckout = async (plan: PlanKey) => {
    setBusy(plan);
    setNotice('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ restaurantId, plan }),
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

  const currentPlan: PlanKey =
    state && state.kind !== 'unknown' ? state.plan : 'starter';

  const statusBanner = () => {
    if (!state || state.kind === 'unknown') return null;
    if (state.kind === 'trialing') {
      return (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-[13px] font-medium text-sky-700 dark:text-sky-300">
          🎉 You are on a <b>free trial</b>
          {state.daysLeft <= 3 ? (
            <>
              {' '}— <b>{state.daysLeft} day{state.daysLeft === 1 ? '' : 's'} left</b>. Pick a plan
              below to keep everything running.
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
          ✅ Subscription <b>active</b> on the <b>{PLANS[state.plan].name}</b> plan.
        </div>
      );
    }
    if (state.kind === 'past_due') {
      return (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] font-medium text-amber-700 dark:text-amber-300">
          ⚠️ Last payment <b>failed</b>. Update your payment method to avoid interruption.
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[13px] font-medium text-rose-700 dark:text-rose-300">
        ⏳ Your trial/subscription has <b>expired</b>. Pick a plan below to reactivate.
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {statusBanner()}
      {notice && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] font-medium text-amber-700 dark:text-amber-300">
          {notice}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((key) => {
          const p = PLANS[key];
          const isCurrent = key === currentPlan;
          const price =
            p.monthlyPKR == null ? 'Custom' : `Rs ${p.monthlyPKR.toLocaleString('en-PK')}/mo`;
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
              <p className="mt-1 text-[22px] font-black text-ink">{price}</p>
              <p className="mt-1 text-[12px] text-muted">{p.tagline}</p>
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink">
                    <span className="text-emerald-500" aria-hidden>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                {key === 'enterprise' ? (
                  <Btn
                    variant="secondary"
                    className="w-full"
                    onClick={() =>
                      setNotice('For Enterprise, message us on WhatsApp and we will set it up for you.')
                    }
                  >
                    Contact Us
                  </Btn>
                ) : isCurrent ? (
                  <Btn variant="secondary" className="w-full" disabled>
                    Current Plan
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
        Payments are processed securely by Stripe. Prices exclude any applicable taxes.
      </p>
    </div>
  );
}

// Re-export for the paywall in OwnerApp.
export { toPlanKey };
