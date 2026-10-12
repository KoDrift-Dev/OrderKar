-- ============================================================================
-- OrderKar — atomic inventory deduction/restock RPCs.
-- Run AFTER schema.sql + inventory-phase2.sql in the Supabase SQL editor.
-- Safe to re-run (create or replace + grants are idempotent).
--
-- PROBLEM (D2): lib/inventory.ts did read-then-write —
--   select current_stock ... then update current_stock = current - applied
-- Two concurrent payments could both read the old value and both write
-- back, losing one deduction (stock drift).
--
-- FIX: all stock movement goes through these SECURITY DEFINER functions,
-- which take a row lock (SELECT ... FOR UPDATE) and then apply the
-- single-statement UPDATE inside the same transaction. Concurrent callers
-- serialize on the row lock, so no deduction is ever lost.
--
-- Both functions:
--   * verify the caller belongs to p_restaurant_id (or is super admin),
--   * verify every item belongs to that restaurant (0 rows -> exception),
--   * never let stock go below 0 (GREATEST), and
--   * return jsonb {"items": [{"inventory_item_id": <uuid>, "moved": <n>}]}
--     so the caller can keep an accurate audit trail.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- deduct_inventory_atomic(p_restaurant_id uuid, p_deductions jsonb)
-- p_deductions: [{"inventory_item_id": uuid, "qty": numeric}, ...]
-- ----------------------------------------------------------------------------
create or replace function public.deduct_inventory_atomic(
  p_restaurant_id uuid,
  p_deductions    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d         jsonb;
  v_item_id uuid;
  v_qty     numeric(12, 2);
  v_old     numeric(12, 2);
  v_applied numeric(12, 2);
  v_out     jsonb := '[]'::jsonb;
begin
  -- Caller must be a member of this restaurant (or super admin).
  if public.my_restaurant_id() is distinct from p_restaurant_id
     and not public.am_super_admin() then
    raise exception 'not authorized for this restaurant';
  end if;

  if p_deductions is null or jsonb_array_length(p_deductions) = 0 then
    return jsonb_build_object('items', v_out);
  end if;

  for d in select * from jsonb_array_elements(p_deductions)
  loop
    v_item_id := nullif(d ->> 'inventory_item_id', '')::uuid;
    v_qty     := (d ->> 'qty')::numeric(12, 2);

    if v_item_id is null then
      raise exception 'inventory_item_id missing in deduction';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'deduction qty must be positive';
    end if;

    -- Row lock + read in one step. Concurrent deductors block here until
    -- this transaction finishes, so the UPDATE below can never lose a
    -- deduction to a stale read.
    select ii.current_stock into v_old
      from public.inventory_items as ii
     where ii.id = v_item_id
       and ii.restaurant_id = p_restaurant_id
     for update;

    if not found then
      raise exception 'Inventory item not found';
    end if;

    v_applied := least(v_old, v_qty); -- clamped: stock never goes below 0

    update public.inventory_items
       set current_stock = greatest(0, current_stock - v_qty)
     where id = v_item_id
       and restaurant_id = p_restaurant_id;

    v_out := v_out || jsonb_build_object(
      'inventory_item_id', v_item_id,
      'moved',             -v_applied
    );
  end loop;

  return jsonb_build_object('items', v_out);
end;
$$;

grant execute on function public.deduct_inventory_atomic(uuid, jsonb) to authenticated;

-- ----------------------------------------------------------------------------
-- restock_inventory_atomic(p_restaurant_id uuid, p_additions jsonb)
-- Same pattern, adds stock — used when receiving purchase orders.
-- p_additions: [{"inventory_item_id": uuid, "qty": numeric}, ...]
-- ----------------------------------------------------------------------------
create or replace function public.restock_inventory_atomic(
  p_restaurant_id uuid,
  p_additions     jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a         jsonb;
  v_item_id uuid;
  v_qty     numeric(12, 2);
  v_old     numeric(12, 2);
  v_out     jsonb := '[]'::jsonb;
begin
  -- Caller must be a member of this restaurant (or super admin).
  if public.my_restaurant_id() is distinct from p_restaurant_id
     and not public.am_super_admin() then
    raise exception 'not authorized for this restaurant';
  end if;

  if p_additions is null or jsonb_array_length(p_additions) = 0 then
    return jsonb_build_object('items', v_out);
  end if;

  for a in select * from jsonb_array_elements(p_additions)
  loop
    v_item_id := nullif(a ->> 'inventory_item_id', '')::uuid;
    v_qty     := (a ->> 'qty')::numeric(12, 2);

    if v_item_id is null then
      raise exception 'inventory_item_id missing in addition';
    end if;
    if v_qty is null or v_qty <= 0 then
      raise exception 'restock qty must be positive';
    end if;

    select ii.current_stock into v_old
      from public.inventory_items as ii
     where ii.id = v_item_id
       and ii.restaurant_id = p_restaurant_id
     for update;

    if not found then
      raise exception 'Inventory item not found';
    end if;

    update public.inventory_items
       set current_stock = current_stock + v_qty
     where id = v_item_id
       and restaurant_id = p_restaurant_id;

    v_out := v_out || jsonb_build_object(
      'inventory_item_id', v_item_id,
      'moved',             v_qty
    );
  end loop;

  return jsonb_build_object('items', v_out);
end;
$$;

grant execute on function public.restock_inventory_atomic(uuid, jsonb) to authenticated;
