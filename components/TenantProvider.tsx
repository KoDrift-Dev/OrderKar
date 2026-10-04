'use client';

// Tenant context: the restaurant resolved from /r/[slug].

import { createContext, useContext } from 'react';
import type { Restaurant } from '@/lib/types';

const Ctx = createContext<Restaurant | null>(null);

export function TenantProvider({ restaurant, children }: { restaurant: Restaurant; children: React.ReactNode }) {
  return <Ctx.Provider value={restaurant}>{children}</Ctx.Provider>;
}

export function useTenant(): Restaurant {
  const r = useContext(Ctx);
  if (!r) throw new Error('useTenant must be used inside /r/[slug]');
  return r;
}
