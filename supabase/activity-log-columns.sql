-- Add columns that were added to activity-log.sql after the table was first created.
-- `create table if not exists` does NOT backfill columns, so this is needed
-- for databases where the older version ran first. Safe to re-run.
alter table public.activity_log
  add column if not exists ip_address text,
  add column if not exists user_agent text;
