-- Seed Cloud — migrate the default per-user storage quota from 1 GB to 512 MB
--
-- RUN THIS EXACT FILE IN THE SUPABASE SQL EDITOR.
--
-- Edits to the local db/*.sql files do NOT touch the live database. This
-- migration must be run manually in the Supabase SQL editor (Dashboard -> SQL
-- Editor -> New query -> paste -> Run). It is idempotent and safe to re-run.
--
-- What it does:
--   1. Adds `is_over_quota` to user_storage (existing tables).
--   2. Changes the column default for new rows to 536,870,912 bytes (512 MiB).
--   3. Migrates existing users: storage_limit 1 GiB -> 512 MiB, PRESERVING
--      storage_used. No files are deleted. Users already over 512 MiB are marked
--      is_over_quota = true so uploads are blocked until usage is reduced.
--   4. Installs a trigger that creates each new user's storage record exactly
--      once (storage_limit = 536870912, storage_used = 0). The user_id primary
--      key makes duplicates impossible.
--
-- Run AFTER db/schema.sql and db/migration_provider_files.sql.

-- 1. Existing tables: add the over-quota flag and the new default limit.
alter table public.user_storage add column if not exists is_over_quota boolean not null default false;
alter table public.user_storage alter column storage_limit set default 536870912;

-- 2 + 3. Migrate existing users from the old 1 GiB limit to 512 MiB.
--        Preserves storage_used. Never deletes files. Users already over
--        512 MiB are marked over-quota (uploads blocked until usage drops).
update public.user_storage
set storage_limit = 536870912,
    is_over_quota  = (coalesce(storage_used, 0) > 536870912),
    updated_at     = now()
where storage_limit > 536870912;

-- 4. New users: automatically create the storage record exactly once.
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

-- Optional sanity checks (run separately if you want to verify):
--   select count(*) from public.user_storage where storage_limit <> 536870912;            -- expect 0
--   select count(*) from public.user_storage where is_over_quota and storage_used <= 536870912; -- expect 0