-- ═══════════════════════════════════════════════════════════════════════════
-- OrderKar SECURITY FIXES — run ONCE in Supabase SQL editor (whole file).
-- Idempotent: safe to re-run.
--
-- Section 1: sequence grants + ingredients column + data
-- Section 2: profiles role-guard trigger (blocks manager role escalation)
-- Section 3: per-order tracking tokens (closes open anon order reads)
-- ═══════════════════════════════════════════════════════════════════════════


-- ── Section 1a: sequence grants (order numbers for QR customers) ────────────
grant usage, select on sequence public.order_number_seq to anon;
grant usage, select on sequence public.order_number_seq to authenticated;

-- ── Section 1b: ingredients column + demo data ──────────────────────────────
alter table public.menu_items add column if not exists ingredients text;

update public.menu_items set ingredients = 'Chicken tikka, beef seekh kebab, malai boti, grilled wings, yoghurt, ajwain, garam masala, lemon' where name = 'BBQ Platter (Serves 2)';
update public.menu_items set ingredients = 'Beef, basmati rice, yoghurt, tomatoes, fried onions, biryani masala, saffron, mint' where name = 'Beef Biryani';
update public.menu_items set ingredients = 'Smashed beef patty, cheddar cheese, brioche bun, lettuce, tomato, burger sauce' where name = 'Beef Smash Burger';
update public.menu_items set ingredients = 'Beef strips, mustard oil, poppy seeds, yoghurt, behari masala, green chillies' where name = 'Behari Boti';
update public.menu_items set ingredients = 'Refined flour, mozzarella cheese, butter, yeast, salt' where name = 'Cheese Naan';
update public.menu_items set ingredients = 'Chicken, basmati rice, yoghurt, tomatoes, fried onions, biryani masala, green chillies' where name = 'Chicken Biryani';
update public.menu_items set ingredients = 'Egg noodles, chicken strips, cabbage, carrots, capsicum, soy sauce, garlic' where name = 'Chicken Chow Mein';
update public.menu_items set ingredients = 'Basmati rice, chicken, egg, spring onion, carrots, soy sauce' where name = 'Chicken Fried Rice';
update public.menu_items set ingredients = 'Chicken, tomatoes, julienned ginger, green chillies, black pepper, desi ghee' where name = 'Chicken Karahi (Full)';
update public.menu_items set ingredients = 'Chicken, tomatoes, julienned ginger, green chillies, black pepper, desi ghee' where name = 'Chicken Karahi (Half)';
update public.menu_items set ingredients = 'Chicken cubes, capsicum, garlic, ginger, soy sauce, egg-fried rice' where name = 'Chicken Manchurian with Rice';
update public.menu_items set ingredients = 'Chicken, basmati rice, yoghurt, cumin, black cardamom, whole spices' where name = 'Chicken Pulao';
update public.menu_items set ingredients = 'Marinated chicken strips, pita bread, garlic sauce, pickles, fries' where name = 'Chicken Shawarma';
update public.menu_items set ingredients = 'Chicken leg quarter, yoghurt, red chilli, ajwain, lemon, mustard oil' where name = 'Chicken Tikka';
update public.menu_items set ingredients = 'Chicken, seasoned flour coating, spices, deep-fried in oil' where name = 'Crispy Broast (2 pc)';
update public.menu_items set ingredients = 'Moong and chana daal, garlic tarka, cumin seeds, red chilli, desi ghee' where name = 'Daal Fry';
update public.menu_items set ingredients = 'Full-cream milk, strong patti tea leaves, sugar' where name = 'Doodh Patti';
update public.menu_items set ingredients = 'Fresh lime juice, soda water, mint leaves, salt, sugar' where name = 'Fresh Lime Soda';
update public.menu_items set ingredients = 'Refined flour, garlic, butter, fresh coriander, yeast' where name = 'Garlic Naan';
update public.menu_items set ingredients = 'Chicken wings, tikka marinade, red chilli, lemon, charcoal-grilled' where name = 'Grilled Wings (8 pc)';
update public.menu_items set ingredients = 'Khoya, refined flour, sugar syrup, green cardamom, rose water' where name = 'Gulab Jamun (4 pc)';
update public.menu_items set ingredients = 'Chicken strips, mushrooms, bamboo shoot, vinegar, white pepper, egg ribbons' where name = 'Hot & Sour Soup';
update public.menu_items set ingredients = 'Green tea leaves, milk, salt, crushed almonds and pistachios, rose petals' where name = 'Kashmiri Chai';
update public.menu_items set ingredients = 'Rice, full-cream milk, sugar, green cardamom, pistachios' where name = 'Kheer';
update public.menu_items set ingredients = 'Dense kulfi, vermicelli, rose syrup, basil seeds, chopped nuts' where name = 'Kulfi Falooda';
update public.menu_items set ingredients = 'Chicken cubes, roasted peanuts, dried red chillies, soy sauce, vinegar' where name = 'Kung Pao Chicken';
update public.menu_items set ingredients = 'Chicken cubes, fresh cream, cheese, white pepper, green chillies' where name = 'Malai Boti';
update public.menu_items set ingredients = 'Ripe mangoes, chilled milk, sugar, ice' where name = 'Mango Shake';
update public.menu_items set ingredients = 'Mutton, tomatoes, julienned ginger, green chillies, black pepper, desi ghee' where name = 'Mutton Karahi (Half)';
update public.menu_items set ingredients = 'Spinach, paneer cubes, garlic, fresh cream, garam masala' where name = 'Palak Paneer';
update public.menu_items set ingredients = 'Refined flour, sesame seeds, milk, yeast, salt' where name = 'Roghni Naan';
update public.menu_items set ingredients = 'Hand-minced beef, green chillies, fresh coriander, garam masala' where name = 'Seekh Kebab (4 pc)';
update public.menu_items set ingredients = 'Fried bread slices, rabri, sugar syrup, almonds, pistachios, cardamom' where name = 'Shahi Tukray';
update public.menu_items set ingredients = 'Whole wheat flour, water, salt, baked in clay tandoor' where name = 'Tandoori Roti (2 pc)';
update public.menu_items set ingredients = 'Basmati rice, cumin seeds, desi ghee, salt' where name = 'Zeera Rice';
update public.menu_items set ingredients = 'Crispy fried chicken fillet, sesame bun, mayonnaise, lettuce' where name = 'Zinger Burger';


-- ── Section 2: profiles role-guard trigger ───────────────────────────────────
-- DB-level enforcement (the app UI already restricts roles, but a crafted
-- request could previously escalate: a manager could make themselves owner,
-- deactivate the owner, or grant super-admin).
--
-- Rules:
--  • only a super_admin can set is_super_admin (or touch a super-admin row)
--  • signup: a brand-new user may only create their OWN owner profile
--  • owner: may add/manage owner|manager|kitchen|waiter in their restaurant
--  • manager: may only add/manage kitchen|waiter in their restaurant
--           (cannot touch owner/manager rows, cannot change their own role)
--  • everyone: may edit their own name/phone/photo/etc, but never their own
--    role, restaurant, is_active or super-admin flag

create or replace function public.profiles_role_guard()
returns trigger
language plpgsql
security definer
as $$
declare
  actor_id    uuid := auth.uid();
  actor_role  text;
  actor_rest  uuid;
  actor_super boolean;
begin
  select coalesce(p.is_super_admin, false), p.role, p.restaurant_id
    into actor_super, actor_role, actor_rest
    from public.profiles p where p.id = actor_id;

  -- Direct DB access (SQL editor / service_role): trusted admin path, no guard.
  if actor_id is null then
    return NEW;
  end if;

  if coalesce(actor_super, false) then
    return NEW; -- super admin: no restrictions
  end if;

  if coalesce(NEW.is_super_admin, false) then
    raise exception 'Only a super admin can grant super-admin.';
  end if;

  if TG_OP = 'INSERT' then
    -- signup path: brand-new user creating their own owner profile
    if NEW.id = actor_id and actor_role is null then
      if NEW.role <> 'owner' then
        raise exception 'New accounts can only sign up as owner.';
      end if;
      return NEW;
    end if;

    if actor_role = 'owner' then
      if NEW.restaurant_id is distinct from actor_rest then
        raise exception 'Owner can only add staff to their own restaurant.';
      end if;
      if NEW.role not in ('owner', 'manager', 'kitchen', 'waiter') then
        raise exception 'Invalid role.';
      end if;
      return NEW;
    elsif actor_role = 'manager' then
      if NEW.restaurant_id is distinct from actor_rest then
        raise exception 'Manager can only add staff to their own restaurant.';
      end if;
      if NEW.role not in ('kitchen', 'waiter') then
        raise exception 'Managers can only create kitchen/waiter accounts.';
      end if;
      return NEW;
    else
      raise exception 'Not allowed to create profiles.';
    end if;
  else
    -- UPDATE
    if OLD.restaurant_id is distinct from actor_rest then
      raise exception 'Not allowed: different restaurant.';
    end if;
    if coalesce(OLD.is_super_admin, false) then
      raise exception 'Only a super admin can modify a super-admin profile.';
    end if;

    -- self-service: own non-privileged fields only
    if NEW.id = actor_id then
      if NEW.role is distinct from OLD.role
        or NEW.restaurant_id is distinct from OLD.restaurant_id
        or NEW.is_active is distinct from OLD.is_active then
        raise exception 'You cannot change your own role, restaurant or status.';
      end if;
      return NEW;
    end if;

    if actor_role = 'owner' then
      if NEW.restaurant_id is distinct from OLD.restaurant_id then
        raise exception 'Cannot move staff to another restaurant.';
      end if;
      if NEW.role not in ('owner', 'manager', 'kitchen', 'waiter') then
        raise exception 'Invalid role.';
      end if;
      return NEW;
    elsif actor_role = 'manager' then
      if OLD.role not in ('kitchen', 'waiter') then
        raise exception 'Managers can only manage kitchen/waiter accounts.';
      end if;
      if NEW.role not in ('kitchen', 'waiter') then
        raise exception 'Managers can only assign kitchen/waiter roles.';
      end if;
      if NEW.restaurant_id is distinct from OLD.restaurant_id then
        raise exception 'Cannot move staff to another restaurant.';
      end if;
      return NEW;
    else
      raise exception 'Not allowed to modify profiles.';
    end if;
  end if;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before insert or update on public.profiles
  for each row execute function public.profiles_role_guard();


-- ── Section 3: per-order tracking tokens ─────────────────────────────────────
-- Before: anon could SELECT *every* order (enumeration risk).
-- After: anon cannot read orders at all; customers track ONLY their own order
-- via an unguessable tracking_token through the track_order() RPC.

alter table public.orders
  add column if not exists tracking_token uuid not null default gen_random_uuid();

drop policy if exists orders_anon_select on orders;
drop policy if exists order_items_anon_select on order_items;
revoke select on public.orders from anon;
revoke select on public.order_items from anon;

create or replace function public.track_order(p_token uuid)
returns jsonb
language sql
security definer
stable
as $$
  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'total_amount', o.total_amount,
    'created_at', o.created_at,
    'table_number', t.table_number,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_name', oi.item_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'notes', oi.notes
      ) order by oi.item_name)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  left join public.tables t on t.id = o.table_id
  where o.tracking_token = p_token
  limit 1;
$$;

grant execute on function public.track_order(uuid) to anon;
grant execute on function public.track_order(uuid) to authenticated;
