// Subscription plans + access state (server-safe: no React, no browser client).

export type PlanKey = 'starter' | 'pro' | 'enterprise';

export const PLANS: Record<
  PlanKey,
  { name: string; monthlyPKR: number | null; tagline: string; features: string[] }
> = {
  starter: {
    name: 'Starter',
    monthlyPKR: 4999,
    tagline: 'For single small restaurants getting started.',
    features: [
      'QR customer ordering',
      'Waiter + Kitchen apps',
      'Owner dashboard & reports',
      'Up to 15 tables',
      'Email support',
    ],
  },
  pro: {
    name: 'Pro',
    monthlyPKR: 9999,
    tagline: 'For growing restaurants that need inventory control.',
    features: [
      'Everything in Starter',
      'Inventory, suppliers & purchase orders',
      'Recipe auto-deduction & food cost',
      'Waste logging & loss audit',
      'Unlimited tables',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    monthlyPKR: null,
    tagline: 'For chains & multi-branch groups. Talk to us.',
    features: [
      'Everything in Pro',
      'Multi-branch support',
      'Custom domain & white-label',
      'Dedicated onboarding',
    ],
  },
};

export type SubRow = {
  id: string;
  restaurant_id: string;
  plan_type: string;
  status: string;
  start_date: string;
  end_date: string | null;
  amount: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

export type AccessState =
  | { kind: 'trialing'; daysLeft: number; plan: PlanKey }
  | { kind: 'active'; plan: PlanKey; periodEnd: string | null }
  | { kind: 'past_due'; plan: PlanKey }
  | { kind: 'expired'; plan: PlanKey }
  | { kind: 'unknown' };

export function toPlanKey(p: string | null | undefined): PlanKey {
  return p === 'pro' || p === 'enterprise' ? p : 'starter';
}

export function accessState(sub: SubRow | null): AccessState {
  if (!sub) return { kind: 'unknown' };
  const plan = toPlanKey(sub.plan_type);
  const now = Date.now();
  if (sub.status === 'trial') {
    const ends = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : NaN;
    if (!Number.isNaN(ends)) {
      const daysLeft = Math.ceil((ends - now) / 86400000);
      if (daysLeft >= 0) return { kind: 'trialing', daysLeft, plan };
      return { kind: 'expired', plan };
    }
    return { kind: 'trialing', daysLeft: 14, plan };
  }
  if (sub.status === 'active') {
    return { kind: 'active', plan, periodEnd: sub.current_period_end };
  }
  if (sub.status === 'past_due') return { kind: 'past_due', plan };
  return { kind: 'expired', plan };
}

/** True when the owner console should be locked behind the paywall. */
export function isLocked(state: AccessState): boolean {
  return state.kind === 'expired' || state.kind === 'past_due';
}
