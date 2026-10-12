// Server helper for staff pages: resolves tenant + signed-in profile.
// Middleware gates auth/role/tenant on full page loads, but client-side
// navigation bypasses middleware — so this MUST also enforce the role.
// This is the authoritative server-side role check.

import { redirect } from 'next/navigation';
import { getSessionProfile, canAccessRestaurant } from './auth';
import { getRestaurantBySlug } from './tenant';

const RANK: Record<string, number> = {
  kitchen: 1,
  waiter: 2,
  manager: 3,
  owner: 4,
};

export async function requireStaff(slug: string, minRole?: keyof typeof RANK) {
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) redirect('/');
  const { profile } = await getSessionProfile();
  if (!profile || !canAccessRestaurant(profile, restaurant.id)) {
    redirect('/login');
  }
  if (minRole) {
    const rank = profile.is_super_admin ? 5 : (RANK[profile.role] ?? 0);
    if (rank < RANK[minRole]) {
      // Send them to the highest page their role allows.
      const fallback =
        rank >= RANK.manager
          ? `/r/${slug}/owner`
          : profile.role === 'kitchen'
            ? `/r/${slug}/kitchen`
            : `/r/${slug}/waiter`;
      redirect(profile.is_super_admin ? `/r/${slug}/owner` : fallback);
    }
  }
  return { restaurant, profile };
}
