// POST /api/billing/sync-session — after Stripe redirects back to the app,
// the signed-in owner syncs the checkout result immediately (the webhook may
// lag). Body: { sessionId: string }. Runs with the user's session so tenant
// RLS applies; the session's restaurant metadata must match the user.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { billingIsConfigured, getStripe } from '@/lib/stripe';
import { toBillingPeriod } from '@/lib/subscription';

export async function POST(req: Request) {
  if (!billingIsConfigured()) {
    return NextResponse.json({ error: 'billing not configured' }, { status: 503 });
  }
  const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, restaurant_id, is_active')
    .eq('id', user.id)
    .maybeSingle();
  const myRestaurant = (profile as { restaurant_id?: string } | null)?.restaurant_id;
  const isActive = (profile as { is_active?: boolean } | null)?.is_active;
  if (!profile || isActive === false) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: 'Unknown checkout session' }, { status: 400 });
  }
  const restaurantId = session.metadata?.restaurant_id;
  if (!restaurantId || (restaurantId !== myRestaurant && (profile as { role?: string } | null)?.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ ok: false, paid: false });
  }

  const plan = toBillingPeriod(session.metadata?.plan);
  const customerId = typeof session.customer === 'string' ? session.customer : null;
  const subId = typeof session.subscription === 'string' ? session.subscription : null;

  // Update the latest row (RLS: owner of this restaurant may write it).
  const { data: latest } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lid = (latest as { id?: string } | null)?.id;
  if (lid) {
    await supabase
      .from('subscriptions')
      .update({
        plan_type: plan,
        status: 'active',
        stripe_customer_id: customerId,
        stripe_subscription_id: subId,
      })
      .eq('id', lid);
  }
  await supabase.from('restaurants').update({ subscription_tier: plan }).eq('id', restaurantId);

  return NextResponse.json({ ok: true, plan });
}
