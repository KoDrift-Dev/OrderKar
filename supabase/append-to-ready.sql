-- Allow appending items to READY orders (e.g. customer adds more while
-- waiting for pickup). New items revert the order to PREPARING so the
-- kitchen sees them as unready/new.
--
-- Run in Supabase SQL editor. Safe to re-run.

create or replace function public.append_order_items(p_order_id uuid, p_items jsonb, p_notes text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_total   numeric := 0;
  v_status  text;
  v_locked  boolean;
  v_rest    uuid;
  it        jsonb;
  v_mid     uuid;
  v_qty     int;
  v_price   numeric;
begin
  select o.status, o.ready_for_bill, o.restaurant_id
    into v_status, v_locked, v_rest
    from public.orders o
   where o.id = p_order_id;

  if not found then
    raise exception 'order not found';
  end if;
  -- Allow pending, preparing AND ready (new items revert ready → preparing).
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
      select mi.price into v_price
        from public.menu_items mi
       where mi.id = v_mid
         and mi.restaurant_id = v_rest
         and mi.is_available;
      if not found then
        raise exception 'menu item not found or unavailable';
      end if;
    else
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
         notes = case
           when p_notes is null or btrim(p_notes) = '' then notes
           when notes is null or btrim(notes) = '' then btrim(p_notes)
           else notes || ' | ' || btrim(p_notes)
         end
   where id = p_order_id;

  return jsonb_build_object('added_total', v_total);
end;
$$;
