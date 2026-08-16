-- Seed Cloud — storage ROUTER metadata migration
--
-- RUN THIS EXACT FILE IN THE SUPABASE SQL EDITOR (Dashboard -> SQL Editor ->
-- New query -> paste -> Run). Idempotent: safe to re-run.
--
-- Seed Cloud is a CLOUD STORAGE ROUTER. Actual file bytes live ONLY on the
-- user's connected third-party providers (their pCloud, their own Google Drive,
-- ...). Supabase stores ONLY:
--   * auth (Supabase Auth)
--   * the user's logical Seed Cloud quota (user_storage)
--   * file metadata (files) — where each file lives on a connected provider
--   * provider connection metadata (connected_accounts), incl. the refresh
--     token for providers whose access tokens expire (e.g. Google Drive)
--
-- This migration is self-contained. It works whether the live database has
-- NEVER had the Seed Cloud schema applied (only a legacy empty `files` table)
-- or already has parts of db/schema.sql.
--
-- What it does:
--   1. Renames a legacy empty `files` table (no `name` column) to `files_legacy`
--      and creates the real `files` metadata table with a `connected_account_id`
--      column that points at the provider account holding each file.
--   2. Adds RLS + policies so a user can only read/update/delete their own
--      files, and revokes client writes to ownership/size/provider id columns.
--   3. Adds `refresh_token` (encrypted, server-side only) to connected_accounts
--      for providers whose access tokens expire.
--   4. Creates public.user_storage (512 MiB quota) + the trigger that creates
--      each new user's storage record exactly once. Idempotent, so it is safe
--      to run whether or not db/migration_512mb_storage.sql was applied.
--
-- There is NO internal/default storage backend (no storage_accounts table, no
-- Seed Cloud Google Drive account, no Supabase Storage bucket).

-- 1a. Preserve a legacy incompatible `files` table (from an early prototype; no
--     `name` column) under a different name. It is EMPTY, so nothing is lost.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'files'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'files' and column_name = 'name'
  ) then
    alter table public.files rename to files_legacy;
  end if;
end $$;

-- 1b. File METADATA. Bytes stay on the user's connected provider. Each row
--     records which provider account holds the file (connected_account_id).
create table if not exists public.files (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  mime_type text,
  size bigint not null default 0,
  provider text not null default 'pcloud',
  provider_file_id text not null,
  connected_account_id bigint references public.connected_accounts (id) on delete set null,
  parent_folder_id text,
  is_folder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_file_id)
);

create index if not exists files_user_idx on public.files (user_id);
create index if not exists files_user_parent_idx on public.files (user_id, parent_folder_id);

alter table public.files enable row level security;

drop policy if exists "users select own files" on public.files;
create policy "users select own files"
  on public.files for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users insert own files" on public.files;
create policy "users insert own files"
  on public.files for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update own files" on public.files;
create policy "users update own files"
  on public.files for update to authenticated using (auth.uid() = user_id);

drop policy if exists "users delete own files" on public.files;
create policy "users delete own files"
  on public.files for delete to authenticated using (auth.uid() = user_id);

-- Users cannot forge ownership, sizes or provider ids from the client. All
-- writes go through the backend with the service_role key (bypasses these).
revoke insert (user_id, size, provider_file_id) on public.files from anon, authenticated;
revoke update (user_id, size, provider_file_id) on public.files from anon, authenticated;

-- 3. Refresh token column for connected provider accounts. Stored encrypted,
--    read only by the backend (service_role bypasses RLS + column revokes).
alter table public.connected_accounts add column if not exists refresh_token text;
revoke select (refresh_token) on public.connected_accounts from anon, authenticated;
revoke update (refresh_token) on public.connected_accounts from anon, authenticated;

-- 4. Per-user Seed Cloud logical quota (default 512 MiB / 536,870,912 bytes).
--    This is Seed Cloud's own allowance, independent of connected providers'
--    physical capacity. Idempotent (same table + trigger as migration_512mb).
create table if not exists public.user_storage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  storage_limit bigint not null default 536870912,
  storage_used bigint not null default 0,
  is_over_quota boolean not null default false,
  root_folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_storage add column if not exists is_over_quota boolean not null default false;
alter table public.user_storage alter column storage_limit set default 536870912;
alter table public.user_storage alter column storage_used set default 0;
create unique index if not exists user_storage_user_id_key on public.user_storage (user_id);

insert into public.user_storage (user_id)
select u.id from auth.users u
on conflict (user_id) do nothing;

update public.user_storage
set storage_limit = 536870912,
    is_over_quota  = (coalesce(storage_used, 0) > 536870912),
    updated_at     = now()
where storage_limit > 536870912;

alter table public.user_storage enable row level security;

drop policy if exists "users select own storage" on public.user_storage;
create policy "users select own storage"
  on public.user_storage for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users insert own storage" on public.user_storage;
create policy "users insert own storage"
  on public.user_storage for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update own storage" on public.user_storage;
create policy "users update own storage"
  on public.user_storage for update to authenticated using (auth.uid() = user_id);

revoke update (storage_limit) on public.user_storage from anon, authenticated;
revoke update (storage_used) on public.user_storage from anon, authenticated;
revoke update (is_over_quota) on public.user_storage from anon, authenticated;
revoke update (root_folder_id) on public.user_storage from anon, authenticated;

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

-- Optional verification (run separately after this migration):
--   select count(*) from public.files;                                              -- expect 0
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='connected_accounts'
--     and column_name='refresh_token';                                              -- expect 1 row
--   select count(*) from public.user_storage where storage_limit <> 536870912;      -- expect 0
