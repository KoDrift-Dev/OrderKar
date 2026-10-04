-- ============================================================================
-- OrderKar — one-time setup: photo uploads + staff tables + policy fixes.
-- Run ONCE in Supabase Dashboard > SQL editor (safe to re-run).
-- ============================================================================

-- 1) profiles: new columns
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists gender text
  check (gender is null or gender in ('male', 'female'));
alter table public.profiles add column if not exists photo_url text;

-- 2) owner/manager can insert + update staff profiles in their restaurant
--    (previously only one's own row was allowed — in-app staff management
--    needs this)
drop policy if exists profiles_insert_own on profiles;
drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles
  for insert to authenticated with check (
    auth.uid() = id
    or restaurant_id = public.my_restaurant_id()
    or public.am_super_admin()
  );

drop policy if exists profiles_update_own on profiles;
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles
  for update to authenticated using (
    auth.uid() = id
    or restaurant_id = public.my_restaurant_id()
    or public.am_super_admin()
  );

-- 3) staff without login (helpers, dishwashers…)
create table if not exists staff_members (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references restaurants (id) on delete cascade,
  name           text not null,
  job_title      text,
  phone          text,
  address        text,
  gender         text check (gender is null or gender in ('male', 'female')),
  photo_url      text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

drop policy if exists staff_members_tenant on staff_members;
create policy staff_members_tenant on staff_members
  for all using (
    restaurant_id = public.my_restaurant_id() or public.am_super_admin()
  );

grant all on public.staff_members to authenticated;

-- 4) storage buckets: menu item photos + staff photos
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('staff-photos', 'staff-photos', true)
on conflict (id) do nothing;

-- menu-images policies
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

-- staff-photos policies
drop policy if exists "staff-photos public read" on storage.objects;
create policy "staff-photos public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'staff-photos');

drop policy if exists "staff-photos staff insert" on storage.objects;
create policy "staff-photos staff insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'staff-photos'
    and ((storage.foldername(name))[1] = public.my_restaurant_id()::text or public.am_super_admin())
  );

drop policy if exists "staff-photos staff update" on storage.objects;
create policy "staff-photos staff update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'staff-photos'
    and ((storage.foldername(name))[1] = public.my_restaurant_id()::text or public.am_super_admin())
  );

drop policy if exists "staff-photos staff delete" on storage.objects;
create policy "staff-photos staff delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'staff-photos'
    and ((storage.foldername(name))[1] = public.my_restaurant_id()::text or public.am_super_admin())
  );
