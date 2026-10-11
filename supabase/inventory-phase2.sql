-- ============================================================================
-- OrderKar — inventory phase 2: suppliers, purchase orders, expiry tracking.
--
-- Run in the Supabase SQL editor (after schema.sql). Safe to re-run
-- (IF NOT EXISTS / duplicate_object guards throughout).
--
-- Adds:
--   1. public.suppliers          — supplier directory per restaurant
--   2. public.purchase_orders    — purchase orders sent to suppliers
--   3. inventory_items.expiry_date (date, nullable)
--   4. Real FK for the previously dangling inventory_items.supplier_id
-- ============================================================================

-- 1. Suppliers ----------------------------------------------------------------
create table if not exists public.suppliers (
  id            uuid        primary key default gen_random_uuid(),
  restaurant_id uuid       not null references public.restaurants(id) on delete cascade,
  name          text        not null,
  phone         text,
  email         text,
  address       text,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists idx_suppliers_restaurant
  on public.suppliers (restaurant_id);

alter table public.suppliers enable row level security;

drop policy if exists suppliers_tenant on public.suppliers;
create policy suppliers_tenant on public.suppliers
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );

grant all on public.suppliers to authenticated;

-- 2. Purchase orders ------------------------------------------------------------
create table if not exists public.purchase_orders (
  id            uuid         primary key default gen_random_uuid(),
  restaurant_id uuid        not null references public.restaurants(id) on delete cascade,
  supplier_id   uuid        references public.suppliers(id) on delete set null,
  status        text         not null default 'draft'
                    check (status in ('draft', 'pending', 'received', 'cancelled')),
  items         jsonb        not null default '[]',
  -- items: [{ inventory_item_id, item_name, quantity, unit_cost }]
  total_amount  numeric(10,2) not null default 0,
  notes         text,
  created_by    uuid         references public.profiles(id) on delete set null,
  created_at    timestamptz  not null default now(),
  received_at   timestamptz
);

create index if not exists idx_purchase_orders_restaurant
  on public.purchase_orders (restaurant_id, created_at desc);

alter table public.purchase_orders enable row level security;

drop policy if exists purchase_orders_tenant on public.purchase_orders;
create policy purchase_orders_tenant on public.purchase_orders
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );

grant all on public.purchase_orders to authenticated;

-- 3. Expiry date on inventory items ----------------------------------------------
alter table public.inventory_items
  add column if not exists expiry_date date;

-- 4. Give the dangling inventory_items.supplier_id a real foreign key ----------
do $$
begin
  alter table public.inventory_items
    add constraint fk_inventory_supplier
    foreign key (supplier_id) references public.suppliers(id) on delete set null;
exception
  when duplicate_object then null;
end
$$;
