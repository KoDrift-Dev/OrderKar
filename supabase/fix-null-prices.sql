-- Fix null prices on demo menu items (safe, idempotent).
-- Only updates items where price is currently null.
update public.menu_items set price = 850 where name = 'Beef Chili Dry' and price is null;
update public.menu_items set price = 350 where name = 'Kulfi Falooda' and price is null;
