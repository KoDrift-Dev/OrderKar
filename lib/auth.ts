// Server-side auth helpers: session -> profile (+ role checks).

import { createClient } from './supabase/server';
import type { Profile, Role } from './types';
import { ROLE_RANK } from './roles';

export async function getSessionProfile(): Promise<{ profile: Profile | null; userId: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { profile: null, userId: null };
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return { profile: (data as Profile | null) ?? null, userId: user.id };
}

/** True when the profile may act inside the given restaurant. */
export function canAccessRestaurant(profile: Profile | null, restaurantId: string): boolean {
  if (!profile || !profile.is_active) return false;
  if (profile.is_super_admin) return true;
  return profile.restaurant_id === restaurantId;
}

/** Minimum role required for a staff route (super_admin always passes). */
export function hasRole(profile: Profile | null, minRole: Role): boolean {
  if (!profile || !profile.is_active) return false;
  if (profile.is_super_admin) return true;
  return ROLE_RANK[profile.role] >= ROLE_RANK[minRole];
}
