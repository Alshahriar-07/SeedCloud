-- Seed Cloud — 512 MB default per-user storage quota
--
-- RUN THIS EXACT FILE IN THE SUPABASE SQL EDITOR (Dashboard -> SQL Editor ->
-- New query -> paste -> Run). Idempotent: safe to re-run.
--
-- This migration is self-contained. It works whether the live database has
-- NEVER had the Seed Cloud schema applied (only a legacy empty `files` table)
-- or already has `public.user_storage` from an older migration. It does NOT
-- depend on db/schema.sql or db/migration_google_storage.sql having been run.
--
-- What it does:
--   1. Creates public.user_storage (if missing) with the correct columns,
--      defaults, UNIQUE(user_id) and a foreign key to auth.users.
--   2. Idempotently fixes defaults: storage_limit = 536870912 (512 MiB),
--      storage_used = 0.
--   3. Backfills a storage row for EVERY existing auth user
--      (storage_limit = 536870912, storage_used = 0).
--   4. Converts existing users from the old 1 GiB limit to 512 MiB, PRESERVING
--      storage_used. No files are deleted. Users already over 512 MiB are
--      marked is_over_quota = true so uploads are blocked until usage drops.
--   5. Installs RLS + policies so a user can only read/update their own row and
--      revokes UPDATE on storage_limit / storage_used / is_over_quota /
--      root_folder_id from anon + authenticated (quota is never client-settable).
--   6. Installs a trigger on auth.users that creates each NEW user's storage
--      record exactly once (536870912, 0). user_id is the primary key + unique
--      index, so a user can never get duplicate storage rows, even if the
--      backend's lazy ensureUserStorage() fallback races with the trigger.

-- 1. Create the per-user storage table if it does not exist.
create table if not exists public.user_storage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  storage_limit bigint not null default 536870912, -- 512 MiB per Seed Cloud user
  storage_used bigint not null default 0,
  is_over_quota boolean not null default false,
  root_folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Idempotent guards for a table created by an older migration (old 1 GiB
--    default). Adding columns / changing defaults on a brand-new table is a no-op.
alter table public.user_storage add column if not exists is_over_quota boolean not null default false;
alter table public.user_storage alter column storage_limit set default 536870912;
alter table public.user_storage alter column storage_used set default 0;

-- Ensure UNIQUE(user_id) even if the primary key is somehow missing.
create unique index if not exists user_storage_user_id_key on public.user_storage (user_id);

-- Ensure the foreign key to auth.users (idempotent).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_storage_user_id_fkey') then
    alter table public.user_storage add constraint user_storage_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end $$;

-- 3. Create a storage row for EVERY existing auth user. The column defaults
--    supply storage_limit = 536870912 and storage_used = 0. Idempotent.
insert into public.user_storage (user_id)
select u.id
from auth.users u
on conflict (user_id) do nothing;

-- 4. Existing users: convert the old 1 GiB limit to 512 MiB WITHOUT touching
--    storage_used and WITHOUT deleting any files. Only rows whose limit is
--    above 512 MiB are adjusted. Users already using more than 512 MiB are
--    marked over-quota so new uploads are blocked until they free up space.
update public.user_storage
set storage_limit = 536870912,
    is_over_quota  = (coalesce(storage_used, 0) > 536870912),
    updated_at     = now()
where storage_limit > 536870912;

-- 5. RLS + policies (drop-then-create so this is safe to re-run).
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

-- Users must never set their own quota, usage, over-quota flag or Drive folder id.
revoke update (storage_limit) on public.user_storage from anon, authenticated;
revoke update (storage_used) on public.user_storage from anon, authenticated;
revoke update (is_over_quota) on public.user_storage from anon, authenticated;
revoke update (root_folder_id) on public.user_storage from anon, authenticated;

-- 6. Trigger: automatically create each new user's storage record exactly once
--    (storage_limit = 536870912, storage_used = 0). user_id is the primary key
--    + unique index, so duplicates are impossible even if this runs alongside
--    the backend's lazy ensureUserStorage() fallback. Idempotent.
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
--   select count(*) from public.user_storage where storage_limit <> 536870912;              -- expect 0
--   select count(*) from public.user_storage where storage_used > storage_limit;            -- expect 0 (all over-quota users are flagged, usage preserved)
--   select user_id, storage_limit, storage_used, is_over_quota from public.user_storage order by created_at;
--   select tgname from pg_trigger where tgname = 'on_auth_user_create_storage';              -- expect 1 row