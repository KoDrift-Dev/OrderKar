'use client';

// Tenant context: the restaurant resolved from /r/[slug] (or its subdomain).
// Also applies per-tenant branding: theme_config.brand_color ("#0D9488")
// overrides the --c-brand-rgb CSS variable for the whole tenant tree.

import { createContext, useContext, type CSSProperties } from 'react';
import type { Restaurant } from '@/lib/types';
import { hexToRgbTriplet } from '@/lib/tenant-url';

const Ctx = createContext<Restaurant | null>(null);

export function TenantProvider({ restaurant, children }: { restaurant: Restaurant; children: React.ReactNode }) {
  const tc = (restaurant.theme_config ?? {}) as { brand_color?: string };
  const rgb = tc.brand_color ? hexToRgbTriplet(tc.brand_color) : null;
  const style = rgb ? ({ '--c-brand-rgb': rgb } as CSSProperties) : undefined;
  return (
    <div style={style} className="min-h-screen">
      <Ctx.Provider value={restaurant}>{children}</Ctx.Provider>
    </div>
  );
}

export function useTenant(): Restaurant {
  const r = useContext(Ctx);
  if (!r) throw new Error('useTenant must be used inside /r/[slug]');
  return r;
}
