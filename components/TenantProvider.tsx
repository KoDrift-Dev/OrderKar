'use client';

// Tenant context: the restaurant resolved from /r/[slug] (or its subdomain).
// Also applies per-tenant branding: theme_config.brand_color ("#0D9488")
// overrides the --c-brand-* CSS variables for the whole tenant tree, and
// theme_config.brand_color_2 (optional) makes brand gradients dual-color.

import { createContext, useContext, type CSSProperties } from 'react';
import type { Restaurant } from '@/lib/types';
import { brandThemeVars } from '@/lib/tenant-url';

const Ctx = createContext<Restaurant | null>(null);

export function TenantProvider({ restaurant, children }: { restaurant: Restaurant; children: React.ReactNode }) {
  const tc = (restaurant.theme_config ?? {}) as { brand_color?: string; brand_color_2?: string };
  const vars = brandThemeVars(tc.brand_color ?? '', tc.brand_color_2);
  const style = (Object.keys(vars).length > 0 ? vars : undefined) as CSSProperties | undefined;
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
