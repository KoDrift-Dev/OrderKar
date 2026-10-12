// POST /api/billing/checkout — create a Stripe Checkout session for a plan.
// Body: { restaurantId: string, plan: 'starter' | 'pro' | 'enterprise' }
// Only owner/manager of the restaurant may start checkout.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { billingIsConfigured, getStripe, getPriceId } from '@/lib/stripe';
import { toPlanKey } from '@/lib/subscription';

function appUrl(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get('origin') ||
    'https://orderkar-seven.vercel.app'
  );
}

export async function POST(req: Request) {
  if (!billingIsConfigured()) {
    return NextResponse.json(
      { error: 'Online billing is not configured yet. Please contact us to activate your plan.' },
      { status: 503 },
    );
  }
  const { restaurantId, plan } = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    plan?: string;
  };
  const planKey = toPlanKey(plan);
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
  }
  const priceId = getPriceId(planKey);
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for the ${planKey} plan.` },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, restaurant_id, is_active')
    .eq('id', user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  const profileRest = (profile as { restaurant_id?: string } | null)?.restaurant_id;
  const isActive = (profile as { is_active?: boolean } | null)?.is_active;
  if (!profile || isActive === false) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (profileRest !== restaurantId && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (role !== 'owner' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Only owners can change billing' }, { status: 403 });
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug')
    .eq('id', restaurantId)
    .maybeSingle();
  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });

  // Reuse or create the Stripe customer.
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let customerId = (sub as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null;
  const stripe = getStripe();
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: (restaurant as { name: string }).name,
      email: user.email ?? undefined,
      metadata: { restaurant_id: restaurantId },
    });
    customerId = customer.id;
    await supabase.from('subscriptions').insert({
      restaurant_id: restaurantId,
      plan_type: planKey,
      status: 'trial',
      stripe_customer_id: customerId,
    });
  }

  const base = appUrl(req);
  const slug = (restaurant as { slug: string }).slug;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { restaurant_id: restaurantId, plan: planKey },
    subscription_data: { metadata: { restaurant_id: restaurantId, plan: planKey } },
    success_url: `${base}/r/${slug}/owner?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/r/${slug}/owner?billing=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
