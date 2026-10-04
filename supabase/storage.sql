-- ============================================================================
-- OrderKar — one-time setup for photo uploads + staff address field.
-- Run ONCE in Supabase Dashboard > SQL editor (safe to re-run).
-- ============================================================================

-- 1) Staff address field
alter table public.profiles add column if not exists address text;

-- 2) Public bucket for menu item photos
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- 3) Anyone can view photos; staff can only write inside their own
--    restaurant's folder (<restaurant_id>/...)
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

-- 4) (Optional) list recent auth users — copy a UUID to link staff in the app
-- select id, email, created_at from auth.users order by created_at desc limit 10;
