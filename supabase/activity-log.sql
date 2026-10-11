-- ============================================================================
-- OrderKar — activity_log: per-restaurant audit trail
-- (order/item/status/payment events for the Tracking History feature).
--
-- This is the 5th pending SQL file. Run in the Supabase SQL editor.
-- Safe to re-run (IF NOT EXISTS guards throughout).
--
-- NOTE: this creates the table + RLS. The app-side logging calls
-- (lib/activity.ts + wiring into kitchen/payment/menu flows) are a
-- separate code round — the table alone does not log anything yet.
-- ============================================================================

create table if not exists public.activity_log (
  id            uuid        primary key default gen_random_uuid(),
  restaurant_id uuid       not null references public.restaurants(id) on delete cascade,
  actor_id      uuid        references public.profiles(id) on delete set null,
  action        text        not null,
  -- e.g. 'order_created', 'item_added', 'status_changed',
  --      'payment_collected', 'order_cancelled', 'stock_adjusted'
  entity_type   text        not null,
  -- 'order' | 'order_item' | 'menu_item' | 'table' | 'inventory_item'
  entity_id     uuid,
  details       jsonb       not null default '{}',
  ip_address    text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_activity_log_restaurant
  on public.activity_log (restaurant_id, created_at desc);

alter table public.activity_log enable row level security;

drop policy if exists activity_log_tenant on public.activity_log;
create policy activity_log_tenant on public.activity_log
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );

grant all on public.activity_log to authenticated;

-- Customer QR flow places orders as anon: allow append-only inserts so
-- "order placed" events are logged. Reads stay staff-only via the policy above.
drop policy if exists activity_log_anon_insert on public.activity_log;
create policy activity_log_anon_insert on public.activity_log
  for insert to anon with check (true);

grant insert on public.activity_log to anon;
