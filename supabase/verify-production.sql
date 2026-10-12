-- OrderKar — Production verification script (READ-ONLY).
-- Run AFTER the four Milestone 1/1.5 migrations in Supabase SQL Editor:
--   1. supabase/security-milestone1.sql
--   2. supabase/anon-order-rpc.sql
--   3. supabase/inventory-atomic.sql
--   4. supabase/perf-indexes.sql
-- Then run THIS file. It prints PASS/FAIL lines via RAISE NOTICE.
-- Nothing is modified — every block is a SELECT / catalog check only.
-- NOTE: This file uses only plain SQL + DO blocks (no psql backslash commands)
-- so it runs cleanly in the Supabase SQL Editor.

-- ═══════════════════════════════════════════════════════════════════
-- Helper: PASS/FAIL printer
-- ═══════════════════════════════════════════════════════════════════
do $$
begin
  raise notice '═══════════════════════════════════════════════════';
  raise notice 'OrderKar PRODUCTION VERIFICATION — %', now();
  raise notice '═══════════════════════════════════════════════════';
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- A1. Every public table has RLS enabled
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  bad text;
begin
  select string_agg(c.relname, ', ')
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;
  if bad is null then
    raise notice 'PASS  A1  RLS enabled on all public tables';
  else
    raise notice 'FAIL  A1  RLS MISSING on: %', bad;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- A2. staff_members has RLS enabled (was missing in base schema)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  ok boolean;
begin
  select c.relrowsecurity into ok
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'staff_members';
  if ok then
    raise notice 'PASS  A2  staff_members has RLS enabled';
  else
    raise notice 'FAIL  A2  staff_members RLS NOT enabled (run fixes-2026-10-11.sql)';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- A3. subscriptions: owner/super_admin-only write policies exist
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  n_write int;
begin
  select count(*) into n_write
  from pg_policies
  where schemaname = 'public' and tablename = 'subscriptions'
    and cmd in ('INSERT', 'UPDATE', 'DELETE');
  if n_write >= 3 then
    raise notice 'PASS  A3  subscriptions has % write policies (expect owner/super_admin-only)', n_write;
  else
    raise notice 'FAIL  A3  subscriptions has only % write policies (need INSERT+UPDATE+DELETE)', n_write;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- A4. anon cannot INSERT/UPDATE subscriptions (no permissive anon policy)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  bad int;
begin
  select count(*) into bad
  from pg_policies
  where schemaname = 'public' and tablename = 'subscriptions'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and (roles::text ilike '%anon%' or qual = 'true' or with_check = 'true');
  if bad = 0 then
    raise notice 'PASS  A4  no anon/permissive write policy on subscriptions';
  else
    raise notice 'FAIL  A4  % anon/permissive write policies on subscriptions', bad;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- A5. anon cannot UPDATE orders.payment_status directly
--     (no anon UPDATE policy on orders at all)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  bad int;
begin
  select count(*) into bad
  from pg_policies
  where schemaname = 'public' and tablename = 'orders'
    and cmd in ('UPDATE', 'ALL')
    and roles::text ilike '%anon%';
  if bad = 0 then
    raise notice 'PASS  A5  anon has no UPDATE policy on orders';
  else
    raise notice 'FAIL  A5  anon UPDATE policy exists on orders (% rows)', bad;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- A6. anon order creation goes through create_anon_order RPC only
--     (anon INSERT on orders should be absent or tightly constrained)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  n_anon_insert int;
  rpc_ok boolean;
begin
  select count(*) into n_anon_insert
  from pg_policies
  where schemaname = 'public' and tablename = 'orders'
    and cmd in ('INSERT', 'ALL')
    and roles::text ilike '%anon%';

  select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_anon_order' and p.prosecdef
  ) into rpc_ok;

  if n_anon_insert = 0 and rpc_ok then
    raise notice 'PASS  A6  anon has no direct INSERT on orders; create_anon_order RPC exists (SECURITY DEFINER)';
  elsif n_anon_insert = 0 then
    raise notice 'FAIL  A6  anon INSERT blocked but create_anon_order RPC missing/not SECURITY DEFINER';
  else
    raise notice 'FAIL  A6  anon still has direct INSERT policy on orders (% rows) — RPC bypass possible', n_anon_insert;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- A7. append_order_items requires tracking token or staff
--     (function source must reference tracking_token)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  src text;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'append_order_items'
  order by p.oid desc limit 1;
  if src is null then
    raise notice 'FAIL  A7  append_order_items function NOT FOUND';
  elsif src ilike '%tracking_token%' then
    raise notice 'PASS  A7  append_order_items references tracking_token (auth enforced)';
  else
    raise notice 'FAIL  A7  append_order_items has no tracking_token check (vulnerable overload?)';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- A8. Restaurant slug/name/logo updates restricted (trigger exists)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  ok boolean;
begin
  select exists(
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'restaurants'
      and t.tgname ilike '%protect_identity%'
  ) into ok;
  if ok then
    raise notice 'PASS  A8  restaurants identity-protection trigger present';
  else
    raise notice 'FAIL  A8  restaurants identity-protection trigger MISSING (slug/name unprotected)';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- A9. orders_tenant_guard validates NULL table_id
--     (trigger function source must NOT early-return on null table)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  src text;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'orders_tenant_guard'
  limit 1;
  if src is null then
    raise notice 'FAIL  A9  orders_tenant_guard function NOT FOUND';
  elsif src ilike '%table is required%' or (src ilike '%table_id is null%' and src ilike '%reject%') then
    raise notice 'PASS  A9  orders_tenant_guard handles NULL table_id';
  else
    raise notice 'FAIL  A9  orders_tenant_guard may skip NULL table_id (check source)';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- B1. create_anon_order exists
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  ok boolean;
begin
  select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_anon_order'
  ) into ok;
  if ok then raise notice 'PASS  B1  create_anon_order exists';
  else raise notice 'FAIL  B1  create_anon_order MISSING (run anon-order-rpc.sql)'; end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- B2. append_order_items exists (4-arg hardened signature)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  nargs int;
begin
  select p.pronargs into nargs
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'append_order_items'
  order by p.oid desc limit 1;
  if nargs = 4 then
    raise notice 'PASS  B2  append_order_items has 4-arg hardened signature';
  elsif nargs is null then
    raise notice 'FAIL  B2  append_order_items NOT FOUND';
  else
    raise notice 'FAIL  B2  append_order_items has % args (expected 4 — old overload?)', nargs;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- B3. Atomic inventory RPCs exist
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  d_ok boolean; r_ok boolean;
begin
  select exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='deduct_inventory_atomic') into d_ok;
  select exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.proname='restock_inventory_atomic') into r_ok;
  if d_ok and r_ok then raise notice 'PASS  B3  deduct_inventory_atomic + restock_inventory_atomic exist';
  else raise notice 'FAIL  B3  inventory RPCs missing (deduct=%, restock=%) — run inventory-atomic.sql', d_ok, r_ok; end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- B4. RPCs are SECURITY DEFINER where required
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  bad text;
begin
  select string_agg(p.proname, ', ') into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('create_anon_order','append_order_items','deduct_inventory_atomic','restock_inventory_atomic','track_order','stripe_webhook_apply')
    and not p.prosecdef;
  if bad is null then
    raise notice 'PASS  B4  all security-critical RPCs are SECURITY DEFINER';
  else
    raise notice 'FAIL  B4  NOT security definer: %', bad;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- B5. create_anon_order validates server-side (source inspection)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  src text;
  checks int := 0;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_anon_order' limit 1;
  if src is null then
    raise notice 'FAIL  B5  create_anon_order NOT FOUND';
    return;
  end if;
  if src ilike '%menu_items%' and src ilike '%unit_price%' then checks := checks + 1; end if;
  if src ilike '%is_available%' then checks := checks + 1; end if;
  if src ilike '%unpaid%' then checks := checks + 1; end if;
  if src ilike '%quantity%' and (src ilike '%1%' and src ilike '%20%') then checks := checks + 1; end if;
  if checks = 4 then
    raise notice 'PASS  B5  create_anon_order does server-side price/availability/status/qty checks';
  else
    raise notice 'FAIL  B5  create_anon_order missing server-side checks (%/4 found)', checks;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- C. Index verification
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  required text[][] := array[
    ['orders','orders.table_id'],
    ['orders','orders.restaurant_id + created_at'],
    ['order_items','order_items.menu_item_id'],
    ['order_items','order_items.order_id'],
    ['recipes','recipes.menu_item_id'],
    ['recipes','ingredient_id'],
    ['waste_logs','waste_logs.restaurant_id + logged_at'],
    ['reviews','reviews.order_id'],
    ['activity_log','activity_log.restaurant_id + created_at']
  ];
  -- column patterns to search for in index definitions
  patterns text[] := array[
    'table_id', 'restaurant_id.*created_at', 'menu_item_id', 'order_id',
    'menu_item_id', 'ingredient_id', 'restaurant_id.*logged_at', 'order_id',
    'restaurant_id.*created_at'
  ];
  tbls text[] := array[
    'orders','orders','order_items','order_items','recipes','recipes',
    'waste_logs','reviews','activity_log'
  ];
  i int; found boolean; missing text := '';
begin
  for i in 1..array_length(required, 1) loop
    select exists(
      select 1 from pg_indexes
      where schemaname = 'public' and tablename = tbls[i]
        and indexdef ~* patterns[i]
    ) into found;
    if found then
      raise notice 'PASS  C%  index present: %', i, required[i][2];
    else
      raise notice 'FAIL  C%  index MISSING: %', i, required[i][2];
      missing := missing || required[i][2] || '; ';
    end if;
  end loop;
  if missing = '' then
    raise notice 'PASS  C   all 9 required indexes present';
  else
    raise notice 'FAIL  C   missing indexes: %', missing;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- D1. activity_log table exists
-- ═══════════════════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.activity_log') is not null then
    raise notice 'PASS  D1  activity_log table exists';
  else
    raise notice 'FAIL  D1  activity_log table MISSING';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- D2. activity_log has RLS enabled
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  ok boolean;
begin
  select c.relrowsecurity into ok
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'activity_log';
  if ok then raise notice 'PASS  D2  activity_log has RLS enabled';
  else raise notice 'FAIL  D2  activity_log RLS NOT enabled'; end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- D3. activity_log required indexes exist
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  r_ok boolean; a_ok boolean;
begin
  select exists(select 1 from pg_indexes where schemaname='public' and tablename='activity_log' and indexdef ~* 'restaurant_id') into r_ok;
  select exists(select 1 from pg_indexes where schemaname='public' and tablename='activity_log' and indexdef ~* 'actor_id') into a_ok;
  if r_ok and a_ok then raise notice 'PASS  D3  activity_log has restaurant_id + actor_id indexes';
  else raise notice 'FAIL  D3  activity_log indexes missing (restaurant=%, actor=%)', r_ok, a_ok; end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- D4. activity_log is append-only (no UPDATE/DELETE for anon or staff)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  bad int;
begin
  select count(*) into bad
  from pg_policies
  where schemaname = 'public' and tablename = 'activity_log'
    and cmd in ('UPDATE', 'DELETE', 'ALL');
  if bad = 0 then
    raise notice 'PASS  D4  activity_log has no UPDATE/DELETE policies (append-only)';
  else
    raise notice 'FAIL  D4  activity_log has % UPDATE/DELETE/ALL policies (audit tamper risk)', bad;
  end if;
end $$;

do $$
begin
  raise notice '═══════════════════════════════════════════════════';
  raise notice 'SECTION E — Policy-hardening follow-up (policy-hardening.sql)';
  raise notice '═══════════════════════════════════════════════════';
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- E1. anon INSERT policies on orders/order_items are GONE
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  n int;
begin
  select count(*) into n
  from pg_policies
  where schemaname = 'public'
    and ((tablename = 'orders' and policyname = 'orders_anon_insert')
      or (tablename = 'order_items' and policyname = 'order_items_anon_insert'));
  if n = 0 then
    raise notice 'PASS  E1  anon INSERT policies on orders/order_items removed';
  else
    raise notice 'FAIL  E1  % anon INSERT policies still exist (direct anon insert possible)', n;
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- E2. anon INSERT policy on activity_log is GONE
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  n int;
begin
  select count(*) into n
  from pg_policies
  where schemaname = 'public' and tablename = 'activity_log'
    and policyname = 'activity_log_anon_insert';
  if n = 0 then
    raise notice 'PASS  E2  activity_log anon INSERT policy removed';
  else
    raise notice 'FAIL  E2  activity_log anon INSERT policy still exists (spam risk)';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- E3. restaurants_update restricted to owner/manager/super_admin
--     (waiter/kitchen must NOT satisfy the policy)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  poldef text;
begin
  select pg_get_expr(c.relrowsecurity, c.oid) into poldef
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'restaurants' limit 1;

  -- Check the policy definition mentions owner/manager role restriction
  select string_agg(definition, ' | ') into poldef
  from (
    select pg_get_expr(pol.polqual, pol.polrelid) as definition
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'restaurants'
      and pol.polcmd = 'w'
  ) s;
  if poldef ilike '%owner%' and poldef ilike '%manager%' then
    raise notice 'PASS  E3  restaurants UPDATE policy references owner/manager roles';
  else
    raise notice 'FAIL  E3  restaurants UPDATE policy not role-restricted (def: %)', left(coalesce(poldef,'<none>'), 200);
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- E4. Anon order activity trigger exists (replaces anon logging)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  ok boolean;
begin
  select exists(
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'orders'
      and t.tgname = 'trg_log_anon_order_created'
  ) into ok;
  if ok then
    raise notice 'PASS  E4  anon order activity trigger present (server-side logging)';
  else
    raise notice 'FAIL  E4  anon order activity trigger MISSING';
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- E5. create_anon_order still exists and is callable (not broken by hardening)
-- ═══════════════════════════════════════════════════════════════════
do $$
declare
  ok boolean;
begin
  select exists(
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_anon_order' and p.prosecdef
  ) into ok;
  if ok then
    raise notice 'PASS  E5  create_anon_order intact (SECURITY DEFINER)';
  else
    raise notice 'FAIL  E5  create_anon_order missing or not SECURITY DEFINER';
  end if;
end $$;

do $$
begin
  raise notice '═══════════════════════════════════════════════════';
  raise notice 'NOTE: Behavioral tests (E6-E12) require role switching.';
  raise notice 'Run them manually in SQL Editor with different API keys:';
  raise notice '  E6  anon INSERT orders       → expect RLS DENY';
  raise notice '  E7  anon INSERT order_items  → expect RLS DENY';
  raise notice '  E8  anon INSERT activity_log → expect RLS DENY';
  raise notice '  E9  manager UPDATE slug      → expect trigger DENY';
  raise notice '  E10 owner UPDATE slug        → expect SUCCESS';
  raise notice '  E11 create_anon_order (anon) → expect SUCCESS jsonb';
  raise notice '  E12 waiter INSERT orders     → expect SUCCESS';
  raise notice 'See policy-hardening.sql header for exact queries.';
  raise notice '═══════════════════════════════════════════════════';
end $$;

do $$
begin
  raise notice '═══════════════════════════════════════════════════';
  raise notice 'VERIFICATION COMPLETE — review any FAIL lines above.';
  raise notice '═══════════════════════════════════════════════════';
end $$;
