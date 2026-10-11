-- ============================================================================
-- OrderKar — subscription billing (Stripe) columns.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Adds Stripe linkage + trial bookkeeping to public.subscriptions.
-- Status flow: trial -> active -> past_due -> cancelled
-- ============================================================================

alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_start timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

-- Backfill: 14-day trial from start_date for rows missing it.
update public.subscriptions
   set trial_ends_at = (start_date::timestamptz + interval '14 days')
 where trial_ends_at is null;

create index if not exists idx_subscriptions_stripe_customer
  on public.subscriptions (stripe_customer_id);

create index if not exists idx_subscriptions_stripe_sub
  on public.subscriptions (stripe_subscription_id);

-- ============================================================================
-- Webhook applier. The Stripe webhook route has no user session, so it cannot
-- pass the tenant RLS policy. This SECURITY DEFINER function is the narrow
-- bridge: it only accepts allowlisted values and only touches the single
-- subscription row belonging to the given Stripe customer. The route calls it
-- only after verifying the Stripe webhook signature.
-- ============================================================================
create or replace function public.stripe_webhook_apply(
  p_customer_id text,
  p_status text,
  p_plan text,
  p_stripe_sub_id text default null,
  p_price_id text default null,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null,
  p_cancel_at boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub_id uuid;
  v_restaurant_id uuid;
begin
  if p_customer_id is null or p_customer_id = '' then
    raise exception 'customer id required';
  end if;
  if p_status not in ('trial', 'active', 'past_due', 'cancelled') then
    raise exception 'invalid status';
  end if;
  if p_plan not in ('starter', 'pro', 'enterprise') then
    raise exception 'invalid plan';
  end if;

  select id, restaurant_id into v_sub_id, v_restaurant_id
    from public.subscriptions
   where stripe_customer_id = p_customer_id
   order by created_at desc
   limit 1;

  if v_sub_id is null then
    -- First webhook before any row exists (e.g. checkout completed before
    -- our insert raced it): create it from the customer metadata instead.
    return;
  end if;

  update public.subscriptions
     set status = p_status,
         plan_type = p_plan,
         stripe_subscription_id = coalesce(p_stripe_sub_id, stripe_subscription_id),
         stripe_price_id = coalesce(p_price_id, stripe_price_id),
         current_period_start = coalesce(p_period_start, current_period_start),
         current_period_end = coalesce(p_period_end, current_period_end),
         cancel_at_period_end = p_cancel_at
   where id = v_sub_id;

  if p_status = 'cancelled' then
    update public.restaurants set subscription_tier = 'starter' where id = v_restaurant_id;
  elsif p_status = 'active' then
    update public.restaurants set subscription_tier = p_plan where id = v_restaurant_id;
  end if;
end;
$$;

grant execute on function public.stripe_webhook_apply(text, text, text, text, text, timestamptz, timestamptz, boolean)
  to anon, authenticated;
