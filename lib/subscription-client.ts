'use client';

// Client-side subscription helpers (browser Supabase + React hook).

import { useEffect, useState } from 'react';
import { createClient } from './supabase/client';
import { accessState, type AccessState, type SubRow } from './subscription';

export async function fetchSubscription(restaurantId: string): Promise<SubRow | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SubRow | null) ?? null;
}

/** Client hook for banners/paywall. Returns null while loading. */
export function useSubscription(restaurantId: string): AccessState | null {
  const [state, setState] = useState<AccessState | null>(null);
  useEffect(() => {
    let live = true;
    fetchSubscription(restaurantId)
      .then((sub) => {
        if (live) setState(accessState(sub));
      })
      .catch(() => {
        if (live) setState({ kind: 'unknown' });
      });
    return () => {
      live = false;
    };
  }, [restaurantId]);
  return state;
}
