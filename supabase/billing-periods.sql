-- OrderKar: replace plan tiers (starter/pro/enterprise) with billing periods
-- (monthly/6month/yearly). Single plan for all restaurants, 14-day trial.
--
-- Run this in the Supabase SQL editor. Safe to re-run.

-- ── restaurants.subscription_tier ──────────────────────────────────────────
alter table public.restaurants drop constraint if exists restaurants_subscription_tier_check;

update public.restaurants
set subscription_tier = 'monthly'
where subscription_tier not in ('monthly', '6month', 'yearly');

alter table public.restaurants
  alter column subscription_tier set default 'monthly';

alter table public.restaurants
  add constraint restaurants_subscription_tier_check
  check (subscription_tier in ('monthly', '6month', 'yearly'));

-- ── subscriptions.plan_type ────────────────────────────────────────────────
alter table public.subscriptions drop constraint if exists subscriptions_plan_type_check;

update public.subscriptions
set plan_type = 'monthly'
where plan_type not in ('monthly', '6month', 'yearly');

alter table public.subscriptions
  add constraint subscriptions_plan_type_check
  check (plan_type in ('monthly', '6month', 'yearly'));
