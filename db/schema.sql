-- Seed Cloud — Supabase schema
-- Run this in the Supabase SQL editor.

create table if not exists public.storage_providers (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique,
  enabled boolean not null default true,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.connected_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id bigint not null references public.storage_providers (id) on delete cascade,
  provider_account_id text,
  display_name text,
  email text,
  access_token text not null,
  refresh_token text,
  token_type text,
  api_host text,
  status text not null default 'connected',
  storage_total bigint,
  storage_used bigint,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_account_id)
);

create index if not exists connected_accounts_user_idx on public.connected_accounts (user_id);
create index if not exists connected_accounts_provider_idx on public.connected_accounts (provider_id);

-- Migration guards: apply when the table already existed under an older shape.
-- A user may connect several accounts from the same provider, so the old
-- (user_id, provider_id) uniqueness is removed; each connection is identified
-- by its own id, and duplicate accounts of the same provider account are
-- blocked by the (user_id, provider_account_id) key above.
alter table public.connected_accounts drop constraint if exists connected_accounts_user_id_provider_id_key;
alter table public.connected_accounts add column if not exists email text;
alter table public.connected_accounts add column if not exists storage_total bigint;
alter table public.connected_accounts add column if not exists storage_used bigint;
alter table public.connected_accounts add column if not exists refresh_token text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'connected_accounts_user_id_provider_account_id_key'
  ) then
    alter table public.connected_accounts
      add constraint connected_accounts_user_id_provider_account_id_key
      unique (user_id, provider_account_id);
  end if;
end $$;

alter table public.storage_providers enable row level security;
alter table public.connected_accounts enable row level security;

create policy "providers readable by authenticated users"
  on public.storage_providers for select to authenticated using (true);

create policy "users select own connected accounts"
  on public.connected_accounts for select to authenticated using (auth.uid() = user_id);

create policy "users insert own connected accounts"
  on public.connected_accounts for insert to authenticated with check (auth.uid() = user_id);

create policy "users update own connected accounts"
  on public.connected_accounts for update to authenticated using (auth.uid() = user_id);

create policy "users delete own connected accounts"
  on public.connected_accounts for delete to authenticated using (auth.uid() = user_id);

-- Provider credentials must never be readable by normal frontend clients.
-- The backend reads them with the service_role key, which bypasses both RLS
-- and column-level grants. Frontend clients (anon/authenticated) therefore
-- cannot read or overwrite the access_token / refresh_token columns directly.
revoke select (access_token) on public.connected_accounts from anon, authenticated;
revoke update (access_token) on public.connected_accounts from anon, authenticated;
revoke select (refresh_token) on public.connected_accounts from anon, authenticated;
revoke update (refresh_token) on public.connected_accounts from anon, authenticated;

insert into public.storage_providers (name, slug, enabled, capabilities) values
  ('pCloud', 'pcloud', true, '{"oauth":true,"list":true,"upload":true,"download":true,"folder":true,"rename":true,"delete":true,"share":true,"quota":true}'),
  ('Google Drive', 'google-drive', true, '{"oauth":true,"list":true,"upload":true,"download":true,"folder":true,"rename":true,"delete":true,"quota":true}'),
  ('Microsoft OneDrive', 'onedrive', true, '{"oauth":true}'),
  ('Dropbox', 'dropbox', true, '{"oauth":true}'),
  ('Koofr', 'koofr', true, '{"oauth":true}'),
  ('Box', 'box', true, '{"oauth":true}'),
  ('MEGA', 'mega', true, '{}'),
  ('MediaFire', 'mediafire', true, '{}'),
  ('Proton Drive', 'proton-drive', true, '{}'),
  ('Degoo', 'degoo', true, '{}'),
  ('Icedrive', 'icedrive', true, '{}'),
  ('IDrive', 'idrive', true, '{}'),
  ('Apple iCloud', 'icloud', true, '{}'),
  ('Sync.com', 'sync', true, '{}'),
  ('Internxt', 'internxt', true, '{}')
on conflict (slug) do nothing;

-- File location metadata.
-- Actual file bytes live on the provider (e.g. pCloud, Google Drive).
-- This table only records where a file exists.
create table if not exists public.file_locations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  file_size bigint not null default 0,
  mime_type text,
  provider text not null,
  connected_account_id bigint references public.connected_accounts (id) on delete set null,
  provider_file_id text,
  folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists file_locations_user_idx on public.file_locations (user_id);
create index if not exists file_locations_provider_idx on public.file_locations (provider);

alter table public.file_locations enable row level security;

create policy "users select own file locations"
  on public.file_locations for select to authenticated using (auth.uid() = user_id);

create policy "users insert own file locations"
  on public.file_locations for insert to authenticated with check (auth.uid() = user_id);

create policy "users update own file locations"
  on public.file_locations for update to authenticated using (auth.uid() = user_id);

create policy "users delete own file locations"
  on public.file_locations for delete to authenticated using (auth.uid() = user_id);

-- File sharing metadata (UI + data model prepared; real sharing flow to be wired).
-- This only records share metadata; file bytes always stay on the provider.
create table if not exists public.file_shares (
  id bigint generated always as identity primary key,
  file_id bigint references public.file_locations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  shared_with_email text,
  shared_with_user_id uuid references auth.users (id) on delete set null,
  provider text not null,
  provider_file_id text,
  file_name text,
  access_type text not null default 'view',
  status text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists file_shares_user_idx on public.file_shares (user_id);
create index if not exists file_shares_recipient_idx on public.file_shares (shared_with_user_id);

alter table public.file_shares enable row level security;

create policy "users select own shares"
  on public.file_shares for select to authenticated using (auth.uid() = user_id);

create policy "users select shares shared with them"
  on public.file_shares for select to authenticated using (auth.uid() = shared_with_user_id);

create policy "users insert own shares"
  on public.file_shares for insert to authenticated with check (auth.uid() = user_id);

create policy "users update own shares"
  on public.file_shares for update to authenticated using (auth.uid() = user_id);

create policy "users delete own shares"
  on public.file_shares for delete to authenticated using (auth.uid() = user_id);

-- Per-user Seed Cloud quota (default 512 MiB / 536,870,912 bytes). Actual file
-- bytes stay on the connected cloud provider; Supabase stores only quota +
-- usage + file metadata + provider location. There is no internal/default Seed
-- Cloud storage backend.
-- is_over_quota marks accounts whose usage exceeds the limit (migrated from the
-- old 1 GiB default): no files are deleted, but new uploads are blocked until
-- usage drops back under the limit.
create table if not exists public.user_storage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  storage_limit bigint not null default 536870912,
  storage_used bigint not null default 0,
  is_over_quota boolean not null default false,
  root_folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_storage enable row level security;

create policy "users select own storage"
  on public.user_storage for select to authenticated using (auth.uid() = user_id);

create policy "users insert own storage"
  on public.user_storage for insert to authenticated with check (auth.uid() = user_id);

create policy "users update own storage"
  on public.user_storage for update to authenticated using (auth.uid() = user_id);

-- Users must never set their own quota, usage, over-quota flag or Drive folder id.
revoke update (storage_limit) on public.user_storage from anon, authenticated;
revoke update (storage_used) on public.user_storage from anon, authenticated;
revoke update (is_over_quota) on public.user_storage from anon, authenticated;
revoke update (root_folder_id) on public.user_storage from anon, authenticated;

-- Automatically create each new user's storage record exactly once:
-- storage_limit = 536870912 (512 MiB), storage_used = 0. user_id is the primary
-- key, so duplicates are impossible even if this runs alongside the backend's
-- lazy ensureUserStorage() fallback.
create or replace function public.handle_new_user_storage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_storage (user_id, storage_limit, storage_used)
  values (new.id, 536870912, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_create_storage on auth.users;
create trigger on_auth_user_create_storage
after insert on auth.users
for each row execute function public.handle_new_user_storage();
