-- ============================================================================
-- OrderKar SaaS — production multi-tenant PostgreSQL schema (Supabase)
--
-- HOW TO USE:
--   1. Create a Supabase project (free tier is fine to start).
--   2. Open the Supabase SQL editor and run THIS file.
--   3. Then run seed.sql (demo restaurants + menus).
--   4. Create auth users in Dashboard > Authentication, then insert matching
--      profiles rows (template in seed.sql / README).
--   5. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in
--      .env.local (never commit real keys).
--
-- The file is IDEMPOTENT: `create table if not exists`, `drop policy if
-- exists` before every `create policy`, `create or replace` for functions —
-- safe to re-run.
--
-- TENANCY MODEL: shared database + Row-Level Security. Every tenant table
-- carries `restaurant_id`; RLS policies isolate tenants at the database
-- level (not in app code). The service_role key bypasses RLS automatically.
-- ============================================================================

-- (Helper functions are defined after the tables, just before the RLS
-- section, because Postgres resolves table references in SQL-language
-- function bodies at creation time.)

-- ── Restaurants (tenants) ───────────────────────────────────────────────────

create table if not exists restaurants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  logo_url          text,
  theme_config      jsonb not null default '{}'::jsonb,
  subscription_tier text not null default 'starter'
                    check (subscription_tier in ('starter', 'pro', 'enterprise')),
  created_at        timestamptz not null default now()
);

-- ── Profiles (one per auth user; carries role + tenant) ─────────────────────

create table if not exists profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  restaurant_id  uuid references restaurants (id) on delete cascade,
  role           text not null
                 check (role in ('super_admin', 'owner', 'manager', 'waiter', 'kitchen')),
  is_super_admin boolean not null default false,
  name           text not null,
  phone          text,
  address        text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);
-- NOTE: super_admin rows have restaurant_id NULL (platform scope).
alter table public.profiles add column if not exists address text;

-- ── Menu ────────────────────────────────────────────────────────────────────

create table if not exists menu_categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name          text not null,
  description   text,
  image_url     text,
  display_order int  not null default 0,
  is_active     boolean not null default true
);

create table if not exists menu_items (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references restaurants (id) on delete cascade,
  category_id       uuid not null references menu_categories (id) on delete cascade,
  name              text not null,
  description       text,
  price             numeric(10, 2) not null check (price >= 0),
  ingredients       text,
  image_url         text,
  is_available      boolean not null default true,
  prep_time_minutes int not null default 10,
  tags              text[] not null default '{}'
);

-- ── Tables / floor ──────────────────────────────────────────────────────────

create table if not exists tables (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  table_number  int  not null,
  qr_code       text not null,
  capacity      int  not null default 4,
  floor_section text not null default 'indoor',
  is_active     boolean not null default true,
  unique (restaurant_id, table_number)
);

-- ── Orders ──────────────────────────────────────────────────────────────────

create sequence if not exists order_number_seq;

create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   int  not null default nextval('order_number_seq'),
  restaurant_id  uuid not null references restaurants (id) on delete cascade,
  table_id       uuid references tables (id) on delete set null,
  waiter_id      uuid references profiles (id) on delete set null,
  order_type     text not null default 'dine_in'
                 check (order_type in ('dine_in', 'takeaway', 'delivery')),
  status         text not null default 'pending'
                 check (status in ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  total_amount   numeric(10, 2) not null default 0,
  payment_status text not null default 'unpaid'
                 check (payment_status in ('unpaid', 'paid', 'refunded')),
  payment_method text check (payment_method in ('cash', 'card', 'jazzcash', 'easypaisa')),
  customer_name  text,
  customer_phone text,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders (id) on delete cascade,
  menu_item_id uuid references menu_items (id) on delete set null,
  item_name    text not null,
  quantity     int  not null check (quantity > 0),
  unit_price   numeric(10, 2) not null,
  notes        text,
  status       text not null default 'pending'
               check (status in ('pending', 'preparing', 'ready'))
);

-- ── Inventory & recipes ─────────────────────────────────────────────────────

create table if not exists inventory_items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name          text not null,
  category      text,
  unit          text not null default 'pcs',
  current_stock numeric(12, 2) not null default 0,
  par_level     numeric(12, 2) not null default 0,
  supplier_id   uuid,
  cost_per_unit numeric(10, 2) not null default 0
);

create table if not exists recipes (
  id                uuid primary key default gen_random_uuid(),
  restaurant_id     uuid not null references restaurants (id) on delete cascade,
  menu_item_id      uuid not null references menu_items (id) on delete cascade,
  ingredient_id     uuid not null references inventory_items (id) on delete cascade,
  quantity_required numeric(12, 2) not null,
  unit              text not null default 'pcs'
);

create table if not exists waste_logs (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants (id) on delete cascade,
  inventory_item_id uuid references inventory_items (id) on delete set null,
  menu_item_id   uuid references menu_items (id) on delete set null,
  item_name      text not null,
  quantity       numeric(12, 2) not null,
  reason         text not null check (reason in ('spoilage', 'theft', 'overprep', 'damaged', 'other')),
  logged_by      uuid references profiles (id) on delete set null,
  estimated_cost numeric(10, 2) not null default 0,
  logged_at      timestamptz not null default now()
);

-- ── Reviews ─────────────────────────────────────────────────────────────────

create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  order_id      uuid references orders (id) on delete set null,
  rating        int  not null check (rating between 1 and 5),
  comment       text,
  customer_name text,
  customer_phone text,
  created_at    timestamptz not null default now()
);

-- ── Subscriptions / billing ─────────────────────────────────────────────────

create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  plan_type     text not null check (plan_type in ('starter', 'pro', 'enterprise')),
  status        text not null default 'active'
                check (status in ('trial', 'active', 'cancelled', 'past_due')),
  start_date    date not null default current_date,
  end_date      date,
  amount        numeric(10, 2) not null default 0
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_profiles_restaurant on profiles (restaurant_id);
create index if not exists idx_menu_categories_restaurant on menu_categories (restaurant_id);
create index if not exists idx_menu_items_restaurant on menu_items (restaurant_id);
create index if not exists idx_menu_items_category on menu_items (category_id);
create index if not exists idx_tables_restaurant on tables (restaurant_id);
create index if not exists idx_orders_restaurant on orders (restaurant_id);
create index if not exists idx_orders_restaurant_created on orders (restaurant_id, created_at desc);
create index if not exists idx_orders_status on orders (restaurant_id, status);
create index if not exists idx_order_items_order on order_items (order_id);
create index if not exists idx_inventory_restaurant on inventory_items (restaurant_id);
create index if not exists idx_recipes_restaurant on recipes (restaurant_id);
create index if not exists idx_waste_restaurant on waste_logs (restaurant_id, logged_at desc);
create index if not exists idx_reviews_restaurant on reviews (restaurant_id, created_at desc);
create index if not exists idx_subscriptions_restaurant on subscriptions (restaurant_id);

-- ── updated_at trigger ──────────────────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_touch on orders;
create trigger trg_orders_touch
  before update on orders
  for each row execute function touch_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- HELPERS (defined here — after all tables exist)
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER so RLS policies never recurse into profiles.

create or replace function public.my_restaurant_id()
returns uuid
language sql
security definer
stable
as $$
  select restaurant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.am_super_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(is_super_admin, false) from public.profiles where id = auth.uid()
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════

alter table restaurants      enable row level security;
alter table profiles         enable row level security;
alter table menu_categories  enable row level security;
alter table menu_items       enable row level security;
alter table tables           enable row level security;
alter table orders           enable row level security;
alter table order_items      enable row level security;
alter table inventory_items  enable row level security;
alter table recipes          enable row level security;
alter table waste_logs       enable row level security;
alter table reviews          enable row level security;
alter table subscriptions    enable row level security;

-- ── restaurants ─────────────────────────────────────────────────────────────
-- Public read (customers resolve a restaurant by slug via QR). Staff manage
-- their own restaurant; signup flow lets an authenticated user create one.

drop policy if exists restaurants_select on restaurants;
create policy restaurants_select on restaurants
  for select using (true);

drop policy if exists restaurants_insert on restaurants;
create policy restaurants_insert on restaurants
  for insert to authenticated with check (true);

drop policy if exists restaurants_update on restaurants;
create policy restaurants_update on restaurants
  for update using (
    id = public.my_restaurant_id() or public.am_super_admin()
  );

-- ── profiles ────────────────────────────────────────────────────────────────

drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select using (
    auth.uid() = id
    or restaurant_id = public.my_restaurant_id()
    or public.am_super_admin()
  );

drop policy if exists profiles_insert_own on profiles;
create policy profiles_insert_own on profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update using (
    auth.uid() = id or public.am_super_admin()
  );

-- ── tenant tables: staff get full access within their restaurant ────────────
-- (super_admin sees everything; anon/customer access is granted per-table
-- below where the QR ordering flow needs it).

-- menu_categories
drop policy if exists menu_categories_tenant on menu_categories;
create policy menu_categories_tenant on menu_categories
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );
drop policy if exists menu_categories_public_read on menu_categories;
create policy menu_categories_public_read on menu_categories
  for select to anon using (true);

-- menu_items
drop policy if exists menu_items_tenant on menu_items;
create policy menu_items_tenant on menu_items
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );
drop policy if exists menu_items_public_read on menu_items;
create policy menu_items_public_read on menu_items
  for select to anon using (true);

-- tables
drop policy if exists tables_tenant on tables;
create policy tables_tenant on tables
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );
drop policy if exists tables_public_read on tables;
create policy tables_public_read on tables
  for select to anon using (true);

-- orders: staff full tenant access; anon (QR customers) can place orders and
-- track the status of orders (needed for the live tracker + realtime).
drop policy if exists orders_tenant on orders;
create policy orders_tenant on orders
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );
drop policy if exists orders_anon_insert on orders;
create policy orders_anon_insert on orders
  for insert to anon with check (true);
drop policy if exists orders_anon_select on orders;
create policy orders_anon_select on orders
  for select to anon using (true);

-- order_items: same shape as orders.
drop policy if exists order_items_tenant on order_items;
create policy order_items_tenant on order_items
  for all using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.restaurant_id = public.my_restaurant_id() or public.am_super_admin())
    )
  );
drop policy if exists order_items_anon_insert on order_items;
create policy order_items_anon_insert on order_items
  for insert to anon with check (true);
drop policy if exists order_items_anon_select on order_items;
create policy order_items_anon_select on order_items
  for select to anon using (true);

-- inventory_items / recipes / waste_logs: staff only.
drop policy if exists inventory_items_tenant on inventory_items;
create policy inventory_items_tenant on inventory_items
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );

drop policy if exists recipes_tenant on recipes;
create policy recipes_tenant on recipes
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );

drop policy if exists waste_logs_tenant on waste_logs;
create policy waste_logs_tenant on waste_logs
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );

-- reviews: staff full tenant access; anon can submit + read (public feedback).
drop policy if exists reviews_tenant on reviews;
create policy reviews_tenant on reviews
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );
drop policy if exists reviews_anon_insert on reviews;
create policy reviews_anon_insert on reviews
  for insert to anon with check (true);
drop policy if exists reviews_anon_select on reviews;
create policy reviews_anon_select on reviews
  for select to anon using (true);

-- subscriptions: staff of that restaurant (owner views own plan).
drop policy if exists subscriptions_tenant on subscriptions;
create policy subscriptions_tenant on subscriptions
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );

-- ── Table privileges for anon / authenticated ──────────────────────────
-- RLS policies alone are not enough: Postgres checks table-level GRANTs
-- before RLS. Without these, every anon/authenticated query fails with
-- 42501 "permission denied". (anon = public customer app, authenticated =
-- logged-in staff; RLS policies still scope every row.)

-- anon: read the public catalog, place + track orders, submit reviews
grant select on public.restaurants to anon;
grant select on public.menu_categories to anon;
grant select on public.menu_items to anon;
grant select on public.tables to anon;
grant select, insert on public.orders to anon;
grant select, insert on public.order_items to anon;
grant select, insert on public.reviews to anon;

-- authenticated staff: RLS policies scope all rows, so grant all actions
grant all on public.restaurants to authenticated;
grant all on public.profiles to authenticated;
grant all on public.menu_categories to authenticated;
grant all on public.menu_items to authenticated;
grant all on public.tables to authenticated;
grant all on public.orders to authenticated;
grant all on public.order_items to authenticated;
grant all on public.inventory_items to authenticated;
grant all on public.recipes to authenticated;
grant all on public.waste_logs to authenticated;
grant all on public.reviews to authenticated;
grant all on public.subscriptions to authenticated;

-- sequences: anon + authenticated need USAGE to call nextval() (order numbers)
grant usage, select on sequence public.order_number_seq to anon;
grant usage, select on sequence public.order_number_seq to authenticated;

-- keep the same grants for tables created in the future
alter default privileges in schema public grant select, insert on tables to anon;
alter default privileges in schema public grant all on tables to authenticated;

-- ── Supabase Storage: menu item photos ───────────────────────────────────
-- Public bucket; staff upload only into their own restaurant's folder.

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

drop policy if exists "menu-images public read" on storage.objects;
create policy "menu-images public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'menu-images');

drop policy if exists "menu-images staff insert" on storage.objects;
create policy "menu-images staff insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and ((storage.foldername(name))[1] = public.my_restaurant_id()::text or public.am_super_admin())
  );

drop policy if exists "menu-images staff update" on storage.objects;
create policy "menu-images staff update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'menu-images'
    and ((storage.foldername(name))[1] = public.my_restaurant_id()::text or public.am_super_admin())
  );

drop policy if exists "menu-images staff delete" on storage.objects;
create policy "menu-images staff delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and ((storage.foldername(name))[1] = public.my_restaurant_id()::text or public.am_super_admin())
  );
