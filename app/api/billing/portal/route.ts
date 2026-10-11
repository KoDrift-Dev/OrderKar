// POST /api/billing/portal — open the Stripe Customer Portal
// (update card, cancel, view invoices). Body: { restaurantId: string }

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { billingIsConfigured, getStripe } from '@/lib/stripe';

function appUrl(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    req.headers.get('origin') ||
    'https://orderkar-seven.vercel.app'
  );
}

export async function POST(req: Request) {
  if (!billingIsConfigured()) {
    return NextResponse.json({ error: 'Online billing is not configured yet.' }, { status: 503 });
  }
  const { restaurantId } = (await req.json().catch(() => ({}))) as { restaurantId?: string };
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, restaurant_id')
    .eq('id', user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  const profileRest = (profile as { restaurant_id?: string } | null)?.restaurant_id;
  if (!profile || (profileRest !== restaurantId && role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const customerId = (sub as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: 'No billing customer yet — subscribe first.' }, { status: 400 });
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('slug')
    .eq('id', restaurantId)
    .maybeSingle();
  const slug = (restaurant as { slug?: string } | null)?.slug ?? '';

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl(req)}/r/${slug}/owner`,
  });
  return NextResponse.json({ url: session.url });
}
