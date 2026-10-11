// POST /api/billing/webhook — Stripe webhook. Verifies the signature, then
// applies the event through the stripe_webhook_apply() SECURITY DEFINER
// function (the route has no user session, so it can't pass tenant RLS
// directly; the function only accepts allowlisted values).
//
// Configure in Stripe Dashboard: endpoint <app>/api/billing/webhook,
// events: checkout.session.completed, customer.subscription.updated,
// customer.subscription.deleted, invoice.payment_failed.

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { billingIsConfigured, getStripe, getWebhookSecret } from '@/lib/stripe';
import { toPlanKey } from '@/lib/subscription';

export async function POST(req: Request) {
  if (!billingIsConfigured()) {
    return NextResponse.json({ error: 'billing not configured' }, { status: 503 });
  }
  const secret = getWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: 'webhook secret missing' }, { status: 500 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  const supabase = createClient();
  const apply = (args: {
    customerId: string;
    status: 'trial' | 'active' | 'past_due' | 'cancelled';
    plan: string;
    subId?: string | null;
    priceId?: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    cancelAt?: boolean;
  }) =>
    supabase.rpc('stripe_webhook_apply', {
      p_customer_id: args.customerId,
      p_status: args.status,
      p_plan: args.plan,
      p_stripe_sub_id: args.subId ?? null,
      p_price_id: args.priceId ?? null,
      p_period_start: args.periodStart ?? null,
      p_period_end: args.periodEnd ?? null,
      p_cancel_at: args.cancelAt ?? false,
    });

  const periodTs = (s: Stripe.Subscription, key: 'current_period_start' | 'current_period_end') => {
    const direct = (s as unknown as Record<string, unknown>)[key];
    const nested = s.items.data[0]
      ? (s.items.data[0] as unknown as Record<string, unknown>)[key]
      : undefined;
    const v = typeof direct === 'number' ? direct : typeof nested === 'number' ? nested : null;
    return v ? new Date(v * 1000).toISOString() : null;
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const plan = toPlanKey(s.metadata?.plan);
        if (typeof s.customer === 'string') {
          await apply({
            customerId: s.customer,
            status: 'active',
            plan,
            subId: typeof s.subscription === 'string' ? s.subscription : null,
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const plan = toPlanKey(sub.metadata?.plan);
        const status =
          event.type === 'customer.subscription.deleted'
            ? 'cancelled'
            : sub.status === 'past_due' || sub.status === 'unpaid'
              ? 'past_due'
              : sub.status === 'active' || sub.status === 'trialing'
                ? 'active'
                : 'cancelled';
        await apply({
          customerId: sub.customer as string,
          status,
          plan,
          subId: sub.id,
          priceId: sub.items.data[0]?.price.id ?? null,
          periodStart: periodTs(sub, 'current_period_start'),
          periodEnd: periodTs(sub, 'current_period_end'),
          cancelAt: sub.cancel_at_period_end ?? false,
        });
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        if (typeof inv.customer === 'string') {
          // Plan is unknown on a bare invoice event; keep the row's plan.
          const { data } = await supabase
            .from('subscriptions')
            .select('plan_type')
            .eq('stripe_customer_id', inv.customer)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          await apply({
            customerId: inv.customer,
            status: 'past_due',
            plan: toPlanKey((data as { plan_type?: string } | null)?.plan_type),
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('[billing webhook]', e);
  }

  return NextResponse.json({ received: true });
}
