-- Track when waiter picks up food from kitchen (without completing the order).
-- Table stays occupied until payment is collected.
--
-- Run in Supabase SQL editor. Safe to re-run.

alter table public.orders
  add column if not exists picked_up_at timestamptz;
