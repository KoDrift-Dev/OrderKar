// Server helper for staff pages: resolves tenant + signed-in profile.
// Middleware already gates auth/role/tenant; this is belt-and-braces plus
// provides the data the pages render.

import { redirect } from 'next/navigation';
import { getSessionProfile, canAccessRestaurant } from './auth';
import { getRestaurantBySlug } from './tenant';

export async function requireStaff(slug: string) {
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) redirect('/');
  const { profile } = await getSessionProfile();
  if (!profile || !canAccessRestaurant(profile, restaurant.id)) {
    redirect('/login');
  }
  return { restaurant, profile };
}
