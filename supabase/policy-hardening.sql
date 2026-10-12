-- OrderKar — Policy hardening follow-up (Milestone 1.6).
-- Addresses 3 live-database concerns found during RLS verification.
--
--   ISSUE 1: Drop direct anon INSERT on orders/order_items.
--            Anon QR customers MUST go through create_anon_order RPC only.
--   ISSUE 2: Tighten restaurants UPDATE (waiter/kitchen lose update entirely;
--            slug/name/logo already owner-only via trg_restaurants_protect_identity).
--   ISSUE 3: Drop unrestricted anon INSERT on activity_log.
--            Anon order activity is now logged server-side inside create_anon_order.
--
-- Idempotent. Safe to re-run. Run AFTER security-milestone1.sql + anon-order-rpc.sql.

-- ═══════════════════════════════════════════════════════════════════
-- ISSUE 1: Remove direct anon INSERT policies on orders / order_items
-- ═══════════════════════════════════════════════════════════════════
-- The secure path is create_anon_order() (SECURITY DEFINER, bypasses RLS).
-- Waiter/staff inserts use the authenticated role — unaffected.

drop policy if exists orders_anon_insert on public.orders;
drop policy if exists order_items_anon_insert on public.order_items;

-- Also drop the overly-permissive anon SELECTs if they still exist
-- (track_order RPC is the secure read path for customers).
drop policy if exists orders_anon_select on public.orders;
drop policy if exists order_items_anon_select on public.order_items;

-- ═══════════════════════════════════════════════════════════════════
-- ISSUE 2: Tighten restaurants UPDATE to owner/manager/super_admin
-- (slug/name/logo remain owner-only via the protect_identity trigger)
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists restaurants_update on public.restaurants;
create policy restaurants_update on public.restaurants
  for update
  to authenticated
  using (
    public.am_super_admin()
    or (
      id = public.my_restaurant_id()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.restaurant_id = public.my_restaurant_id()
          and p.role in ('owner', 'manager')
      )
    )
  )
  with check (
    public.am_super_admin()
    or (
      id = public.my_restaurant_id()
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.restaurant_id = public.my_restaurant_id()
          and p.role in ('owner', 'manager')
      )
    )
  );

-- ═══════════════════════════════════════════════════════════════════
-- ISSUE 3: Drop unrestricted anon INSERT on activity_log.
-- Anon order events are logged server-side inside create_anon_order.
-- ═══════════════════════════════════════════════════════════════════
drop policy if exists activity_log_anon_insert on public.activity_log;
revoke insert on public.activity_log from anon;

-- Server-side activity logging for anon orders.
-- The existing create_anon_order() (from anon-order-rpc.sql) is left untouched.
-- We add an AFTER INSERT trigger on orders that logs anon-created orders
-- server-side. The trigger function is SECURITY DEFINER so it bypasses RLS —
-- no anon policy on activity_log is needed.
drop trigger if exists trg_log_anon_order_created on public.orders;
create or replace function public.log_anon_order_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only for anon-created orders (no waiter_id, created via QR flow).
  -- Authenticated staff orders are logged client-side via logActivity().
  if NEW.waiter_id is null then
    insert into public.activity_log (
      restaurant_id, actor_id, action, entity_type, entity_id, details
    ) values (
      NEW.restaurant_id,
      null,
      'order_created',
      'order',
      NEW.id::text,
      jsonb_build_object(
        'total', NEW.total_amount,
        'table_id', NEW.table_id,
        'source', 'qr_anon'
      )
    );
  end if;
  return NEW;
exception
  when others then
    -- Logging must never break order creation.
    return NEW;
end;
$$;

create trigger trg_log_anon_order_created
  after insert on public.orders
  for each row execute function public.log_anon_order_created();

-- ═══════════════════════════════════════════════════════════════════
-- Verification queries (run these manually after the migration)
-- ═══════════════════════════════════════════════════════════════════
-- 1. anon direct INSERT into orders → must FAIL (RLS deny):
--    (run as anon key)
--    insert into orders (restaurant_id, table_id, status) values ('<uuid>','<uuid>','pending');
--    → expected: new row violates row-level security policy
--
-- 2. anon direct INSERT into order_items → must FAIL:
--    insert into order_items (order_id, menu_item_id, quantity, unit_price)
--    values ('<uuid>','<uuid>',1,99999);
--    → expected: new row violates row-level security policy
--
-- 3. anon INSERT into activity_log → must FAIL:
--    insert into activity_log (restaurant_id, action) values ('<uuid>','spam');
--    → expected: new row violates row-level security policy
--
-- 4. manager UPDATE restaurants.slug → must FAIL (trigger):
--    (as manager) update restaurants set slug='hacked' where id='<own>';
--    → expected: Only the restaurant owner can change name, slug or logo.
--
-- 5. owner UPDATE restaurants.slug → must SUCCEED:
--    (as owner) update restaurants set slug='my-new-slug' where id='<own>';
--    → expected: 1 row updated (remember to change it back!)
--
-- 6. create_anon_order RPC → must SUCCEED (as anon):
--    select create_anon_order('<rest>','<table>',
--      '[{"menu_item_id":"<item>","quantity":1}]'::jsonb, gen_random_uuid());
--    → expected: jsonb with order_id + total_amount from DB prices
--
-- 7. waiter order creation → must SUCCEED (as authenticated waiter):
--    insert into orders (restaurant_id, table_id, waiter_id, status)
--    values ('<own_rest>','<own_table>','<own_uid>','pending');
--    → expected: 1 row inserted
