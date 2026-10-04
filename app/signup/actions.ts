'use server';

// Restaurant signup: creates the auth user, then the restaurant tenant, the
// owner profile and a trial subscription — all through the anon key so RLS
// applies (restaurants_insert + profiles_insert_own policies).

import { createClient } from '@/lib/supabase/server';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'restaurant'
  );
}

export async function signupRestaurant(input: {
  restaurantName: string;
  ownerName: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<{ ok: boolean; slug?: string; error?: string; needsConfirmation?: boolean }> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { name: input.ownerName.trim() } },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: 'Signup failed — please try again.' };
  if (!data.session) {
    // Email confirmation is ON in the Supabase project: user must click the
    // link first; they can then log in and we finish onboarding there.
    return { ok: false, needsConfirmation: true };
  }

  // Unique slug
  const base = slugify(input.restaurantName);
  let slug = base;
  for (let i = 2; i < 20; i++) {
    const { data: existing } = await supabase.from('restaurants').select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${base}-${i}`;
  }

  const { data: restaurant, error: rErr } = await supabase
    .from('restaurants')
    .insert({ name: input.restaurantName.trim(), slug, subscription_tier: 'starter' })
    .select('id')
    .single();
  if (rErr || !restaurant) {
    return { ok: false, error: 'Could not create restaurant: ' + (rErr?.message ?? 'unknown error') };
  }

  const { error: pErr } = await supabase.from('profiles').insert({
    id: data.user.id,
    restaurant_id: restaurant.id,
    role: 'owner',
    name: input.ownerName.trim(),
    phone: input.phone?.trim() || null,
  });
  if (pErr) {
    return { ok: false, error: 'Could not create owner profile: ' + pErr.message };
  }

  await supabase.from('subscriptions').insert({
    restaurant_id: restaurant.id,
    plan_type: 'starter',
    status: 'trial',
    amount: 4999,
  });

  return { ok: true, slug };
}
