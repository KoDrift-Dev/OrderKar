-- ============================================================================
-- OrderKar — one-off fixes (2026-10-11). Run ONCE in the Supabase SQL editor.
--
-- 1. staff_members had an RLS policy but RLS was never ENABLED on the table,
--    so any authenticated user could read/write all staff rows cross-tenant.
-- 2. Index on orders.tracking_token — track_order() filters on it and the
--    customer QR tracker calls it every 3 seconds.
-- ============================================================================

-- 1. Enable RLS on staff_members (policy staff_members_tenant already exists
--    in schema.sql and now actually takes effect).
alter table public.staff_members enable row level security;

-- 2. Token lookup index for the order tracker RPC.
create index if not exists idx_orders_tracking_token
  on public.orders (tracking_token);
