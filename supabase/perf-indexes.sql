-- ============================================================================
-- OrderKar — missing hot-path indexes (Milestone 1.5).
-- Run AFTER schema.sql + inventory-phase2.sql + activity-log.sql in the
-- Supabase SQL editor. Safe to re-run (all CREATE INDEX IF NOT EXISTS).
--
-- Already present in the repo (checked 2026-10-12) — NOT duplicated here:
--   idx_orders_restaurant_created   orders (restaurant_id, created_at desc)
--   idx_order_items_order           order_items (order_id)
--   idx_waste_restaurant            waste_logs (restaurant_id, logged_at desc)
--   idx_activity_log_restaurant     activity_log (restaurant_id, created_at desc)
--   idx_purchase_orders_restaurant  purchase_orders (restaurant_id, created_at desc)
--   idx_orders_restaurant / idx_orders_status / idx_inventory_restaurant /
--   idx_recipes_restaurant / idx_reviews_restaurant / idx_suppliers_restaurant
-- ============================================================================

-- orders.table_id — tableState() / table dashboards filter by table on every
-- owner/manager/waiter view.
create index if not exists idx_orders_table
  on public.orders (table_id);

-- order_items.menu_item_id — recipe lookups and per-item sales aggregation
-- (inventory deduction, reports) join through this column.
create index if not exists idx_order_items_menu_item
  on public.order_items (menu_item_id);

-- recipes.menu_item_id — inventory deduction queries recipes by menu item.
create index if not exists idx_recipes_menu_item
  on public.recipes (menu_item_id);

-- recipes.ingredient_id — low-stock / ingredient-usage lookups by ingredient.
create index if not exists idx_recipes_ingredient
  on public.recipes (ingredient_id);

-- reviews.order_id — feedback is joined to its order.
create index if not exists idx_reviews_order
  on public.reviews (order_id);

-- inventory_items.supplier_id — supplier detail pages + PO generation group
-- stock by supplier.
create index if not exists idx_inventory_supplier
  on public.inventory_items (supplier_id);

-- purchase_orders.supplier_id — PO history per supplier.
create index if not exists idx_purchase_orders_supplier
  on public.purchase_orders (supplier_id);
