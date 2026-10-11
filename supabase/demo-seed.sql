-- ============================================================================
-- OrderKar — DEMO restaurant seed: "Spice Route" (slug: spice-route)
-- Full data for prospect demos: menu, tables, inventory, suppliers, POs,
-- staff, orders (history + live), reviews, waste, activity.
--
-- STEPS:
--   1. Supabase Dashboard > Authentication > Users > Add user (3 users):
--        orderkardemo@gmail.com / demo@1234   (owner)
--        waiterdemo@gmail.com   / demo@1234   (waiter)
--        kitchendemo@gmail.com  / demo@1234   (kitchen)
--      (tick "Auto Confirm User")
--   2. Run this file in the SQL editor. Re-running wipes + recreates the
--      demo restaurant (auth users are kept).
-- ============================================================================

-- ── 0. Structural safety: make sure Phase-2 tables/columns exist ── ---------
create table if not exists public.suppliers (
  id            uuid        primary key default gen_random_uuid(),
  restaurant_id uuid        not null references public.restaurants(id) on delete cascade,
  name          text        not null,
  phone         text,
  email         text,
  address       text,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id            uuid         primary key default gen_random_uuid(),
  restaurant_id uuid        not null references public.restaurants(id) on delete cascade,
  supplier_id   uuid        references public.suppliers(id) on delete set null,
  status        text         not null default 'draft'
                    check (status in ('draft', 'pending', 'received', 'cancelled')),
  items         jsonb        not null default '[]',
  total_amount  numeric(10,2) not null default 0,
  notes         text,
  created_by    uuid         references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  received_at   timestamptz
);

alter table public.inventory_items add column if not exists expiry_date date;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inventory_items' and column_name = 'supplier_id'
  ) then
    alter table public.inventory_items add column supplier_id uuid;
  end if;
end $$;

alter table public.subscriptions add column if not exists stripe_customer_id text;
alter table public.subscriptions add column if not exists stripe_subscription_id text;
alter table public.subscriptions add column if not exists stripe_price_id text;
alter table public.subscriptions add column if not exists trial_ends_at timestamptz;
alter table public.subscriptions add column if not exists current_period_start timestamptz;
alter table public.subscriptions add column if not exists current_period_end timestamptz;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.orders add column if not exists cancel_reason text;

-- ── 1. Wipe previous demo (cascades everything) ─────────────────────────────
delete from public.restaurants where slug = 'spice-route';

-- ── 2. Main seed ────────────────────────────────────────────────────────────
do $$
declare
  r_id uuid;
  owner_id uuid; waiter_id uuid; kitchen_id uuid;
  cat_desi uuid; cat_chinese uuid; cat_cont uuid; cat_fast uuid;
  cat_bbq uuid; cat_bev uuid; cat_dessert uuid;
  sup1 uuid; sup2 uuid; sup3 uuid; sup4 uuid;
  inv_chicken uuid; inv_beef uuid; inv_rice uuid; inv_buns uuid; inv_milk uuid;
  inv_yogurt uuid; inv_cheese uuid; inv_oil uuid;
begin
  -- ── Restaurant ──
  insert into public.restaurants (name, slug, subscription_tier, theme_config)
  values (
    'Spice Route', 'spice-route', 'pro',
    jsonb_build_object(
      'address', 'Main GT Road, Kharian',
      'phone', '0300-1234567',
      'email', 'hello@spiceroute.pk',
      'brand_color', '#C2410C'
    )
  )
  returning id into r_id;

  -- ── Login accounts (auth users must be created in the Dashboard first) ──
  select id into owner_id   from auth.users where email = 'orderkardemo@gmail.com';
  select id into waiter_id  from auth.users where email = 'waiterdemo@gmail.com';
  select id into kitchen_id from auth.users where email = 'kitchendemo@gmail.com';

  if owner_id is null or waiter_id is null or kitchen_id is null then
    raise notice '!!! Create the 3 auth users first (orderkardemo/waiterdemo/kitchendemo @gmail.com). Profiles skipped.';
  else
    insert into public.profiles (id, restaurant_id, role, name, phone) values
      (owner_id,   r_id, 'owner',   'Demo Owner', '0300-1234567'),
      (waiter_id,  r_id, 'waiter',  'Ali Raza',   '0300-7654321'),
      (kitchen_id, r_id, 'kitchen', 'Chef Imran', '0300-9876543');
  end if;

  -- ── Subscription: active, so no paywall in demos ──
  insert into public.subscriptions (restaurant_id, plan_type, status, amount, trial_ends_at)
  values (r_id, 'pro', 'active', 9999, now() + interval '1 year');

  -- ── Categories ──
  insert into public.menu_categories (restaurant_id, name, display_order) values
    (r_id, 'Desi', 1),
    (r_id, 'Chinese', 2),
    (r_id, 'Continental', 3),
    (r_id, 'Fast Food', 4),
    (r_id, 'BBQ & Grill', 5),
    (r_id, 'Beverages', 6),
    (r_id, 'Desserts', 7);

  select id into cat_desi     from public.menu_categories where restaurant_id = r_id and name = 'Desi';
  select id into cat_chinese  from public.menu_categories where restaurant_id = r_id and name = 'Chinese';
  select id into cat_cont     from public.menu_categories where restaurant_id = r_id and name = 'Continental';
  select id into cat_fast     from public.menu_categories where restaurant_id = r_id and name = 'Fast Food';
  select id into cat_bbq      from public.menu_categories where restaurant_id = r_id and name = 'BBQ & Grill';
  select id into cat_bev      from public.menu_categories where restaurant_id = r_id and name = 'Beverages';
  select id into cat_dessert  from public.menu_categories where restaurant_id = r_id and name = 'Desserts';

  -- ── Suppliers ──
  insert into public.suppliers (restaurant_id, name, phone, address) values
    (r_id, 'Fresh Meat House',  '0300-1111111', 'Meat Market, Kharian'),
    (r_id, 'Grain & Grocery Co.', '0300-2222222', 'Galla Mandi, Gujrat'),
    (r_id, 'Dairy Fresh Foods', '0300-3333333', 'Dairy Road, Kharian'),
    (r_id, 'Pak Beverages Ltd', '0300-4444444', 'Industrial Area, Gujranwala')
  returning id into sup1;
  select id into sup2 from public.suppliers where restaurant_id = r_id and name = 'Grain & Grocery Co.';
  select id into sup3 from public.suppliers where restaurant_id = r_id and name = 'Dairy Fresh Foods';
  select id into sup4 from public.suppliers where restaurant_id = r_id and name = 'Pak Beverages Ltd';

  -- ── Inventory (20 items; some low / out / expired for alert demos) ──
  insert into public.inventory_items
    (restaurant_id, name, category, unit, current_stock, par_level, cost_per_unit, supplier_id, expiry_date)
  values
    (r_id, 'Chicken (whole)',      'Meat',   'kg',    25, 30, 550, sup1, null),
    (r_id, 'Beef',                 'Meat',   'kg',    12, 15, 1450, sup1, null),
    (r_id, 'Basmati Rice',         'Grocery','kg',    40, 20, 420, sup2, null),
    (r_id, 'Cooking Oil',          'Grocery','liter', 15, 20, 580, sup2, null),
    (r_id, 'Flour',                'Grocery','kg',    30, 25, 140, sup2, null),
    (r_id, 'Tomatoes',             'Fresh',  'kg',     8, 10, 120, sup2, current_date + 4),
    (r_id, 'Onions',               'Fresh',  'kg',    20, 15,  90, sup2, null),
    (r_id, 'Cheese',               'Dairy',  'kg',     5,  8, 1800, sup3, current_date + 20),
    (r_id, 'Burger Buns',          'Bakery', 'pcs',   60, 50,  35, sup3, current_date + 6),
    (r_id, 'Frozen Fries',         'Frozen', 'kg',    18, 20, 380, sup3, current_date + 90),
    (r_id, 'Milk',                 'Dairy',  'liter', 10, 12, 180, sup3, current_date + 3),
    (r_id, 'Eggs',                 'Dairy',  'dozen', 15, 10, 350, sup3, current_date + 12),
    (r_id, 'Soft Drink Cans',      'Drinks', 'pcs',  100, 80,  90, sup4, current_date + 180),
    (r_id, 'Yogurt',               'Dairy',  'kg',     0, 10, 220, sup3, current_date - 1),
    (r_id, 'Spice Mix',            'Grocery','kg',     6,  5, 900, sup2, null),
    (r_id, 'Green Chilies',        'Fresh',  'kg',     3,  5, 200, sup2, current_date + 5),
    (r_id, 'Ginger Garlic Paste',  'Fresh',  'kg',     4,  5, 450, sup2, current_date + 9),
    (r_id, 'Sugar',                'Grocery','kg',    25, 20, 150, sup2, null),
    (r_id, 'Tea Leaves',           'Grocery','kg',     5,  4, 1200, sup2, null),
    (r_id, 'Ice Cream Tubs',       'Frozen', 'pcs',   12, 10, 650, sup3, current_date + 60);

  select id into inv_chicken from public.inventory_items where restaurant_id = r_id and name = 'Chicken (whole)';
  select id into inv_beef    from public.inventory_items where restaurant_id = r_id and name = 'Beef';
  select id into inv_rice    from public.inventory_items where restaurant_id = r_id and name = 'Basmati Rice';
  select id into inv_buns    from public.inventory_items where restaurant_id = r_id and name = 'Burger Buns';
  select id into inv_milk    from public.inventory_items where restaurant_id = r_id and name = 'Milk';
  select id into inv_yogurt  from public.inventory_items where restaurant_id = r_id and name = 'Yogurt';
  select id into inv_cheese  from public.inventory_items where restaurant_id = r_id and name = 'Cheese';
  select id into inv_oil     from public.inventory_items where restaurant_id = r_id and name = 'Cooking Oil';

  -- ── Purchase orders ──
  insert into public.purchase_orders (restaurant_id, supplier_id, status, items, total_amount, notes, created_by)
  values
    (r_id, sup2, 'draft',
     '[{"item_name":"Basmati Rice","quantity":20,"unit_cost":420},{"item_name":"Cooking Oil","quantity":10,"unit_cost":580}]',
     14200, 'Weekly grocery top-up', owner_id),
    (r_id, sup1, 'pending',
     '[{"item_name":"Chicken (whole)","quantity":20,"unit_cost":540},{"item_name":"Beef","quantity":10,"unit_cost":1450}]',
     25300, 'Eid week stock-up — urgent', owner_id),
    (r_id, sup3, 'received',
     '[{"item_name":"Milk","quantity":20,"unit_cost":180},{"item_name":"Eggs","quantity":10,"unit_cost":350}]',
     7100, 'Delivered in good condition', owner_id);

  update public.purchase_orders set received_at = now() - interval '5 days'
   where restaurant_id = r_id and status = 'received';

  -- ── Staff directory (no-login) ──
  insert into public.staff_members (restaurant_id, name, job_title, phone, gender) values
    (r_id, 'Ahmed Khan',   'Waiter',   '0300-5555555', 'male'),
    (r_id, 'Bilal Hussain','Waiter',   '0300-5555556', 'male'),
    (r_id, 'Rashid Mehmood','Head Chef','0300-5555557', 'male'),
    (r_id, 'Sana Bibi',    'Cleaner',  '0300-5555558', 'female');

  raise notice 'Demo base done: restaurant %, categories, suppliers, inventory, POs, staff', r_id;
end $$;

-- ── 3. Menu items (50) ──────────────────────────────────────────────────────
do $$
declare
  r_id uuid;
  c_desi uuid; c_chinese uuid; c_cont uuid; c_fast uuid; c_bbq uuid; c_bev uuid; c_des uuid;
begin
  select id into r_id from public.restaurants where slug = 'spice-route';
  if r_id is null then raise exception 'spice-route not found — run part 1 first'; end if;
  select id into c_desi    from public.menu_categories where restaurant_id = r_id and name = 'Desi';
  select id into c_chinese from public.menu_categories where restaurant_id = r_id and name = 'Chinese';
  select id into c_cont    from public.menu_categories where restaurant_id = r_id and name = 'Continental';
  select id into c_fast    from public.menu_categories where restaurant_id = r_id and name = 'Fast Food';
  select id into c_bbq     from public.menu_categories where restaurant_id = r_id and name = 'BBQ & Grill';
  select id into c_bev     from public.menu_categories where restaurant_id = r_id and name = 'Beverages';
  select id into c_des     from public.menu_categories where restaurant_id = r_id and name = 'Desserts';

  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_desi, 'Chicken Karahi (Half)', 'Desi ghee, fresh tomatoes, green chilies — wok tossed.', 850, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=640&q=80', 20, '{spicy,bestseller}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_desi, 'Chicken Karahi (Full)', 'Full karahi for the whole table, same rich recipe.', 1550, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=640&q=80', 25, '{spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_desi, 'Beef Biryani', 'Layered basmati, tender beef, crispy brown onions.', 340, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=640&q=80', 15, '{bestseller,spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_desi, 'Chicken Biryani', 'Classic Karachi-style biryani with aloo and raita.', 280, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=640&q=80', 15, '{spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_desi, 'Daal Fry', 'Yellow lentils tempered in desi ghee with garlic.', 320, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=640&q=80', 12, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_desi, 'Palak Gosht', 'Slow-cooked spinach with tender beef chunks.', 650, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=640&q=80', 20, '{spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_desi, 'Beef Nihari', 'Overnight slow-cooked shank, ginger and lemon on top.', 550, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=640&q=80', 25, '{bestseller}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_desi, 'Mixed Sabzi', 'Seasonal vegetables in light home-style curry.', 350, 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=640&q=80', 12, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_chinese, 'Chicken Chow Mein', 'Street-style wok noodles with chicken and crunchy veg.', 550, 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=640&q=80', 15, '{bestseller}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_chinese, 'Chicken Fried Rice', 'Smoky wok rice, egg ribbons, spring onion.', 480, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=640&q=80', 12, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_chinese, 'Kung Pao Chicken', 'Peanuts, dried chilies, Sichuan-style glaze.', 750, 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=640&q=80', 18, '{spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_chinese, 'Sweet & Sour Chicken', 'Crispy chicken, peppers and pineapple glaze.', 720, 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=640&q=80', 18, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_chinese, 'Beef Chili Dry', 'Wok-seared beef strips, black pepper, green chilies.', 850, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=640&q=80', 18, '{spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_chinese, 'Chicken Manchurian', 'Ginger-garlic chicken dumplings in savory sauce.', 680, 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=640&q=80', 15, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_chinese, 'Vegetable Fried Rice', 'Light wok rice with garden vegetables.', 380, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=640&q=80', 12, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_chinese, 'Hot & Sour Soup', 'Peppery broth, mushrooms, tofu ribbons.', 350, 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=640&q=80', 10, '{spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_cont, 'Grilled Chicken Steak', 'Char-grilled fillet, pepper sauce, sauteed veg.', 950, 'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=640&q=80', 25, '{bestseller}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_cont, 'Alfredo Pasta', 'Creamy parmesan sauce, grilled chicken strips.', 850, 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=640&q=80', 18, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_cont, 'Chicken Parmesan', 'Crumbed chicken, marinara, molten mozzarella.', 1050, 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=640&q=80', 22, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_cont, 'Grilled Fish Fillet', 'Lemon butter sole with herbed rice.', 1100, 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=640&q=80', 22, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_cont, 'Caesar Salad', 'Romaine, croutons, parmesan, classic dressing.', 550, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=640&q=80', 10, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_cont, 'Club Sandwich', 'Triple-decker chicken, egg, fries on the side.', 480, 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=640&q=80', 12, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_cont, 'Chicken Stroganoff', 'Mushroom cream, buttered noodles.', 900, 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=640&q=80', 20, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_fast, 'Zinger Burger', 'Crispy thigh fillet, chipotle mayo, toasted brioche.', 550, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=640&q=80', 12, '{bestseller,spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_fast, 'Beef Smash Burger', 'Double smashed patty, cheddar, house sauce.', 650, 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=640&q=80', 12, '{bestseller}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_fast, 'Chicken Shawarma', 'Garlic sauce, pickles, fresh tandoori naan wrap.', 320, 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=640&q=80', 8, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_fast, 'Loaded Fries', 'Cheese sauce, chicken chunks, jalapenos.', 450, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=640&q=80', 10, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_fast, 'Chicken Wings (8 pc)', 'Tossed in your choice of buffalo or honey BBQ.', 650, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=640&q=80', 15, '{spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_fast, 'Crispy Broast', 'Marinated overnight, extra crunchy coating.', 520, 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=640&q=80', 18, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_fast, 'Pizza Fries', 'Fries baked with pizza sauce and mozzarella.', 600, 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=640&q=80', 12, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_fast, 'Fish & Chips', 'Beer-battered fish, tartar sauce.', 700, 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?auto=format&fit=crop&w=640&q=80', 15, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_fast, 'Chicken Nuggets (9 pc)', 'Golden nuggets with two dips.', 420, 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=640&q=80', 10, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bbq, 'Chicken Tikka', 'Charcoal grilled, smoky and juicy.', 320, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=640&q=80', 18, '{spicy,bestseller}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bbq, 'Seekh Kebab (4 pc)', 'Hand-minced, green chili kick.', 480, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=640&q=80', 18, '{spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bbq, 'Malai Boti', 'Cream-marinated, melt-in-mouth cubes.', 550, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=640&q=80', 18, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bbq, 'BBQ Platter (Serves 2)', 'Tikka, seekh kebab, malai boti and wings with naan.', 1450, 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=640&q=80', 30, '{bestseller}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bbq, 'Tandoori Chicken', 'Overnight marinade, clay-oven roasted.', 620, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=640&q=80', 25, '{spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bbq, 'Chapli Kebab', 'Peshawari style, tomato and anardana.', 380, 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=640&q=80', 15, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bbq, 'Reshmi Kebab', 'Silky smooth, mild and creamy.', 520, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=640&q=80', 18, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bbq, 'Grilled Fish Tikka', 'River fish, ajwain and mustard oil marinade.', 680, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=640&q=80', 20, '{spicy}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bev, 'Fresh Lime Soda', 'Hand-shaken, sweet or salted.', 200, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=640&q=80', 5, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bev, 'Mango Shake', 'Thick seasonal mango blended with milk.', 300, 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=640&q=80', 5, '{bestseller}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bev, 'Cold Coffee', 'Blended iced coffee with cream top.', 350, 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=640&q=80', 5, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bev, 'Mint Margarita', 'Crushed mint, lime, soda fizz.', 250, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=640&q=80', 5, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bev, 'Kashmiri Chai', 'Pink tea with crushed nuts.', 250, 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=640&q=80', 8, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_bev, 'Soft Drink', 'Chilled can — ask for options.', 150, 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=640&q=80', 2, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_des, 'Gulab Jamun (4 pc)', 'Warm, saffron syrup.', 250, 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=640&q=80', 5, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_des, 'Kulfi Falooda', 'Traditional kulfi, vermicelli, basil seeds.', 350, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=640&q=80', 8, '{bestseller}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_des, 'Molten Lava Cake', 'Warm chocolate core, vanilla scoop.', 450, 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=640&q=80', 12, '{}');
  insert into public.menu_items (restaurant_id, category_id, name, description, price, image_url, prep_time_minutes, tags) values (r_id, c_des, 'Vanilla Ice Cream', 'Two scoops, wafer stick.', 200, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=640&q=80', 3, '{}');
  raise notice 'Menu seeded: 50 items';
end $$;

-- ── 4. Tables (12) ──────────────────────────────────────────────────────────
do $$
declare
  r_id uuid;
begin
  select id into r_id from public.restaurants where slug = 'spice-route';
  insert into public.tables (restaurant_id, table_number, qr_code, capacity, floor_section) values
    (r_id, 1,  'SPICEROUTE-T1',  4, 'indoor'),
    (r_id, 2,  'SPICEROUTE-T2',  4, 'indoor'),
    (r_id, 3,  'SPICEROUTE-T3',  6, 'indoor'),
    (r_id, 4,  'SPICEROUTE-T4',  2, 'indoor'),
    (r_id, 5,  'SPICEROUTE-T5',  4, 'indoor'),
    (r_id, 6,  'SPICEROUTE-T6',  8, 'indoor'),
    (r_id, 7,  'SPICEROUTE-T7',  4, 'outdoor'),
    (r_id, 8,  'SPICEROUTE-T8',  4, 'outdoor'),
    (r_id, 9,  'SPICEROUTE-T9',  6, 'outdoor'),
    (r_id, 10, 'SPICEROUTE-T10', 4, 'rooftop'),
    (r_id, 11, 'SPICEROUTE-T11', 2, 'rooftop'),
    (r_id, 12, 'SPICEROUTE-T12', 6, 'rooftop');
  raise notice 'Tables seeded: 12';
end $$;

-- ── 5. Recipes (food-cost demo) ─────────────────────────────────────────────
do $$
declare
  r_id uuid;
  v_karahi uuid; v_biryani uuid; v_zinger uuid; v_tikka uuid;
  i_chicken uuid; i_beef uuid; i_rice uuid; i_buns uuid;
begin
  select id into r_id from public.restaurants where slug = 'spice-route';
  select id into v_karahi  from public.menu_items where restaurant_id = r_id and name = 'Chicken Karahi (Half)';
  select id into v_biryani from public.menu_items where restaurant_id = r_id and name = 'Beef Biryani';
  select id into v_zinger  from public.menu_items where restaurant_id = r_id and name = 'Zinger Burger';
  select id into v_tikka   from public.menu_items where restaurant_id = r_id and name = 'Chicken Tikka';
  select id into i_chicken from public.inventory_items where restaurant_id = r_id and name = 'Chicken (whole)';
  select id into i_beef    from public.inventory_items where restaurant_id = r_id and name = 'Beef';
  select id into i_rice    from public.inventory_items where restaurant_id = r_id and name = 'Basmati Rice';
  select id into i_buns    from public.inventory_items where restaurant_id = r_id and name = 'Burger Buns';
  insert into public.recipes (restaurant_id, menu_item_id, ingredient_id, quantity_required, unit) values
    (r_id, v_karahi,  i_chicken, 0.60, 'kg'),
    (r_id, v_biryani, i_beef,    0.25, 'kg'),
    (r_id, v_biryani, i_rice,    0.30, 'kg'),
    (r_id, v_zinger,  i_chicken, 0.20, 'kg'),
    (r_id, v_zinger,  i_buns,    1,    'pcs'),
    (r_id, v_tikka,   i_chicken, 0.25, 'kg');
  raise notice 'Recipes seeded';
end $$;

-- ── 6. Orders: 45 history + 5 cancelled + 6 LIVE ─────────────────────────────
do $$
declare
  r_id uuid; waiter_id uuid;
  i int; j int;
  o_id uuid; o_total numeric; o_created timestamptz;
  mi_id uuid; mi_name text; mi_price numeric; qty int;
  otype text; t_id uuid; pm text; cname text;
  names text[] := array['Ahmed','Fatima','Bilal','Ayesha','Usman','Hamza','Maryam','Ali','Sana','Imran','Kamran','Nadia','Hassan','Zainab','Danish','Rabia'];
  pms   text[] := array['cash','cash','cash','card','jazzcash','easypaisa'];
  reasons text[] := array['Customer changed mind','Out of stock','Wrong order placed','Duplicate order','Customer left'];
begin
  select id into r_id from public.restaurants where slug = 'spice-route';
  select id into waiter_id from public.profiles where restaurant_id = r_id and role = 'waiter' limit 1;

  -- 45 completed/paid over the last 30 days
  for i in 1..45 loop
    o_created := now()
      - make_interval(days => floor(random()*30)::int)
      - make_interval(hours => (12 + floor(random()*10))::int)
      - make_interval(mins => floor(random()*60)::int);
    if random() < 0.62 then otype := 'dine_in';
    elsif random() < 0.75 then otype := 'takeaway';
    else otype := 'delivery'; end if;
    t_id := null;
    if otype = 'dine_in' then
      select id into t_id from public.tables where restaurant_id = r_id order by random() limit 1;
    end if;
    pm := pms[1 + floor(random()*array_length(pms,1))::int];
    cname := names[1 + floor(random()*array_length(names,1))::int];
    insert into public.orders (restaurant_id, table_id, waiter_id, order_type, status, payment_status, payment_method, customer_name, created_at)
    values (r_id, t_id, waiter_id, otype, 'completed', 'paid', pm, cname, o_created)
    returning id into o_id;
    o_total := 0;
    for j in 1..(2 + floor(random()*3)::int) loop
      select id, name, price into mi_id, mi_name, mi_price
        from public.menu_items where restaurant_id = r_id order by random() limit 1;
      qty := 1 + floor(random()*2)::int;
      insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price, status)
      values (o_id, mi_id, mi_name, qty, mi_price, 'ready');
      o_total := o_total + qty * mi_price;
    end loop;
    update public.orders set total_amount = o_total, updated_at = o_created where id = o_id;
  end loop;

  -- 5 cancelled
  for i in 1..5 loop
    o_created := now() - make_interval(days => floor(random()*14)::int) - make_interval(hours => (floor(random()*8))::int + 12);
    select id into t_id from public.tables where restaurant_id = r_id order by random() limit 1;
    insert into public.orders (restaurant_id, table_id, waiter_id, order_type, status, payment_status, customer_name, cancel_reason, created_at)
    values (r_id, t_id, waiter_id, 'dine_in', 'cancelled', 'unpaid',
            names[1+floor(random()*array_length(names,1))::int],
            reasons[1+floor(random()*array_length(reasons,1))::int], o_created)
    returning id into o_id;
    o_total := 0;
    for j in 1..(1 + floor(random()*2)::int) loop
      select id, name, price into mi_id, mi_name, mi_price
        from public.menu_items where restaurant_id = r_id order by random() limit 1;
      qty := 1 + floor(random()*2)::int;
      insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price, status)
      values (o_id, mi_id, mi_name, qty, mi_price, 'pending');
      o_total := o_total + qty * mi_price;
    end loop;
    update public.orders set total_amount = o_total, updated_at = o_created where id = o_id;
  end loop;

  raise notice 'Historical orders seeded: 50';
end $$;

-- ── 7. LIVE orders (for kitchen / waiter demo, created minutes ago) ─────────
create or replace function __demo_add_item(p_restaurant uuid, p_order uuid, p_name text, p_qty int, p_status text)
returns void language plpgsql as $fn$
declare
  mi uuid; pr numeric;
begin
  select id, price into mi, pr from public.menu_items where restaurant_id = p_restaurant and name = p_name;
  insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price, status)
  values (p_order, mi, p_name, p_qty, pr, p_status);
  update public.orders set total_amount = total_amount + p_qty * pr where id = p_order;
end;
$fn$;

do $$
declare
  r_id uuid; waiter_id uuid;
  o_id uuid;
  t3 uuid; t7 uuid; t5 uuid; t10 uuid; t2 uuid;
begin
  select id into r_id from public.restaurants where slug = 'spice-route';
  select id into waiter_id from public.profiles where restaurant_id = r_id and role = 'waiter' limit 1;
  select id into t3  from public.tables where restaurant_id = r_id and table_number = 3;
  select id into t7  from public.tables where restaurant_id = r_id and table_number = 7;
  select id into t5  from public.tables where restaurant_id = r_id and table_number = 5;
  select id into t10 from public.tables where restaurant_id = r_id and table_number = 10;
  select id into t2  from public.tables where restaurant_id = r_id and table_number = 2;

  -- pending x2
  insert into public.orders (restaurant_id, table_id, waiter_id, order_type, status, payment_status, customer_name, created_at)
  values (r_id, t3, waiter_id, 'dine_in', 'pending', 'unpaid', 'Ahmed', now() - interval '6 minutes') returning id into o_id;
  perform __demo_add_item(r_id, o_id, 'Chicken Karahi (Half)', 1, 'pending');
  perform __demo_add_item(r_id, o_id, 'Beef Biryani', 2, 'pending');

  insert into public.orders (restaurant_id, table_id, waiter_id, order_type, status, payment_status, customer_name, created_at)
  values (r_id, t7, waiter_id, 'dine_in', 'pending', 'unpaid', 'Fatima', now() - interval '11 minutes') returning id into o_id;
  perform __demo_add_item(r_id, o_id, 'Zinger Burger', 2, 'pending');
  perform __demo_add_item(r_id, o_id, 'Loaded Fries', 1, 'pending');
  perform __demo_add_item(r_id, o_id, 'Mint Margarita', 2, 'pending');

  -- preparing x2
  insert into public.orders (restaurant_id, table_id, waiter_id, order_type, status, payment_status, customer_name, created_at)
  values (r_id, t5, waiter_id, 'dine_in', 'preparing', 'unpaid', 'Bilal', now() - interval '18 minutes') returning id into o_id;
  perform __demo_add_item(r_id, o_id, 'Chicken Tikka', 4, 'preparing');
  perform __demo_add_item(r_id, o_id, 'Seekh Kebab (4 pc)', 2, 'preparing');

  insert into public.orders (restaurant_id, table_id, waiter_id, order_type, status, payment_status, customer_name, created_at)
  values (r_id, t10, waiter_id, 'dine_in', 'preparing', 'unpaid', 'Ayesha', now() - interval '24 minutes') returning id into o_id;
  perform __demo_add_item(r_id, o_id, 'Chicken Chow Mein', 2, 'preparing');
  perform __demo_add_item(r_id, o_id, 'Kung Pao Chicken', 1, 'preparing');
  perform __demo_add_item(r_id, o_id, 'Hot & Sour Soup', 2, 'ready');

  -- ready x2 (one dine-in for waiter collect-payment demo, one takeaway)
  insert into public.orders (restaurant_id, table_id, waiter_id, order_type, status, payment_status, customer_name, created_at)
  values (r_id, t2, waiter_id, 'dine_in', 'ready', 'unpaid', 'Usman', now() - interval '32 minutes') returning id into o_id;
  perform __demo_add_item(r_id, o_id, 'Beef Smash Burger', 2, 'ready');
  perform __demo_add_item(r_id, o_id, 'Pizza Fries', 1, 'ready');
  perform __demo_add_item(r_id, o_id, 'Cold Coffee', 2, 'ready');

  insert into public.orders (restaurant_id, table_id, waiter_id, order_type, status, payment_status, customer_name, customer_phone, created_at)
  values (r_id, null, waiter_id, 'takeaway', 'ready', 'unpaid', 'Hamza', '0300-9998888', now() - interval '14 minutes') returning id into o_id;
  perform __demo_add_item(r_id, o_id, 'Chicken Biryani', 3, 'ready');
  perform __demo_add_item(r_id, o_id, 'Gulab Jamun (4 pc)', 2, 'ready');

  raise notice 'Live orders seeded: 6';
end $$;

drop function __demo_add_item(uuid, uuid, text, int, text);

-- ── 8. Reviews (15) ─────────────────────────────────────────────────────────
do $$
declare
  r_id uuid;
  o1 uuid; o2 uuid; o3 uuid;
begin
  select id into r_id from public.restaurants where slug = 'spice-route';
  select id into o1 from public.orders where restaurant_id = r_id and status = 'completed' order by random() limit 1;
  select id into o2 from public.orders where restaurant_id = r_id and status = 'completed' and id <> o1 order by random() limit 1;
  select id into o3 from public.orders where restaurant_id = r_id and status = 'completed' and id not in (o1, o2) order by random() limit 1;

  insert into public.reviews (restaurant_id, order_id, rating, comment, customer_name, created_at) values
    (r_id, o1, 5, 'Best karahi in Kharian! Fresh naan, quick service.', 'Ahmed Raza', now() - interval '2 days'),
    (r_id, o2, 5, 'Biryani was full of flavour. Will order again.', 'Fatima Khan', now() - interval '3 days'),
    (r_id, o3, 4, 'Good food, bit of a wait at dinner time.', 'Bilal Ahmed', now() - interval '5 days'),
    (r_id, null, 5, 'BBQ platter is amazing for family dinners.', 'Ayesha Malik', now() - interval '6 days'),
    (r_id, null, 4, 'Zinger was crispy and fresh. Loved it.', 'Usman Tariq', now() - interval '8 days'),
    (r_id, null, 5, 'Clean place, polite staff, tasty Chinese.', 'Maryam Nawaz', now() - interval '9 days'),
    (r_id, null, 3, 'Food good but parking is a hassle.', 'Hamza Sheikh', now() - interval '11 days'),
    (r_id, null, 5, 'Kulfi falooda is a must-try!', 'Sana Iqbal', now() - interval '12 days'),
    (r_id, null, 4, 'Nihari on Sunday is worth waking up for.', 'Imran Farooq', now() - interval '14 days'),
    (r_id, null, 2, 'My order took 50 minutes. Improve timing.', 'Kamran Ali', now() - interval '15 days'),
    (r_id, null, 5, 'Ordered for office lunch — everyone loved the chow mein.', 'Nadia Hussain', now() - interval '17 days'),
    (r_id, null, 4, 'Nice rooftop sitting in the evening.', 'Hassan Javed', now() - interval '20 days'),
    (r_id, null, 5, 'Fresh lime soda + tikka = perfect combo.', 'Zainab Tariq', now() - interval '22 days'),
    (r_id, null, 3, 'Average experience, fries were a bit soggy.', 'Danish Mehmood', now() - interval '25 days'),
    (r_id, null, 5, 'Highly recommended for family dinners.', 'Rabia Akhtar', now() - interval '28 days');
  raise notice 'Reviews seeded: 15';
end $$;

-- ── 9. Waste logs (4) ───────────────────────────────────────────────────────
do $$
declare
  r_id uuid; owner_id uuid;
  i_yogurt uuid; i_milk uuid; i_rice uuid; i_buns uuid;
begin
  select id into r_id from public.restaurants where slug = 'spice-route';
  select id into owner_id from public.profiles where restaurant_id = r_id and role = 'owner' limit 1;
  select id into i_yogurt from public.inventory_items where restaurant_id = r_id and name = 'Yogurt';
  select id into i_milk   from public.inventory_items where restaurant_id = r_id and name = 'Milk';
  select id into i_rice   from public.inventory_items where restaurant_id = r_id and name = 'Basmati Rice';
  select id into i_buns   from public.inventory_items where restaurant_id = r_id and name = 'Burger Buns';
  insert into public.waste_logs (restaurant_id, inventory_item_id, item_name, quantity, reason, estimated_cost, logged_by, logged_at) values
    (r_id, i_yogurt, 'Yogurt', 2, 'spoilage', 440, owner_id, now() - interval '1 day'),
    (r_id, i_milk,   'Milk',   5, 'spoilage', 900, owner_id, now() - interval '2 days'),
    (r_id, i_rice,   'Basmati Rice', 3, 'overprep', 1260, owner_id, now() - interval '4 days'),
    (r_id, i_buns,   'Burger Buns', 10, 'damaged', 350, owner_id, now() - interval '6 days');
  raise notice 'Waste logs seeded: 4';
end $$;

-- ── 10. Activity log sample (tracking history demo) ─────────────────────────
do $$
declare
  r_id uuid; owner_id uuid; waiter_id uuid;
  o uuid; mi uuid;
begin
  select id into r_id from public.restaurants where slug = 'spice-route';
  select id into owner_id  from public.profiles where restaurant_id = r_id and role = 'owner' limit 1;
  select id into waiter_id from public.profiles where restaurant_id = r_id and role = 'waiter' limit 1;
  select id into o  from public.orders where restaurant_id = r_id and status = 'completed' order by created_at desc limit 1;
  select id into mi from public.menu_items where restaurant_id = r_id and name = 'Beef Biryani';

  insert into public.activity_log (restaurant_id, actor_id, action, entity_type, entity_id, details, created_at) values
    (r_id, owner_id, 'menu_item_created',  'menu_item', mi, '{"name":"Beef Biryani","price":340}', now() - interval '2 days'),
    (r_id, owner_id, 'settings_updated',   'restaurant', null, '{"section":"profile"}', now() - interval '2 days'),
    (r_id, waiter_id, 'order_created',     'order', o, '{"table":3}', now() - interval '1 day'),
    (r_id, waiter_id, 'payment_collected', 'order', o, '{"method":"cash"}', now() - interval '1 day'),
    (r_id, owner_id, 'supplier_created',   'supplier', null, '{"name":"Fresh Meat House"}', now() - interval '3 days'),
    (r_id, owner_id, 'purchase_order_created', 'purchase_order', null, '{"status":"pending"}', now() - interval '3 days'),
    (r_id, owner_id, 'staff_created',      'staff', null, '{"name":"Ahmed Khan"}', now() - interval '5 days'),
    (r_id, waiter_id, 'order_cancelled',   'order', null, '{"reason":"Customer changed mind"}', now() - interval '6 days'),
    (r_id, owner_id, 'waste_logged',       'inventory', null, '{"item":"Yogurt","quantity":2}', now() - interval '1 day'),
    (r_id, owner_id, 'login',              'session', null, '{}', now() - interval '1 hour');
  raise notice 'Activity log seeded';
end $$;

-- ── Done ────────────────────────────────────────────────────────────────────
do $$
begin
  raise notice '==================================================';
  raise notice 'DEMO SEED COMPLETE: Spice Route (spice-route)';
  raise notice 'Owner:  orderkardemo@gmail.com / demo@1234';
  raise notice 'Waiter: waiterdemo@gmail.com / demo@1234';
  raise notice 'Kitchen: kitchendemo@gmail.com / demo@1234';
  raise notice '==================================================';
end $$;
