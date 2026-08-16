-- Seed Cloud — INTERNAL default storage backend (Google Drive)
-- Run this in the Supabase SQL editor AFTER db/schema.sql.
--
-- Seed Cloud stores the real file bytes in the Seed Cloud owner's Google Drive
-- account. Supabase stores only metadata:
--   storage_accounts  - the single backend Google Drive account (tokens, root folder)
--   user_storage      - per-user Seed Cloud quota (1 GB) + user Drive folder id
--   files             - metadata for the user's Seed Cloud files (Drive file ids)

-- The backend storage account (owner's Google Drive). Only the service-role
-- backend ever reads or writes this table.
create table if not exists public.storage_accounts (
  id bigint generated always as identity primary key,
  provider text not null default 'google-drive',
  status text not null default 'pending',
  root_folder_id text,
  refresh_token_enc text,
  account_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider)
);

alter table public.storage_accounts enable row level security;
-- No policies for anon/authenticated: frontend clients cannot touch the backend
-- account or its encrypted credentials. The backend uses the service_role key,
-- which bypasses RLS and column grants.
revoke all on public.storage_accounts from anon, authenticated;

-- Per-user Seed Cloud quota (default 1 GiB) and their Drive folder id.
create table if not exists public.user_storage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  storage_limit bigint not null default 1073741824,
  storage_used bigint not null default 0,
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

-- Users must never set their own quota or Drive folder id.
revoke update (storage_limit) on public.user_storage from anon, authenticated;
revoke update (storage_used) on public.user_storage from anon, authenticated;
revoke update (root_folder_id) on public.user_storage from anon, authenticated;

-- Metadata for the user's Seed Cloud files. Actual bytes live on Google Drive.
-- A legacy empty `files` table from an earlier prototype may exist in the live
-- database with an incompatible shape (no `name` column). If so, preserve it
-- under a different name and create the real table. It is intentionally EMPTY,
-- so no data is lost.
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

create table if not exists public.files (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  mime_type text,
  size bigint not null default 0,
  provider text not null default 'google-drive',
  provider_file_id text not null,
  parent_folder_id text,
  is_folder boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider_file_id)
);

create index if not exists files_user_idx on public.files (user_id);
create index if not exists files_user_parent_idx on public.files (user_id, parent_folder_id);

alter table public.files enable row level security;

create policy "users select own files"
  on public.files for select to authenticated using (auth.uid() = user_id);

create policy "users insert own files"
  on public.files for insert to authenticated with check (auth.uid() = user_id);

create policy "users update own files"
  on public.files for update to authenticated using (auth.uid() = user_id);

create policy "users delete own files"
  on public.files for delete to authenticated using (auth.uid() = user_id);

-- Users cannot forge ownership, sizes or Drive ids from the client. All writes
-- go through the backend with the service_role key (bypasses these revokes).
revoke insert (user_id, size, provider_file_id) on public.files from anon, authenticated;
revoke update (user_id, size, provider_file_id) on public.files from anon, authenticated;