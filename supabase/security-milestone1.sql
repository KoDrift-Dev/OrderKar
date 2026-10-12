-- ============================================================================
-- OrderKar — Milestone 1 security fixes.
--
-- Implements (database-level):
--   FIX 1 (S1)  Tenant takeover via signup          → profiles_signup_claim_guard
--   FIX 3 (S3)  Subscription paywall bypass          → split subscriptions RLS
--   FIX 4 (S4)  Restaurant slug/name protection     → restaurants_protect_identity
--   FIX 5 (S5)  append_order_items authorization     → p_tracking_token param
--   FIX 8 (S9)  stripe_webhook_apply least privilege→ REVOKE from anon/authenticated
--   FIX 9 (S10) orders_tenant_guard NULL table_id    → always validate tenant
--
-- Run in the Supabase SQL editor AFTER: schema.sql, security-fixes.sql,
-- order-flow.sql, order-guard.sql, subscription-billing.sql.
-- Safe to re-run (idempotent: drop-if-exists / create-or-replace only).
--
-- ⚠ ORDERING NOTE: supabase/order-flow.sql defines the OLD 3-arg
-- append_order_items(uuid, jsonb, text). If order-flow.sql is re-run AFTER
-- this file, it will recreate the vulnerable 3-arg overload. Always re-run
-- THIS file last, or update order-flow.sql to the 4-arg signature.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- FIX 1 (S1) — Tenant takeover via signup
--
-- The profiles_role_guard INSERT "signup branch" only checked NEW.role =
-- 'owner' and never validated NEW.restaurant_id, so any new user could insert
-- an owner profile for ANY existing restaurant (restaurants are publicly
-- listable, so IDs are enumerable).
--
-- This trigger closes the hole at the database level: a brand-new signup
-- (actor inserts their OWN profile, no profile row exists yet) may only
-- claim owner of a restaurant that was created within the last 30 minutes
-- AND has no other profiles yet — i.e. the restaurant the signup flow just
-- created. Claiming ownership of any pre-existing restaurant raises.
--
-- Not affected:
--   • service_role / SQL editor (auth.uid() is null) — trusted admin path
--   • super_admin inserting owner profiles (e.g. onboarding via /admin)
--   • an owner adding staff/co-owners (NEW.id <> auth.uid())
--
-- TEST (SQL): as a fresh authenticated user, insert into profiles with
-- role='owner' and the restaurant_id of an existing restaurant that already
-- has profiles → must raise 'Cannot claim ownership of an existing
-- restaurant.'
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.profiles_signup_claim_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created timestamptz;
  v_claimed boolean;
  v_super   boolean;
begin
  -- Trusted admin path (service_role / SQL editor): no JWT, no guard.
  if auth.uid() is null then
    return NEW;
  end if;

  -- Only the fresh-signup path: the actor inserts their OWN profile and has
  -- no profile row yet. (Owner-added staff have NEW.id <> auth.uid().)
  if NEW.id = auth.uid() and NEW.role = 'owner' then
    if exists (select 1 from public.profiles p where p.id = NEW.id) then
      return NEW; -- not a fresh signup; profiles_role_guard handles the rest
    end if;

    -- Super-admins may onboard owners for existing restaurants.
    select coalesce(p.is_super_admin, false) into v_super
      from public.profiles p where p.id = auth.uid();
    if coalesce(v_super, false) then
      return NEW;
    end if;

    select r.created_at into v_created
      from public.restaurants r where r.id = NEW.restaurant_id;
    select exists (
      select 1 from public.profiles p
       where p.restaurant_id = NEW.restaurant_id
    ) into v_claimed;

    if v_created is null
       or v_created < now() - interval '30 minutes'
       or coalesce(v_claimed, false) then
      raise exception 'Cannot claim ownership of an existing restaurant.';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_profiles_signup_claim_guard on public.profiles;
create trigger trg_profiles_signup_claim_guard
  before insert on public.profiles
  for each row execute function public.profiles_signup_claim_guard();


-- ──────────────────────────────────────────────────────────────────────────
-- FIX 3 (S3) — Subscription paywall bypass
--
-- subscriptions previously had a single FOR ALL tenant-only policy, so any
-- staff role (waiter/kitchen/manager) could UPDATE their restaurant's
-- subscription to 'active'/'enterprise' — the console lock was client-side
-- only. Now: members can READ their own subscription; only the restaurant
-- owner or a super_admin can INSERT/UPDATE/DELETE it. The Stripe webhook
-- path (SECURITY DEFINER stripe_webhook_apply) bypasses RLS and is unaffected.
--
-- NOTE: app/api/billing/checkout currently permits MANAGER to start checkout.
-- A manager hitting the first-time subscription INSERT will now get an RLS
-- denial. Either gate that route to owner-only or keep manager out of the
-- insert path — product decision, flagged here deliberately.
--
-- TEST (SQL): as a waiter/manager of a restaurant,
--   update subscriptions set status='active' where restaurant_id=<own>
-- → must raise "new row violates row-level security policy".
-- ──────────────────────────────────────────────────────────────────────────
drop policy if exists subscriptions_tenant on public.subscriptions;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (
    restaurant_id = public.my_restaurant_id()
    or public.am_super_admin()
  );

drop policy if exists subscriptions_insert_owner on public.subscriptions;
create policy subscriptions_insert_owner on public.subscriptions
  for insert with check (
    public.am_super_admin()
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.restaurant_id = subscriptions.restaurant_id
         and p.role = 'owner'
    )
  );

drop policy if exists subscriptions_update_owner on public.subscriptions;
create policy subscriptions_update_owner on public.subscriptions
  for update
  using (
    public.am_super_admin()
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.restaurant_id = subscriptions.restaurant_id
         and p.role = 'owner'
    )
  )
  with check (
    public.am_super_admin()
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.restaurant_id = subscriptions.restaurant_id
         and p.role = 'owner'
    )
  );

drop policy if exists subscriptions_delete_owner on public.subscriptions;
create policy subscriptions_delete_owner on public.subscriptions
  for delete using (
    public.am_super_admin()
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.restaurant_id = subscriptions.restaurant_id
         and p.role = 'owner'
    )
  );


-- ──────────────────────────────────────────────────────────────────────────
-- FIX 4 (S4) — Restaurant slug/name/logo protection
--
-- The restaurants UPDATE policy allowed ANY staff role of the tenant to
-- update the row — a waiter could change `slug` (breaking every printed QR
-- code), `name`, or `logo_url`. Postgres RLS has no column-level policies,
-- so this BEFORE UPDATE trigger blocks identity-column changes unless the
-- actor is the restaurant's owner or a super_admin. Managers keep the
-- ability to update operational columns (theme_config, etc.).
--
-- TEST (SQL): as a waiter/manager,
--   update restaurants set slug='pwned' where id=<own restaurant>
-- → must raise 'Only the restaurant owner can change name, slug or logo.'
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.restaurants_protect_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
  v_super    boolean;
begin
  if NEW.slug     is distinct from OLD.slug
     or NEW.name     is distinct from OLD.name
     or NEW.logo_url is distinct from OLD.logo_url then

    -- Trusted admin path (service_role / SQL editor).
    if auth.uid() is null then
      return NEW;
    end if;

    select coalesce(p.is_super_admin, false) into v_super
      from public.profiles p where p.id = auth.uid();
    select exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.restaurant_id = OLD.id
         and p.role = 'owner'
    ) into v_is_owner;

    if not coalesce(v_super, false) and not coalesce(v_is_owner, false) then
      raise exception 'Only the restaurant owner can change name, slug or logo.';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_restaurants_protect_identity on public.restaurants;
create trigger trg_restaurants_protect_identity
  before update on public.restaurants
  for each row execute function public.restaurants_protect_identity();


-- ──────────────────────────────────────────────────────────────────────────
-- FIX 5 (S5) — append_order_items authorization
--
-- The old 3-arg function authorized purely by order-UUID knowledge, and
-- track_order() discloses UUIDs, so a leaked UUID let anyone inject line
-- items into a live order. New 4-arg signature requires EITHER the order's
-- tracking_token (customer flow — the client already holds it) OR an
-- authenticated staff session belonging to the same restaurant.
--
-- ⚠ CALLER UPDATE REQUIRED: components/MenuOrder.tsx (~line 423) calls
--   supabase.rpc('append_order_items', { p_order_id, p_items, p_notes })
-- must now also pass:  p_tracking_token: openOrder.token
-- No other callers exist in the codebase (verified by grep).
--
-- The old 3-arg overload is dropped so it cannot be called anymore.
--
-- TEST (SQL / RPC): call append_order_items with a valid order id but a
-- wrong/NULL tracking token and no staff session → must raise
-- 'authorization required'. With the correct token → succeeds.
-- ──────────────────────────────────────────────────────────────────────────
drop function if exists public.append_order_items(uuid, jsonb, text);

create or replace function public.append_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_tracking_token uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total      numeric := 0;
  v_status     text;
  v_locked     boolean;
  v_rest       uuid;
  v_token      uuid;
  v_staff_rest uuid;
  it           jsonb;
  v_mid        uuid;
  v_qty        int;
  v_price      numeric;
begin
  select o.status, o.ready_for_bill, o.restaurant_id, o.tracking_token
    into v_status, v_locked, v_rest, v_token
    from public.orders o
   where o.id = p_order_id;

  if not found then
    raise exception 'order not found';
  end if;

  -- Authorization: a bare order UUID is no longer sufficient.
  if p_tracking_token is not null and p_tracking_token = v_token then
    -- Customer proving ownership of their own order via tracking token.
    null;
  elsif auth.uid() is not null then
    -- Authenticated staff must belong to the order's restaurant.
    select p.restaurant_id into v_staff_rest
      from public.profiles p where p.id = auth.uid();
    if v_staff_rest is null or v_staff_rest is distinct from v_rest then
      raise exception 'not authorized to modify this order';
    end if;
  else
    raise exception 'authorization required: provide the order tracking token or sign in as staff';
  end if;

  if v_status not in ('pending', 'preparing') then
    raise exception 'order is no longer open (status: %)', v_status;
  end if;
  if v_locked then
    raise exception 'order is locked for billing';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be a JSON array';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_mid := nullif(it->>'menu_item_id', '')::uuid;
    v_qty := greatest(1, (it->>'quantity')::int);
    if v_mid is not null then
      -- SECURITY: never trust the caller's unit_price for menu items.
      -- Always use the server-side price (same restaurant, available).
      select mi.price into v_price
        from public.menu_items mi
       where mi.id = v_mid
         and mi.restaurant_id = v_rest
         and mi.is_available;
      if not found then
        raise exception 'menu item not found or unavailable';
      end if;
    else
      -- Ad-hoc/custom line items (e.g. POS extras) carry their own price.
      v_price := (it->>'unit_price')::numeric;
      if v_price is null or v_price < 0 then
        raise exception 'unit_price is required for custom items';
      end if;
    end if;

    insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price, notes)
    values (
      p_order_id,
      v_mid,
      it->>'item_name',
      v_qty,
      v_price,
      nullif(it->>'notes', '')
    );
    v_total := v_total + v_qty * v_price;
  end loop;

  update public.orders
     set total_amount = total_amount + v_total,
         updated_at = now(),
         notes = case
           when p_notes is null or btrim(p_notes) = '' then notes
           when notes is null or btrim(notes) = '' then btrim(p_notes)
           else notes || ' | ' || btrim(p_notes)
         end
   where id = p_order_id;

  return jsonb_build_object('added_total', v_total);
end;
$$;

grant execute on function public.append_order_items(uuid, jsonb, text, uuid) to anon;
grant execute on function public.append_order_items(uuid, jsonb, text, uuid) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- FIX 8 (S9) — stripe_webhook_apply least privilege
--
-- The function was granted to anon + authenticated, so anyone holding a
-- stripe_customer_id could cancel/downgrade any restaurant's subscription.
-- Only the server-side webhook route (service_role, bypasses RLS/grants)
-- may execute it now. REVOKE of an already-revoked grant only warns, so
-- this is safe to re-run.
--
-- TEST (SQL): as anon/authenticated, select public.stripe_webhook_apply(...)
-- → must raise "permission denied for function".
-- ──────────────────────────────────────────────────────────────────────────
revoke all on function public.stripe_webhook_apply(text, text, text, text, text, timestamptz, timestamptz, boolean)
  from anon, authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- FIX 9 (S10) — orders_tenant_guard: never skip tenant validation
--
-- The old guard only validated table_id when it was set, so an order with
-- table_id = NULL skipped the tenant check entirely. Now validation ALWAYS
-- runs: with a table_id the table must belong to the order's restaurant;
-- with table_id NULL (e.g. takeaway/POS) the caller must be authenticated
-- staff of that restaurant. Anonymous null-table inserts are rejected.
--
-- The customer QR flow always sets table_id, so it is unaffected.
--
-- TEST (SQL): as anon, insert into orders with table_id = null and a valid
-- restaurant_id → must raise 'table is required for customer orders'.
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.orders_tenant_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rest       uuid;
  v_staff_rest uuid;
begin
  if NEW.table_id is not null then
    select t.restaurant_id into v_rest
      from public.tables t
     where t.id = NEW.table_id;
    if not found or v_rest is distinct from NEW.restaurant_id then
      raise exception 'table does not belong to this restaurant';
    end if;
  else
    -- No table (takeaway / POS): only authenticated staff of the same
    -- restaurant may create such orders. Anonymous callers must supply a
    -- table_id (the QR flow always does).
    if auth.uid() is null then
      raise exception 'table is required for customer orders';
    end if;
    select p.restaurant_id into v_staff_rest
      from public.profiles p where p.id = auth.uid();
    if v_staff_rest is null or v_staff_rest is distinct from NEW.restaurant_id then
      raise exception 'not authorized to create orders for this restaurant';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_orders_tenant_guard on public.orders;
create trigger trg_orders_tenant_guard
  before insert on public.orders
  for each row execute function public.orders_tenant_guard();
