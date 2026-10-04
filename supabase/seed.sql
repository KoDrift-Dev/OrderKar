-- ============================================================================
-- OrderKar SaaS — demo seed data. Run AFTER schema.sql in the Supabase SQL
-- editor. Safe to re-run: it wipes and recreates the two demo restaurants.
--
-- Demo tenants:
--   1. Spice Villa  (slug: spice-villa)  — G.T. Road, Kharian
--   2. Lahore Grill House (slug: lahore-grill) — FICTIONAL demo restaurant,
--      Gulberg, Lahore (not a real business)
--
-- NOTE: this does NOT create auth users (impossible from SQL). After running,
-- create users in Dashboard > Authentication > Users, then insert matching
-- profiles rows — template at the bottom of this file.
-- ============================================================================

-- Wipe previous demo seed (cascades to tables, menu, orders, profiles…)
delete from restaurants where slug in ('spice-villa', 'lahore-grill');

-- ── Restaurants ─────────────────────────────────────────────────────────────

insert into restaurants (id, name, slug, theme_config, subscription_tier) values
  ('11111111-1111-1111-1111-111111111111', 'Spice Villa', 'spice-villa',
   '{"address": "G.T. Road, Kharian", "phone": "+92 300 1234567"}', 'pro'),
  ('22222222-2222-2222-2222-222222222222', 'Lahore Grill House', 'lahore-grill',
   '{"address": "Main Boulevard, Gulberg, Lahore", "phone": "+92 300 7654321"}', 'starter');

-- ── Tables (6 per restaurant) ───────────────────────────────────────────────

insert into tables (id, restaurant_id, table_number, qr_code, capacity, floor_section) values
  ('11111111-1111-1111-1111-111111113001', '11111111-1111-1111-1111-111111111111', 1, 'SPICEVILLA-T1', 4, 'indoor'),
  ('11111111-1111-1111-1111-111111113002', '11111111-1111-1111-1111-111111111111', 2, 'SPICEVILLA-T2', 4, 'indoor'),
  ('11111111-1111-1111-1111-111111113003', '11111111-1111-1111-1111-111111111111', 3, 'SPICEVILLA-T3', 6, 'indoor'),
  ('11111111-1111-1111-1111-111111113004', '11111111-1111-1111-1111-111111111111', 4, 'SPICEVILLA-T4', 2, 'outdoor'),
  ('11111111-1111-1111-1111-111111113005', '11111111-1111-1111-1111-111111111111', 5, 'SPICEVILLA-T5', 8, 'vip'),
  ('11111111-1111-1111-1111-111111113006', '11111111-1111-1111-1111-111111111111', 6, 'SPICEVILLA-T6', 4, 'outdoor'),
  ('22222222-2222-2222-2222-222222223001', '22222222-2222-2222-2222-222222222222', 1, 'LAHOREGRILL-T1', 4, 'indoor'),
  ('22222222-2222-2222-2222-222222223002', '22222222-2222-2222-2222-222222222222', 2, 'LAHOREGRILL-T2', 4, 'indoor'),
  ('22222222-2222-2222-2222-222222223003', '22222222-2222-2222-2222-222222222222', 3, 'LAHOREGRILL-T3', 6, 'indoor'),
  ('22222222-2222-2222-2222-222222223004', '22222222-2222-2222-2222-222222222222', 4, 'LAHOREGRILL-T4', 2, 'outdoor'),
  ('22222222-2222-2222-2222-222222223005', '22222222-2222-2222-2222-222222222222', 5, 'LAHOREGRILL-T5', 8, 'vip'),
  ('22222222-2222-2222-2222-222222223006', '22222222-2222-2222-2222-222222222222', 6, 'LAHOREGRILL-T6', 4, 'outdoor');

-- ── Menu categories ─────────────────────────────────────────────────────────

insert into menu_categories (id, restaurant_id, name, display_order) values
  ('11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111111', 'BBQ & Grill', 1),
  ('11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111111', 'Karahi & Handi', 2),
  ('11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111111', 'Biryani & Rice', 3),
  ('11111111-1111-1111-1111-111111111104', '11111111-1111-1111-1111-111111111111', 'Chinese', 4),
  ('11111111-1111-1111-1111-111111111105', '11111111-1111-1111-1111-111111111111', 'Fast Food', 5),
  ('11111111-1111-1111-1111-111111111106', '11111111-1111-1111-1111-111111111111', 'Breads & Naan', 6),
  ('11111111-1111-1111-1111-111111111107', '11111111-1111-1111-1111-111111111111', 'Drinks & Shakes', 7),
  ('11111111-1111-1111-1111-111111111108', '11111111-1111-1111-1111-111111111111', 'Desserts', 8),
  ('22222222-2222-2222-2222-222222222101', '22222222-2222-2222-2222-222222222222', 'BBQ & Grill', 1),
  ('22222222-2222-2222-2222-222222222102', '22222222-2222-2222-2222-222222222222', 'Karahi & Handi', 2),
  ('22222222-2222-2222-2222-222222222103', '22222222-2222-2222-2222-222222222222', 'Biryani & Rice', 3),
  ('22222222-2222-2222-2222-222222222104', '22222222-2222-2222-2222-222222222222', 'Chinese', 4),
  ('22222222-2222-2222-2222-222222222105', '22222222-2222-2222-2222-222222222222', 'Fast Food', 5),
  ('22222222-2222-2222-2222-222222222106', '22222222-2222-2222-2222-222222222222', 'Breads & Naan', 6),
  ('22222222-2222-2222-2222-222222222107', '22222222-2222-2222-2222-222222222222', 'Drinks & Shakes', 7),
  ('22222222-2222-2222-2222-222222222108', '22222222-2222-2222-2222-222222222222', 'Desserts', 8);

-- ── Menu items: Spice Villa (20) ────────────────────────────────────────────

insert into menu_items (id, restaurant_id, category_id, name, description, price, prep_time_minutes, tags) values
  ('11111111-1111-1111-1111-111111112001', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Chicken Tikka', 'Char-grilled leg quarter marinated overnight in yoghurt, ajwain and desi masalas.', 280, 20, '{bestseller,spicy}'),
  ('11111111-1111-1111-1111-111111112002', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Seekh Kebab (4 pc)', 'Hand-minced beef with green chillies and fresh coriander, flame-grilled on skewers.', 450, 20, '{bestseller}'),
  ('11111111-1111-1111-1111-111111112003', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'Malai Boti', 'Creamy, melt-in-mouth chicken cubes with white pepper and a whisper of cheese.', 520, 20, '{}'),
  ('11111111-1111-1111-1111-111111112004', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111101', 'BBQ Platter (Serves 2)', 'Tikka, seekh kebab, malai boti and wings with naan, raita and imli chutney.', 1450, 30, '{bestseller}'),
  ('11111111-1111-1111-1111-111111112005', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', 'Chicken Karahi (Half)', 'Wok-tossed in desi ghee with fresh tomatoes, julienned ginger and green chillies.', 850, 25, '{bestseller,spicy}'),
  ('11111111-1111-1111-1111-111111112006', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', 'Chicken Karahi (Full)', 'Wok-tossed in desi ghee with fresh tomatoes, julienned ginger and green chillies.', 1600, 30, '{spicy}'),
  ('11111111-1111-1111-1111-111111112007', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111102', 'Daal Fry', 'Slow-cooked yellow daal tempered with garlic, cumin and a spoon of desi ghee.', 350, 15, '{veg}'),
  ('11111111-1111-1111-1111-111111112008', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111103', 'Chicken Biryani', 'Layered Sindhi-style with aloo, served with raita and kachumber salad.', 280, 15, '{bestseller,spicy}'),
  ('11111111-1111-1111-1111-111111112009', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111103', 'Beef Biryani', 'Tender beef folded through saffron-kissed basmati with crispy brown onions.', 340, 15, '{spicy}'),
  ('11111111-1111-1111-1111-111111112010', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111103', 'Chicken Fried Rice', 'Egg ribbons, spring onion and charred chicken in every bite.', 380, 12, '{}'),
  ('11111111-1111-1111-1111-111111112011', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111104', 'Chicken Chow Mein', 'Street-style wok noodles with julienned chicken and crunchy vegetables.', 420, 15, '{}'),
  ('11111111-1111-1111-1111-111111112012', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111104', 'Hot & Sour Soup', 'Peppery, tangy and loaded — the desi-Chinese hug in a bowl.', 280, 10, '{spicy}'),
  ('11111111-1111-1111-1111-111111112013', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111105', 'Zinger Burger', 'Crunchy marinated fillet, mayo and crisp lettuce in a toasted brioche bun.', 450, 12, '{bestseller}'),
  ('11111111-1111-1111-1111-111111112014', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111105', 'Beef Smash Burger', 'Double smashed patty, cheddar, caramelised onions and smoky house sauce.', 650, 15, '{bestseller}'),
  ('11111111-1111-1111-1111-111111112015', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111106', 'Roghni Naan', 'Sesame-topped and tandoor-blistered — the karahi''s best friend.', 60, 5, '{veg}'),
  ('11111111-1111-1111-1111-111111112016', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111106', 'Garlic Naan', 'Brushed with garlic butter — made for scooping.', 90, 5, '{veg}'),
  ('11111111-1111-1111-1111-111111112017', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111107', 'Mango Shake', 'Thick-blended Sindhri mangoes with a scoop of vanilla ice cream.', 320, 5, '{bestseller}'),
  ('11111111-1111-1111-1111-111111112018', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111107', 'Doodh Patti', 'Slow-brewed milky chai, the dhaba way — strong and soul-warming.', 150, 5, '{}'),
  ('11111111-1111-1111-1111-111111112019', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111108', 'Gulab Jamun (4 pc)', 'Warm, syrup-soaked and impossibly soft.', 250, 5, '{veg,bestseller}'),
  ('11111111-1111-1111-1111-111111112020', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111108', 'Kulfi Falooda', 'Dense malai kulfi over vermicelli, basil seeds and rose syrup.', 350, 8, '{veg,bestseller}');

-- ── Menu items: Lahore Grill House (20) ─────────────────────────────────────

insert into menu_items (id, restaurant_id, category_id, name, description, price, prep_time_minutes, tags) values
  ('22222222-2222-2222-2222-222222222001', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222101', 'Chicken Tikka', 'Lahore-style char-grilled tikka with a fiery red chilli rub.', 300, 20, '{bestseller,spicy}'),
  ('22222222-2222-2222-2222-222222222002', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222101', 'Seekh Kebab (4 pc)', 'Coarse-minced beef kebabs, smoked over coal dum.', 480, 20, '{bestseller}'),
  ('22222222-2222-2222-2222-222222222003', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222101', 'Behari Boti', 'Smoky mustard-kissed strips — the desi BBQ lover''s first love.', 500, 20, '{spicy}'),
  ('22222222-2222-2222-2222-222222222004', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222101', 'Grilled Wings (8 pc)', 'Tossed in a tangy chilli-garlic glaze, charred at the edges.', 440, 15, '{spicy}'),
  ('22222222-2222-2222-2222-222222222005', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222102', 'Chicken Karahi (Half)', 'Lahori karahi with extra adrak and hari mirch — bold and buttery.', 900, 25, '{bestseller,spicy}'),
  ('22222222-2222-2222-2222-222222222006', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222102', 'Mutton Karahi (Half)', 'Tender mutton bhunofied the old way — black-pepper forward, no shortcuts.', 1500, 30, '{}'),
  ('22222222-2222-2222-2222-222222222007', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222102', 'Palak Paneer', 'Fresh spinach folded with soft paneer cubes — mellow and rich.', 580, 20, '{veg}'),
  ('22222222-2222-2222-2222-222222222008', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222103', 'Chicken Biryani', 'Bombay-style biryani with aloo bukhara and crispy onions.', 300, 15, '{bestseller,spicy}'),
  ('22222222-2222-2222-2222-222222222009', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222103', 'Chicken Pulao', 'Yakhni-cooked basmati with whole garam masala — aromatic, not fiery.', 320, 15, '{}'),
  ('22222222-2222-2222-2222-222222222010', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222103', 'Zeera Rice', 'Fluffy basmati tossed with roasted cumin.', 270, 10, '{veg}'),
  ('22222222-2222-2222-2222-222222222011', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222104', 'Chicken Manchurian with Rice', 'Crispy chicken balls in a garlicky soy glaze over egg fried rice.', 470, 18, '{}'),
  ('22222222-2222-2222-2222-222222222012', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222104', 'Kung Pao Chicken', 'Fiery dried chillies, roasted peanuts and that unmistakable wok hei.', 540, 18, '{spicy}'),
  ('22222222-2222-2222-2222-222222222013', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222105', 'Zinger Burger', 'Crunchy fillet, pepper mayo and jalapeños in a toasted bun.', 470, 12, '{bestseller}'),
  ('22222222-2222-2222-2222-222222222014', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222105', 'Crispy Broast (2 pc)', 'Pressure-fried extra crunchy — with fries and garlic mayo.', 440, 15, '{}'),
  ('22222222-2222-2222-2222-222222222015', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222105', 'Chicken Shawarma', 'Char-grilled strips, pickles and toum wrapped in soft khubz.', 320, 10, '{}'),
  ('22222222-2222-2222-2222-222222222016', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222106', 'Cheese Naan', 'Stuffed with molten mozzarella. Dangerously good.', 160, 8, '{veg,bestseller}'),
  ('22222222-2222-2222-2222-222222222017', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222106', 'Tandoori Roti (2 pc)', 'Whole-wheat, clay-oven fresh.', 50, 5, '{veg}'),
  ('22222222-2222-2222-2222-222222222018', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222107', 'Fresh Lime Soda', 'Hand-pressed lime, soda and black salt — served ice cold.', 200, 5, '{}'),
  ('22222222-2222-2222-2222-222222222019', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222107', 'Kashmiri Chai', 'Pink, lightly salted, crowned with crushed pistachio.', 220, 8, '{}'),
  ('22222222-2222-2222-2222-222222222020', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222108', 'Kheer', 'Slow-cooked rice pudding with cardamom, chilled in a clay bowl.', 240, 5, '{veg}'),
  ('22222222-2222-2222-2222-222222222021', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222108', 'Shahi Tukray', 'Saffron-soaked fried bread crowned with rabri and pistachio.', 320, 8, '{veg}');

-- ── Subscriptions ───────────────────────────────────────────────────────────

insert into subscriptions (restaurant_id, plan_type, status, amount) values
  ('11111111-1111-1111-1111-111111111111', 'pro', 'active', 9999),
  ('22222222-2222-2222-2222-222222222222', 'starter', 'trial', 4999);

-- ════════════════════════════════════════════════════════════════════════════
-- STAFF PROFILES — template. Auth users CANNOT be created from SQL, so:
--   1. Dashboard > Authentication > Users > "Add user" (create each user).
--   2. Copy the generated UUID from the users list.
--   3. Run the INSERTs below with the real UUIDs.
-- ════════════════════════════════════════════════════════════════════════════

-- Example (replace the UUIDs with the real ones from the dashboard):
--
-- insert into profiles (id, restaurant_id, role, name, phone) values
--   ('PASTE-AUTH-UUID-1', '11111111-1111-1111-1111-111111111111', 'owner',   'Spice Villa Owner', '0300-1111111'),
--   ('PASTE-AUTH-UUID-2', '11111111-1111-1111-1111-111111111111', 'manager', 'Ali Raza',          '0300-2222222'),
--   ('PASTE-AUTH-UUID-3', '11111111-1111-1111-1111-111111111111', 'kitchen', 'Bilal Ahmed',       '0300-3333333'),
--   ('PASTE-AUTH-UUID-4', '11111111-1111-1111-1111-111111111111', 'waiter',  'Usman Tariq',       '0300-4444444'),
--   ('PASTE-AUTH-UUID-5', '22222222-2222-2222-2222-222222222222', 'owner',   'Lahore Grill Owner','0300-5555555');
--
-- Platform super-admin (Tahseen) — restaurant_id stays NULL:
--
-- insert into profiles (id, restaurant_id, role, is_super_admin, name) values
--   ('PASTE-AUTH-UUID-0', NULL, 'super_admin', true, 'Tahseen Alam');
