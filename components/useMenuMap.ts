'use client';

// Shared menu lookup: item thumbnails + category ("station") grouping.
// Maps order_items → menu_items via menu_item_id (reliable), with a
// case-insensitive name fallback for legacy rows. Unmatched → 'Other'.

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrderItem } from '@/lib/types';
import { cdnUrl } from '@/lib/images';

interface MenuInfo {
  image_url: string | null;
  category_id: string | null;
  ingredients: string | null;
}

export function useMenuMap(restaurantId: string) {
  const [menuById, setMenuById] = useState<Map<string, MenuInfo>>(new Map());
  const [menuByName, setMenuByName] = useState<Map<string, MenuInfo>>(new Map());
  const [catNameById, setCatNameById] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const [{ data: items }, { data: cats }] = await Promise.all([
        supabase.from('menu_items').select('id,name,image_url,category_id,ingredients').eq('restaurant_id', restaurantId),
        supabase.from('menu_categories').select('id,name').eq('restaurant_id', restaurantId),
      ]);
      if (!live) return;
      const byId = new Map<string, MenuInfo>();
      const byName = new Map<string, MenuInfo>();
      for (const m of (items ?? []) as any[]) {
        const info: MenuInfo = { image_url: m.image_url ?? null, category_id: m.category_id ?? null, ingredients: m.ingredients ?? null };
        byId.set(m.id, info);
        byName.set(String(m.name).trim().toLowerCase(), info);
      }
      setMenuById(byId);
      setMenuByName(byName);
      setCatNameById(new Map(((cats ?? []) as any[]).map((c) => [c.id, c.name])));
    })();
    return () => {
      live = false;
    };
  }, [restaurantId]);

  const infoOf = (item: OrderItem): MenuInfo | undefined =>
    (item.menu_item_id && menuById.get(item.menu_item_id)) ||
    menuByName.get(item.item_name.trim().toLowerCase());

  const thumbOf = (item: OrderItem): string => cdnUrl(infoOf(item)?.image_url);

  const stationOf = (item: OrderItem): string => {
    const cid = infoOf(item)?.category_id;
    return (cid && catNameById.get(cid)) || 'Other';
  };

  const ingredientsOf = (item: OrderItem): string | null => infoOf(item)?.ingredients ?? null;

  const menuInfoById = (id: string | null): { image_url: string | null; ingredients: string | null } | undefined => {
    if (!id) return undefined;
    const m = menuById.get(id);
    return m ? { image_url: m.image_url, ingredients: m.ingredients } : undefined;
  };

  return { thumbOf, stationOf, ingredientsOf, menuInfoById, catNameById };
}
