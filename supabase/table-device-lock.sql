-- ============================================================================
-- OrderKar — one device per table (customer QR ordering).
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- 1. orders.device_id stores the anonymous customer's stable device id
--    (localStorage 'orderkar:device_id', sent via /api/orders/anon).
-- 2. create_anon_order() gains p_device_id (default null → old callers keep
--    working) and persists it on the order row.
-- 3. check_table_device() lets the QR page ask: "does ANOTHER device already
--    have an active order on this table?" Active = pending/preparing/ready
--    and not yet ready_for_bill. SECURITY DEFINER so anon QR customers can
--    call it; it reveals only a boolean, never other customers' data.
-- ============================================================================

alter table public.orders add column if not exists device_id text;

-- Replace the 6-arg signature with the 7-arg one (defaults keep old
-- callers working, but the old signature object is dropped explicitly).
drop function if exists public.create_anon_order(uuid, uuid, jsonb, uuid, text, text);

create or replace function public.create_anon_order(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_items jsonb,
  p_tracking_token uuid,
  p_customer_name text default null,
  p_notes text default null,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table_ok boolean;
  v_total    numeric(10, 2) := 0;
  v_order_id uuid;
  v_order_no int;
  v_token    uuid := coalesce(p_tracking_token, gen_random_uuid());
  it         jsonb;
  v_mid      uuid;
  v_qty      int;
  v_price    numeric(10, 2);
  v_name     text;
  v_count    int := 0;
begin
  -- Restaurant must exist.
  if not exists (select 1 from public.restaurants where id = p_restaurant_id) then
    raise exception 'restaurant not found';
  end if;

  -- Table must exist AND belong to this restaurant (kills cross-tenant and
  -- made-up table_id injection).
  select exists(
    select 1
      from public.tables
     where id = p_table_id
       and restaurant_id = p_restaurant_id
  ) into v_table_ok;
  if not v_table_ok then
    raise exception 'table not found';
  end if;

  -- Items must be a sane non-empty array.
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be a JSON array';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'order must contain at least one item';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'too many items in one order';
  end if;

  -- Insert the order; totals are filled in after server-side pricing.
  insert into public.orders (
    restaurant_id, table_id, customer_name, status, payment_status,
    total_amount, notes, tracking_token, device_id
  )
  values (
    p_restaurant_id,
    p_table_id,
    nullif(btrim(coalesce(p_customer_name, '')), ''),
    'pending',
    'unpaid',
    0,
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_token,
    nullif(btrim(coalesce(p_device_id, '')), '')
  )
  returning id, order_number into v_order_id, v_order_no;

  for it in select * from jsonb_array_elements(p_items) loop
    v_count := v_count + 1;
    v_mid := nullif(it->>'menu_item_id', '')::uuid;

    -- Quantity: integer, 1..20. Never trust the client value.
    begin
      v_qty := (it->>'quantity')::int;
    exception when others then
      raise exception 'invalid quantity';
    end;
    if v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception 'invalid quantity';
    end if;

    if v_mid is null then
      raise exception 'menu_item_id is required';
    end if;

    -- Price + name + availability ALWAYS come from the DB, scoped to the
    -- same restaurant. Cross-tenant items simply do not match and raise.
    select mi.price, mi.name into v_price, v_name
      from public.menu_items mi
     where mi.id = v_mid
       and mi.restaurant_id = p_restaurant_id
       and mi.is_available;
    if not found then
      raise exception 'menu item not found or unavailable';
    end if;

    insert into public.order_items (
      order_id, menu_item_id, item_name, quantity, unit_price, notes
    )
    values (
      v_order_id,
      v_mid,
      v_name,
      v_qty,
      v_price,
      nullif(btrim(coalesce(it->>'notes', '')), '')
    );
    v_total := v_total + v_qty * v_price;
  end loop;

  update public.orders
     set total_amount = v_total,
         updated_at = now()
   where id = v_order_id;

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_no,
    'tracking_token', v_token,
    'total_amount', v_total,
    'item_count', v_count
  );
end;
$$;

grant execute on function public.create_anon_order(uuid, uuid, jsonb, uuid, text, text, text) to anon;
grant execute on function public.create_anon_order(uuid, uuid, jsonb, uuid, text, text, text) to authenticated;

-- One-device-per-table check: true when a DIFFERENT device already holds an
-- active order on this table. Orders without a device_id (created before
-- this migration) never lock the table.
create or replace function public.check_table_device(p_table_id uuid, p_device_id text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.orders o
     where o.table_id = p_table_id
       and o.status in ('pending', 'preparing', 'ready')
       and coalesce(o.ready_for_bill, false) = false
       and o.device_id is not null
       and o.device_id <> p_device_id
  );
$$;

grant execute on function public.check_table_device(uuid, text) to anon;
grant execute on function public.check_table_device(uuid, text) to authenticated;
