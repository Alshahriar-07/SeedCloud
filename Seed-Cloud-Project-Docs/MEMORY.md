# Seed Cloud — Project Memory

## Identity
- Product: Seed Cloud (Seed Code ecosystem) — Universal Cloud Storage Router.
- Stack: plain HTML/CSS/JS (`public/`) + Node.js/Express (`server/`) + Supabase Auth & Database. No framework.

## Current phase — Google Drive internal storage backend (in progress)
Every Seed Cloud user gets a 1 GB logical quota. File bytes are stored in Seed Cloud's own Google Drive account (server-side OAuth); Supabase stores ONLY metadata, quota, and auth. The existing Files/Storage/Upload/Download UI is wired to the new `/api/files` + `/api/storage` backend. Migration + Google Drive authorization are the only remaining manual steps.

## Internal storage architecture
- Flow: Browser → Seed Cloud API (`/api/files`, `/api/storage`) → Node backend → Seed Cloud's Google Drive account. Personal provider connections (pCloud/Google Drive) are separate and unaffected.
- Google scope: `https://www.googleapis.com/auth/drive.file`, `access_type=offline&prompt=consent` (forces a refresh token). Tokens are AES-256-GCM encrypted (`TOKEN_ENCRYPTION_SECRET`) and never sent to the frontend.
- Quota: 1 GiB per user (`storage.defaultQuotaBytes` / `DEFAULT_STORAGE_LIMIT = 1073741824`). Enforced in `uploadFile`: `storage_used + size > limit` → HTTP 413 "Storage limit reached. Your Seed Cloud storage limit is 1 GB."
- Folder layout: `Seed Cloud Storage/<user_id>/` — root folder "Seed Cloud Storage" is find-or-create once; per-user folder named by `user_id`. Google folder IDs are persisted in `user_storage`; lookups are by ID, never by name.
- Orphan cleanup: if the DB row insert fails after a Drive upload, the just-created Drive file is deleted best-effort so quota stays consistent. Delete order is Drive-first, then DB row, then quota reduction.
- Upload contract: raw file body with headers `x-file-name` (required) and `x-folder-id` (optional). Frontend mirrors the old pCloud XHR upload pattern and uses `browser.currentFolderId()`.

## Internal storage routes
- `GET  /api/storage` — quota overview for the signed-in user (seed usage + connected provider usage).
- `GET  /api/storage/google/start` — OAuth state + httpOnly cookie `sc_google_state`, returns `{ url }`.
- `GET  /api/storage/google/callback` — validates state, exchanges code, saves encrypted refresh token, ensures root folder, redirects `/storage?storage=connected` or `?storage_error=…`.
- `GET  /api/files` — list root or a folder's children.
- `POST /api/files/upload` — quota-checked raw-body upload.
- `POST /api/files/folders` — create a folder under a parent.
- `GET  /api/files/:id`, `GET /api/files/:id/download`, `PATCH /api/files/:id`, `DELETE /api/files/:id` — read, stream download, rename, delete.
- `/api/config` now returns `googleConfigured` so the frontend can enable/disable the Storage UI.
- Error codes: `schema_missing`/`database`/`decrypt`/`not_authorized` → 503, `not_found` → 404, `quota_exceeded` → 413, `provider` → 502.

## Internal storage schema (`db/migration_google_storage.sql`)
- `storage_accounts` — one row for Seed Cloud's own Google Drive connection (`provider='google_drive'`, encrypted `refresh_token`). Zero anon/authenticated RLS policies (only the service role touches it).
- `user_storage` — `user_id, storage_limit, storage_used, google_root_folder_id, google_folder_id, created_at, updated_at`. RLS: users see/insert only their own row; `storage_limit` update revoked from anon/authenticated.
- `files` — `id, user_id, name, mime_type, size, provider, provider_file_id, parent_folder_id, is_folder, created_at, updated_at`, FK to `auth.users`, `unique (user_id, provider_file_id)`. RLS: users see/insert/update/delete only their own rows; updates are limited to rename fields.
- The migration preserves a legacy incompatible `files` table from an earlier prototype by renaming it to `files_legacy` (it is empty; no data lost) before creating the real table.
- `db/schema.sql` (base providers/connected_accounts schema) and this migration must BOTH be run in the Supabase SQL editor (agent cannot apply DDL).

## Backend routes (personal connections — unchanged)
Canonical:
- `GET  /api/oauth/:slug/start` — auth required; creates single-use OAuth state, sets httpOnly `sc_oauth_state` cookie, returns `{ url }`.
- `GET  /api/oauth/:slug/callback` — validates state cookie + in-memory state, exchanges code, saves connection (duplicate-account check by `provider_account_id`), redirects `/clouds?connected=…` or `?connect_error=…`.
- `GET  /api/clouds` — all 15 providers (registry status) + user's safe connections.
- `GET  /api/clouds/:connectionId`, `POST /:id/refresh`, `POST /:id/disconnect`.
Legacy aliases kept working: `/api/providers` (GET), `/api/providers/:slug/connect`, `/:slug/callback`, `/:slug/connections/:id[/refresh|/disconnect]`, `/:slug/disconnect`.

## Connected account schema (`db/schema.sql`)
- `storage_providers` — seeded with all 15 providers.
- `connected_accounts` — `id, user_id, provider_id, provider_account_id, display_name, email, access_token, token_type, api_host, status, storage_total, storage_used, last_sync_at, created_at, updated_at`.
- Multiple accounts per provider supported (`unique (user_id, provider_account_id)` blocks duplicates).
- RLS: users can only see/insert/update/delete their own rows.
- `file_locations.connected_account_id` → `ON DELETE SET NULL` (files stay on provider; metadata orphans on disconnect).

## Token storage
- `server/token-encryption.js`: AES-256-GCM, key = sha256(`TOKEN_ENCRYPTION_SECRET`). Format `enc:<iv>:<tag>:<ciphertext>`.
- Tokens never returned to the browser; `safeConnection()` strips all credential fields.

## Provider registry (`server/providers/registry.js`)
Central source of truth: 6 supported (pcloud implemented; google-drive, onedrive, box, koofr, dropbox coming soon), 3 limited (mega, mediafire, proton-drive), 6 unsupported (degoo, icedrive, idrive, icloud, sync, internxt). Frontend consumes it via `/api/clouds` (`availability`, `implemented`, `oauth`, reasons). Google Drive's personal adapter (`server/providers/google-drive/index.js`) stays "Coming soon"; the internal backend client is `server/providers/google-drive/drive.js` (separate, real).

## Environment status (`.env`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — set.
- `SUPABASE_SERVICE_ROLE_KEY` — SET (required at boot; blocked in browser contexts — use the Node SDK/server only).
- `TOKEN_ENCRYPTION_SECRET` — SET.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — SET; `GOOGLE_REDIRECT_URI=http://localhost:3000/api/storage/google/callback` (must match Google Cloud Console exactly).
- `PCLOUD_CLIENT_ID` / `PCLOUD_CLIENT_SECRET` — EMPTY (pCloud not testable yet).

## Remaining configuration (BLOCKING)
1. Register `http://localhost:3000/api/storage/google/callback` as an authorized redirect URI in the Google Cloud Console (and confirm it matches `GOOGLE_REDIRECT_URI`).
2. Run `db/schema.sql` AND `db/migration_google_storage.sql` in the Supabase SQL editor (live DB currently has NO tables — every query returns PGRST205).
3. pCloud: create the app at https://docs.pcloud.com/my_apps/, register `http://localhost:3000/api/oauth/pcloud/callback`, add `PCLOUD_CLIENT_ID`/`PCLOUD_CLIENT_SECRET`.

## Test status
- Server boots; `/api/health` OK; `/api/config` returns `googleConfigured: true`.
- Unauthenticated `/api/storage`, `/api/files`, `/api/storage/google/start` → HTTP 401.
- Authenticated (confirmed test user via Node SDK `auth.admin.updateUserById(…, { email_confirm: true })`):
  - `/api/storage/google/start` → HTTP 200 with correct Google OAuth URL.
  - `/api/storage`, `/api/files` → HTTP 503 `schema_missing` until the migration is applied.
- NOT yet verified: Google OAuth exchange (needs owner authorization), upload/download/rename/delete/quota against real Drive.

## Exact next task
1. Apply both SQL files in the Supabase SQL editor.
2. Register the Google redirect URI in Google Cloud Console.
3. `npm run dev` → Sign in → `/storage` → "Connect Google Drive" → authorize → verify Connected, quota overview, root `Seed Cloud Storage` folder.
4. Test upload, folder create, browse, download, rename, delete, quota rejection (>1 GB), and the storage=connected / storage_error=* toasts.
5. Then verify pCloud with real credentials.