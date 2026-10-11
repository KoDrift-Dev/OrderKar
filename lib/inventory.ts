// Inventory auto-deduction — Phase 2, item #18.
// When an order is completed/paid, ingredients consumed by its menu items
// are deducted from inventory according to the recipes table.
//
// Fire-and-forget by design: deductions must NEVER block or break the
// payment flow, so all errors are caught and swallowed silently.

import type { SupabaseClient } from '@supabase/supabase-js';
import { logActivity, ACT } from './activity';

/**
 * Deduct recipe ingredients for a completed order.
 * Returns void immediately; the work runs async in the background.
 */
export function deductInventoryForOrder(
  supabase: SupabaseClient,
  orderId: string,
  restaurantId: string,
): void {
  void (async () => {
    try {
      // 1. Order lines (skip custom/ad-hoc lines without a menu item).
      const { data: lines, error: linesErr } = await supabase
        .from('order_items')
        .select('menu_item_id, quantity')
        .eq('order_id', orderId);
      if (linesErr || !lines || lines.length === 0) return;

      const qtyByMenuItem = new Map<string, number>();
      for (const l of lines) {
        if (!l.menu_item_id || !l.quantity) continue;
        qtyByMenuItem.set(l.menu_item_id, (qtyByMenuItem.get(l.menu_item_id) ?? 0) + l.quantity);
      }
      if (qtyByMenuItem.size === 0) return;

      // 2. Recipes for those menu items (same restaurant only).
      const menuItemIds = [...qtyByMenuItem.keys()];
      const { data: recipes, error: recipesErr } = await supabase
        .from('recipes')
        .select('menu_item_id, ingredient_id, quantity_required')
        .in('menu_item_id', menuItemIds)
        .eq('restaurant_id', restaurantId);
      if (recipesErr || !recipes || recipes.length === 0) return;

      // 3. Aggregate total deduction per ingredient:
      //    sum over lines of (order_qty × quantity_required).
      const deductByIngredient = new Map<string, number>();
      for (const r of recipes) {
        if (!r.ingredient_id || r.quantity_required == null) continue;
        const orderQty = qtyByMenuItem.get(r.menu_item_id) ?? 0;
        if (orderQty <= 0) continue;
        const amount = orderQty * Number(r.quantity_required);
        if (amount <= 0) continue;
        deductByIngredient.set(r.ingredient_id, (deductByIngredient.get(r.ingredient_id) ?? 0) + amount);
      }
      if (deductByIngredient.size === 0) return;

      // 4. Read current stock, then decrement (clamped at 0 — never negative).
      const ingredientIds = [...deductByIngredient.keys()];
      const { data: stock, error: stockErr } = await supabase
        .from('inventory_items')
        .select('id, current_stock')
        .in('id', ingredientIds)
        .eq('restaurant_id', restaurantId);
      if (stockErr || !stock) return;

      const deductions: { ingredient_id: string; deducted: number }[] = [];
      for (const s of stock) {
        const deduct = deductByIngredient.get(s.id) ?? 0;
        if (deduct <= 0) continue;
        const current = Number(s.current_stock ?? 0);
        const applied = Math.min(current, deduct); // clamp: stock never goes below 0
        const { error: updErr } = await supabase
          .from('inventory_items')
          .update({ current_stock: current - applied })
          .eq('id', s.id);
        if (updErr) continue;
        deductions.push({ ingredient_id: s.id, deducted: applied });
      }
      if (deductions.length === 0) return;

      // 5. Audit trail.
      logActivity(supabase, {
        restaurantId,
        action: ACT.INVENTORY_DEDUCTED,
        entityType: 'order',
        entityId: orderId,
        details: { deductions },
      });
    } catch {
      // Best-effort: inventory deduction must never break the order flow.
    }
  })();
}
