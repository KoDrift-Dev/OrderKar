-- ============================================================================
-- OrderKar — tenant guard on order inserts.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Even though order inserts are anon-accessible (customer QR flow), the
-- table_id on a new order must belong to the same restaurant. This trigger
-- rejects cross-tenant inserts at the database level, so a crafted request
-- cannot attach an order to another restaurant's table.
-- ============================================================================

create or replace function public.orders_tenant_guard()
returns trigger
language plpgsql
security definer
as $$
declare
  v_rest uuid;
begin
  if NEW.table_id is not null then
    select t.restaurant_id into v_rest
      from public.tables t
     where t.id = NEW.table_id;
    if not found or v_rest is distinct from NEW.restaurant_id then
      raise exception 'table does not belong to this restaurant';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_orders_tenant_guard on public.orders;
create trigger trg_orders_tenant_guard
  before insert on public.orders
  for each row execute function public.orders_tenant_guard();
