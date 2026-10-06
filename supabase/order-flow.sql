-- ============================================================================
-- OrderKar — one-open-order-per-table + append-items flow.
-- Run AFTER schema.sql (and ideally security-fixes.sql) in the Supabase SQL
-- editor. Safe to re-run. Self-contained: also ensures tracking_token exists.
-- ============================================================================

-- 1. Columns ---------------------------------------------------------------
alter table public.orders
  add column if not exists tracking_token uuid not null default gen_random_uuid();

alter table public.orders
  add column if not exists ready_for_bill boolean not null default false;

alter table public.order_items
  add column if not exists created_at timestamptz not null default now();

-- 2. track_order(): customer tracker via unguessable token.
--    Returns the open-order signal the apps need (status, total, locked?).
-- ----------------------------------------------------------------------------
create or replace function public.track_order(p_token uuid)
returns jsonb
language sql
security definer
stable
as $$
  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'total_amount', o.total_amount,
    'ready_for_bill', o.ready_for_bill,
    'created_at', o.created_at,
    'table_number', t.table_number,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_name', oi.item_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'notes', oi.notes
      ) order by oi.item_name)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  left join public.tables t on t.id = o.table_id
  where o.tracking_token = p_token
  limit 1;
$$;

grant execute on function public.track_order(uuid) to anon;
grant execute on function public.track_order(uuid) to authenticated;

-- 3. append_order_items(): add lines to an OPEN order (one active order per
--    table). Atomic: inserts items + bumps total + touches updated_at.
--    Rejects when the order is not open (completed/cancelled/ready) or is
--    locked for billing. Works for anon (customer) and staff alike — the
--    order id is an unguessable uuid the caller already knows.
-- ----------------------------------------------------------------------------
create or replace function public.append_order_items(p_order_id uuid, p_items jsonb, p_notes text default null)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_total   numeric := 0;
  v_status  text;
  v_locked  boolean;
  it        jsonb;
begin
  select o.status, o.ready_for_bill
    into v_status, v_locked
    from public.orders o
   where o.id = p_order_id;

  if not found then
    raise exception 'order not found';
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
    insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price, notes)
    values (
      p_order_id,
      nullif(it->>'menu_item_id', '')::uuid,
      it->>'item_name',
      greatest(1, (it->>'quantity')::int),
      (it->>'unit_price')::numeric,
      nullif(it->>'notes', '')
    );
    v_total := v_total + greatest(1, (it->>'quantity')::int) * (it->>'unit_price')::numeric;
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

grant execute on function public.append_order_items(uuid, jsonb, text) to anon;
grant execute on function public.append_order_items(uuid, jsonb, text) to authenticated;
