-- Add allergens to menu items (safe, non-destructive).
-- text[] with empty default; restaurants are NOT required to fill it.
alter table public.menu_items
  add column if not exists allergens text[] not null default '{}';
