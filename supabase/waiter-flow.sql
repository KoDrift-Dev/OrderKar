-- ============================================================================
-- OrderKar — waiter flow fixes (pickup tracking + append to ready orders).
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- WHAT THIS DOES:
-- 1. Adds orders.picked_up_at (waiter took food from kitchen; table stays
--    occupied until payment).
-- 2. Replaces append_order_items with the HARDENED version (tracking-token /
--    staff authorization, server-side pricing, billing lock) PLUS support for
--    appending items to READY orders (they revert to PREPARING so the kitchen
--    sees the new items).
--
-- This REPLACES the insecure supabase/append-to-ready.sql — do NOT run that
-- file, it would remove the authorization checks.
-- ============================================================================

-- 1. Pickup tracking column.
alter table public.orders
  add column if not exists picked_up_at timestamptz;

-- 2. Hardened append_order_items that also accepts READY orders.
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

  -- Allow pending, preparing AND ready (new items revert ready → preparing
  -- so the kitchen sees them as new/unready).
  if v_status not in ('pending', 'preparing', 'ready') then
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
         -- New items on a ready order send it back to the kitchen.
         status = case when status = 'ready' then 'preparing' else status end,
         -- Picking up again is allowed after new items: clear the pickup flag
         -- so the kitchen sees the reverted order until re-picked.
         picked_up_at = case when status = 'ready' then null else picked_up_at end,
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

-- Verification: run these after the migration.
-- select column_name from information_schema.columns
--  where table_name = 'orders' and column_name = 'picked_up_at';
-- → must return 1 row.
