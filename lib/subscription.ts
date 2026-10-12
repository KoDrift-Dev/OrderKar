// Subscription billing periods + access state (server-safe: no React, no browser client).
// Single plan for all restaurants — billing differs only by period.

export type BillingPeriod = 'monthly' | '6month' | 'yearly';

export const BILLING_PERIODS: Record<
  BillingPeriod,
  { name: string; months: number; pricePKR: number; tagline: string }
> = {
  monthly: {
    name: 'Monthly',
    months: 1,
    pricePKR: 7999,
    tagline: 'Fixed monthly fee, cancel anytime.',
  },
  '6month': {
    name: '6 Months',
    months: 6,
    pricePKR: 43999,
    tagline: 'One-time payment for 6 months.',
  },
  yearly: {
    name: 'Yearly',
    months: 12,
    pricePKR: 79999,
    tagline: 'One-time payment for 1 year. Best value.',
  },
};

export const TRIAL_DAYS = 14;

// Fair-use limits — same for every restaurant (single plan).
export const FAIR_USE_LIMITS = {
  tables: 50,
  ordersPerMonth: 5000,
  menuItems: 500,
  staff: 20,
  storageGB: 5,
} as const;

export type UsageMetric = {
  key: keyof typeof FAIR_USE_LIMITS;
  label: string;
  used: number;
  limit: number;
  unit: string;
};

export const PLAN_FEATURES = [
  'QR customer ordering',
  'Waiter + Kitchen apps',
  'Owner dashboard & reports',
  'Inventory, suppliers & purchase orders',
  'Recipe auto-deduction & food cost',
  'Waste logging & loss audit',
  'Unlimited tables & menu items',
  'Priority support',
];

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
  | { kind: 'trialing'; daysLeft: number; period: BillingPeriod }
  | { kind: 'active'; period: BillingPeriod; periodEnd: string | null }
  | { kind: 'past_due'; period: BillingPeriod }
  | { kind: 'expired'; period: BillingPeriod }
  | { kind: 'unknown' };

export function toBillingPeriod(p: string | null | undefined): BillingPeriod {
  return p === '6month' || p === 'yearly' ? p : 'monthly';
}

export function accessState(sub: SubRow | null): AccessState {
  if (!sub) return { kind: 'unknown' };
  const period = toBillingPeriod(sub.plan_type);
  const now = Date.now();
  if (sub.status === 'trial') {
    const ends = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : NaN;
    if (!Number.isNaN(ends)) {
      const daysLeft = Math.ceil((ends - now) / 86400000);
      if (daysLeft >= 0) return { kind: 'trialing', daysLeft, period };
      return { kind: 'expired', period };
    }
    return { kind: 'trialing', daysLeft: TRIAL_DAYS, period };
  }
  if (sub.status === 'active') {
    return { kind: 'active', period, periodEnd: sub.current_period_end };
  }
  if (sub.status === 'past_due') return { kind: 'past_due', period };
  return { kind: 'expired', period };
}

/** True when the owner console should be locked behind the paywall. */
export function isLocked(state: AccessState): boolean {
  return state.kind === 'expired' || state.kind === 'past_due';
}
