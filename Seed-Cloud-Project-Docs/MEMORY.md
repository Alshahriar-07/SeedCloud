# Seed Cloud — Project Memory

## Identity
- Product: Seed Cloud (Seed Code ecosystem) — Universal Cloud Storage Router.
- Stack: plain HTML/CSS/JS (`public/`) + Node.js/Express (`server/`) + Supabase Auth & Database. No framework.

## Current phase — Google Drive internal storage backend (in progress)
Every Seed Cloud user gets a 512 MB logical quota (536,870,912 bytes). Default Seed Cloud storage = 512 MB per user. File bytes are stored in Seed Cloud's own Google Drive account (server-side OAuth); Supabase stores ONLY metadata, quota, and auth. The existing Files/Storage/Upload/Download UI is wired to the new `/api/files` + `/api/storage` backend. Migration + Google Drive authorization are the only remaining manual steps.

## Vercel production deployment
- Production URL: `https://seedcloud.vercel.app/` (project: `jinzxmjbnvkuaitdmvaj` Supabase).
- Vercel does NOT run `node --watch server/index.js`. The backend is a serverless function:
  - `api/index.js` imports and `export default` the Express app from `server/index.js`.
  - `server/index.js` exports the app and only calls `app.listen()` when `VERCEL`/`VERCEL_ENV` is absent (local dev). Vercel invokes the exported app directly.
  - `vercel.json` (version 2, builds+routes): `@vercel/node` builds `api/index.js`; `@vercel/static` serves `public/**`. Routes: `/api/(.*)` → the function, SPA pages (`/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/docs/cloud-connections`, `/dashboard`, `/files`, `/upload`, `/downloads`, `/access`, `/storage`, `/clouds`, `/profile`, `/settings`) → their static HTML, fallback `/(.*)` → `/public/$1`.
  - `/api/*` is never routed to `index.html`; unknown `/api/*` returns a JSON 404 from Express.
- API routing summary: `/api/auth/*`, `/api/oauth/:slug/start|callback`, `/api/clouds*`, `/api/providers*`, `/api/storage*`, `/api/files*`, `/api/shares*`, `/api/health`, `/api/config`.
- Serverless-safe state:
  - OAuth authorization state → persisted in Supabase `oauth_state` table (single-use, expires; see `server/oauth-state.js` + `db/migration_serverless.sql`). Cookie `sc_oauth_state`/`sc_google_state` is still the browser-side binding.
- Production environment variables (Vercel → Settings → Environment Variables → Production):
  - `BASE_URL=https://seedcloud.vercel.app` (drives OAuth redirect URIs; config.js falls back to the deployment URL with a warning if unset).
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public-safe), `SUPABASE_SERVICE_ROLE_KEY` (server-only, NEVER in a NEXT_PUBLIC_/VITE_ var), `TOKEN_ENCRYPTION_SECRET` (must match the value that encrypted stored tokens).
  - `PCLOUD_CLIENT_ID`, `PCLOUD_CLIENT_SECRET`, `PCLOUD_REDIRECT_URI=https://seedcloud.vercel.app/api/oauth/pcloud/callback`.
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://seedcloud.vercel.app/api/storage/google/callback` (must match the Google Cloud Console authorized redirect URI exactly).
  - Frontend uses only relative `/api/...` URLs — no localhost/ports anywhere.
- Known limitations on Vercel:
  - Uploads/downloads are raw bodies streamed through a serverless function: platform body limit (~4.5 MB on the free plan) and function max-duration limits apply to large files.
  - Streaming downloads work but inherit the function timeout.
  - The Supabase schema must be applied in the SQL editor (`db/schema.sql`, `db/migration_google_storage.sql`, `db/migration_serverless.sql`) — the backend/agent cannot run DDL. As of this write the production DB had NO tables, which is the root cause of `/api/*` failures on untouched tables.

## CAPTCHA — REMOVED
CAPTCHA removed from Seed Cloud signup. The signup flow is Name → Email → Password → Confirm Password → Create Account → Supabase signup → confirmation email. There is no CAPTCHA UI, no CAPTCHA API route, and no CAPTCHA validation anywhere in the codebase. `server/math-captcha.js` was deleted; `/api/captcha` and `/api/captcha/verify` were removed from `server/index.js`; the CAPTCHA field/CSS/logic was removed from `public/signup.html`, `public/css/style.css`, and `public/js/signup.js`. Signup is protected by Supabase's own rate limits and email confirmation.

## Internal storage architecture
- Flow: Browser → Seed Cloud API (`/api/files`, `/api/storage`) → Node backend → Seed Cloud's Google Drive account. Personal provider connections (pCloud/Google Drive) are separate and unaffected.
- Google scope: `https://www.googleapis.com/auth/drive.file`, `access_type=offline&prompt=consent` (forces a refresh token). Tokens are AES-256-GCM encrypted (`TOKEN_ENCRYPTION_SECRET`) and never sent to the frontend.
- Quota: 512 MiB per user (`storage.defaultQuotaBytes` / `DEFAULT_STORAGE_LIMIT = 536870912`). Default Seed Cloud storage = 512 MB per user. Enforced in `uploadFile`: over-quota users (`is_over_quota`) and `storage_used + size > limit` → HTTP 413 "Storage limit reached. You have 512 MB of free storage." `storage_used` never goes negative (delete clamps at 0).
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
- `user_storage` — `user_id, storage_limit, storage_used, is_over_quota, root_folder_id, created_at, updated_at`. Default `storage_limit = 536870912` (512 MiB), `storage_used = 0`. RLS: users see/insert only their own row; `storage_limit`/`storage_used`/`is_over_quota`/`root_folder_id` updates revoked from anon/authenticated.
- New-user record creation: a DB trigger on `auth.users` insert (`handle_new_user_storage`, installed by `db/migration_quota_512mb.sql`) inserts `(user_id, 536870912, 0)` exactly once; the backend's lazy `ensureUserStorage()` is an idempotent fallback (primary key `user_id` blocks duplicates).
- 1 GiB → 512 MiB migration: `db/migration_quota_512mb.sql` (RUN IN THE SUPABASE SQL EDITOR) adds `is_over_quota`, sets the column default, migrates existing `storage_limit = 1073741824` → `536870912` PRESERVING `storage_used`, and marks users already over 512 MiB as `is_over_quota` (no files deleted; uploads blocked until usage drops).
- `files` — `id, user_id, name, mime_type, size, provider, provider_file_id, parent_folder_id, is_folder, created_at, updated_at`, FK to `auth.users`, `unique (user_id, provider_file_id)`. RLS: users see/insert/update/delete only their own rows; updates are limited to rename fields.
- The migration preserves a legacy incompatible `files` table from an earlier prototype by renaming it to `files_legacy` (it is empty; no data lost) before creating the real table.
- `db/schema.sql` (base providers/connected_accounts + `user_storage` schema and the new-user trigger), `db/migration_google_storage.sql`, and `db/migration_quota_512mb.sql` (1 GiB → 512 MiB quota migration) must be run in the Supabase SQL editor (agent cannot apply DDL).

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
4. Test upload, folder create, browse, download, rename, delete, quota rejection (>512 MB), and the storage=connected / storage_error=* toasts.
5. Then verify pCloud with real credentials.