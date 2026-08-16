-- Seed Cloud — Serverless-compatible persistent state (Vercel)
-- Run this in the Supabase SQL editor AFTER db/schema.sql. This table is
-- REQUIRED once the backend runs on Vercel serverless functions and OAuth
-- provider connects are used.
--
-- Vercel serverless functions share no process memory, so state that previously
-- lived in an in-process Map (OAuth authorization state) must be persisted here
-- instead. Written and read only by the backend using the service_role key
-- (which bypasses RLS).

-- OAuth authorization state for provider connects
-- (/api/oauth/:slug/start -> /api/oauth/:slug/callback).
-- Rows are single-use (deleted on consume) and expire after 10 minutes.
create table if not exists public.oauth_state (
  state text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  provider text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists oauth_state_expires_idx on public.oauth_state (expires_at);

alter table public.oauth_state enable row level security;
-- No anon/authenticated policies: only the service-role backend touches these
-- rows. The state value is also mirrored to an httpOnly cookie for the browser.
revoke all on public.oauth_state from anon, authenticated;