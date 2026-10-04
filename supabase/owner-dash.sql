-- OrderKar owner dashboard upgrade: cancellation reasons.
-- Run once in Supabase SQL editor. Idempotent.

alter table public.orders
  add column if not exists cancel_reason text;
