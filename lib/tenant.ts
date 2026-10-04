// Tenant resolution: slug -> restaurant. Used by /r/[slug] layout.

import { createClient, isServerConfigured } from './supabase/server';
import type { Restaurant } from './types';

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  if (!isServerConfigured()) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as Restaurant;
}
