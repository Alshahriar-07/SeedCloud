# Seed Cloud — Project Memory

## Identity
- Product: Seed Cloud (Seed Code ecosystem) — Universal Cloud Storage Router.
- Stack: plain HTML/CSS/JS (`public/`) + Node.js/Express (`server/`) + Supabase Auth & Database. No framework.

## Current phase — Storage router (in progress)
Seed Cloud is a CLOUD STORAGE ROUTER. It has NO internal/default storage backend. Actual file bytes live ONLY on the user's connected third-party providers (their pCloud, their own Google Drive, ...). Supabase stores ONLY:
- auth (Supabase Auth)
- the user's logical Seed Cloud quota (`user_storage`, default 512 MiB / 536,870,912 bytes)
- file metadata (`files` — where each file lives on a connected provider)
- provider connection metadata (`connected_accounts`, incl. encrypted `refresh_token` for providers whose access tokens expire, e.g. Google Drive)
- OAuth single-use state (`oauth_state`)

There is NO `storage_accounts` table, NO Seed Cloud-owned Google Drive account, NO Supabase Storage bucket, and NO "Authorize Seed Cloud storage" flow. `db/migration_google_storage.sql` was DELETED; it was replaced by `db/migration_provider_files.sql`.

## Vercel production deployment
- Production URL: `https://seedcloud.vercel.app/` (project: `jinzxmjbnvkuaitdmvaj` Supabase).
- Vercel does NOT run `node --watch server/index.js`. The backend is a serverless function:
  - `api/index.js` imports and `export default` the Express app from `server/index.js`.
  - `server/index.js` exports the app and only calls `app.listen()` when `VERCEL`/`VERCEL_ENV` is absent (local dev). Vercel invokes the exported app directly.
  - `vercel.json` (version 2, builds+routes): `@vercel/node` builds `api/index.js`; `@vercel/static` serves `public/**`. Routes: `/api/(.*)` → the function, SPA pages (`/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/docs/cloud-connections`, `/dashboard`, `/files`, `/upload`, `/downloads`, `/access`, `/storage`, `/clouds`, `/profile`, `/settings`) → their static HTML, fallback `/(.*)` → `/public/$1`.
  - `/api/*` is never routed to `index.html`; unknown `/api/*` returns a JSON 404 from Express.
- API routing summary: `/api/auth/*`, `/api/oauth/:slug/start|callback`, `/api/clouds*`, `/api/providers*`, `/api/storage*`, `/api/files*`, `/api/shares*`, `/api/health`, `/api/config`.
- Serverless-safe state:
  - OAuth authorization state → persisted in Supabase `oauth_state` table (single-use, expires; see `server/oauth-state.js` + `db/migration_serverless.sql`). Cookie `sc_oauth_state` is the browser-side binding (there is no `sc_google_state` anymore).
- Production environment variables (Vercel → Settings → Environment Variables → Production):
  - `BASE_URL=https://seedcloud.vercel.app` (drives OAuth redirect URIs; config.js falls back to the deployment URL with a warning if unset).
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public-safe), `SUPABASE_SERVICE_ROLE_KEY` (server-only, NEVER in a NEXT_PUBLIC_/VITE_ var), `TOKEN_ENCRYPTION_SECRET` (must match the value that encrypted stored tokens).
  - `PCLOUD_CLIENT_ID`, `PCLOUD_CLIENT_SECRET`, `PCLOUD_REDIRECT_URI=https://seedcloud.vercel.app/api/oauth/pcloud/callback`.
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://seedcloud.vercel.app/api/oauth/google-drive/callback` (this is the USER provider connect callback — the user's OWN Google Drive — NOT an internal storage backend; must match the Google Cloud Console authorized redirect URI exactly).
  - Frontend uses only relative `/api/...` URLs — no localhost/ports anywhere.
- Known limitations on Vercel:
  - Uploads/downloads are raw bodies streamed through a serverless function: platform body limit (~4.5 MB on the free plan) and function max-duration limits apply to large files.
  - Streaming downloads work but inherit the function timeout.
  - The Supabase schema must be applied in the SQL editor (`db/schema.sql`, `db/migration_serverless.sql`, `db/migration_provider_files.sql`) — the backend/agent cannot run DDL.

## CAPTCHA — REMOVED
CAPTCHA removed from Seed Cloud signup. The signup flow is Name → Email → Password → Confirm Password → Create Account → Supabase signup → confirmation email. There is no CAPTCHA UI, no CAPTCHA API route, and no CAPTCHA validation anywhere in the codebase. `server/math-captcha.js` was deleted; `/api/captcha` and `/api/captcha/verify` were removed from `server/index.js`; the CAPTCHA field/CSS/logic was removed from `public/signup.html`, `public/css/style.css`, and `public/js/signup.js`. Signup is protected by Supabase's own rate limits and email confirmation.

## Storage router architecture
- Flow: Browser → Seed Cloud API (`/api/files`, `/api/storage`) → Node backend → the user's CONNECTED provider (their pCloud / own Google Drive). Supabase holds metadata + quota + connection credentials only.
- Choosing where bytes land: `getPrimaryConnection(userId)` (`server/connections.js`) returns the user's most-recently-connected ACTIVE account across all providers (decrypted token + adapter). Uploads/folder-create route there. Rename/delete/download resolve the exact connection via the file row's `connected_account_id` (`requireConnectionForRow`).
- Provider adapters (`server/providers/*/index.js`): pCloud is fully implemented. Google Drive is now a REAL user adapter (`server/providers/google-drive/index.js`) built on `drive.js` (Google OAuth2 + Drive v3, scope `drive.file`; `aboutStorage()` added). Registry marks google-drive `implemented: true`.
- Quota: 512 MiB per user (`storage.defaultQuotaBytes` / `DEFAULT_STORAGE_LIMIT = 536870912`). Enforced in `uploadFile`: over-quota users (`is_over_quota`) and `storage_used + size > limit` → HTTP 413 "Storage limit reached…". `storage_used` never goes negative (delete clamps at 0). Deletes decrement `storage_used` by the file's size.
- Orphan cleanup: if the DB row insert fails after a provider upload, the just-created provider file is deleted best-effort so quota stays consistent. Delete order is provider-first, then DB row, then quota reduction.
- Upload contract: raw file body with headers `x-file-name` (required) and `x-folder-id` (optional). Frontend mirrors the old pCloud XHR upload pattern and uses `browser.currentFolderId()`. Root-level items store `parent_folder_id = NULL`; the backend passes `folderId || undefined` (pCloud default root 0, Google `'root'` handled inside the adapter).
- Google tokens: `exchangeCode` returns `refresh_token`; both `access_token` and `refresh_token` are encrypted at rest (`connected_accounts.refresh_token`, new column) and decrypted server-side only. Scope `drive.file`, `access_type=offline&prompt=consent` forces a refresh token.

## Storage routes
- `GET  /api/storage` — the user's Seed Cloud LOGICAL quota overview `{ used, limit, available, percentage, overQuota }`. No storage authorization required. (The old `/api/storage/google/start` and `/api/storage/google/callback` were REMOVED.)
- `GET  /api/files` — list root or a folder's children (metadata only).
- `POST /api/files/upload` — quota-checked; errors: `no_cloud_connected` (400, "Connect a cloud storage provider before uploading files."), `quota_exceeded` (413), `schema_missing` (503).
- `POST /api/files/folders` — create a folder under a parent.
- `GET  /api/files/:id`, `GET /api/files/:id/download`, `PATCH /api/files/:id`, `DELETE /api/files/:id` — read, stream download, rename, delete.
- `/api/config` returns `supabaseUrl`, `supabaseAnonKey`, `pcloudConfigured`. (`googleConfigured` was REMOVED — there is no internal storage to authorize.)
- Error codes: `schema_missing`/`database`/`decrypt` → 503, `not_found` → 404, `quota_exceeded` → 413, `no_cloud_connected`/`invalid` → 400, `provider` → 502.

## Storage schema (`db/migration_provider_files.sql`)
- `files` — `id, user_id, name, mime_type, size, provider, provider_file_id, connected_account_id, parent_folder_id, is_folder, created_at, updated_at`, FK to `auth.users`, FK `connected_account_id` → `connected_accounts(id) ON DELETE SET NULL`, `unique (user_id, provider_file_id)`. RLS: users see/insert/update/delete only their own rows; ownership/size/provider-id writes are revoked from anon/authenticated. A legacy incompatible `files` table (no `name` column) is preserved by renaming it to `files_legacy`.
- `connected_accounts` — added `refresh_token text` (encrypted, server-only); select/update revoked from anon/authenticated.
- `user_storage` — `user_id, storage_limit, storage_used, is_over_quota, root_folder_id, created_at, updated_at`. Default `storage_limit = 536870912` (512 MiB), `storage_used = 0`. RLS: users see/insert only their own row; `storage_limit`/`storage_used`/`is_over_quota`/`root_folder_id` updates revoked from anon/authenticated. (root_folder_id is legacy/unused by the router.)
- New-user record creation: a DB trigger on `auth.users` insert (`handle_new_user_storage`) inserts `(user_id, 536870912, 0)` exactly once; the backend's lazy `ensureUserStorage()` is an idempotent fallback (primary key `user_id` blocks duplicates).
- Quota migrations: `db/migration_512mb_storage.sql` (self-contained; creates user_storage + trigger + backfills existing users) and the older `db/migration_quota_512mb.sql` (1 GiB → 512 MiB). `db/migration_provider_files.sql` re-creates the quota table/trigger idempotently too, so running it alone is safe.
- To apply: `db/schema.sql` (base), `db/migration_serverless.sql` (oauth_state), `db/migration_512mb_storage.sql` OR `db/migration_provider_files.sql` (quota + files + refresh_token), all in the Supabase SQL editor (agent cannot apply DDL).

## Backend routes (personal connections)
Canonical:
- `GET  /api/oauth/:slug/start` — auth required; creates single-use OAuth state, sets httpOnly `sc_oauth_state` cookie, returns `{ url }`.
- `GET  /api/oauth/:slug/callback` — validates state cookie + oauth_state row, exchanges code, saves connection (duplicate-account check by `provider_account_id`; stores encrypted `access_token` + `refresh_token`), redirects `/clouds?connected=…` or `?connect_error=…`.
- `GET  /api/clouds` — all 15 providers (registry status) + user's safe connections.
- `GET  /api/clouds/:connectionId`, `POST /:id/refresh`, `POST /:id/disconnect`.
Legacy aliases kept working: `/api/providers` (GET), `/api/providers/:slug/connect`, `/:slug/callback`, `/:slug/connections/:id[/refresh|/disconnect]`, `/:slug/disconnect`.

## Connected account schema (`db/schema.sql`)
- `storage_providers` — seeded with all 15 providers.
- `connected_accounts` — `id, user_id, provider_id, provider_account_id, display_name, email, access_token, refresh_token, token_type, api_host, status, storage_total, storage_used, last_sync_at, created_at, updated_at`.
- Multiple accounts per provider supported (`unique (user_id, provider_account_id)` blocks duplicates).
- RLS: users can only see/insert/update/delete their own rows.
- `file_locations.connected_account_id` → `ON DELETE SET NULL` (files stay on provider; metadata orphans on disconnect).

## Token storage
- `server/token-encryption.js`: AES-256-GCM, key = sha256(`TOKEN_ENCRYPTION_SECRET`). Format `enc:<iv>:<tag>:<ciphertext>`.
- Tokens never returned to the browser; `safeConnection()` strips all credential fields. `withDecryptedToken()` (connections.js) decrypts `access_token` AND `refresh_token` server-side.

## Provider registry (`server/providers/registry.js`)
Central source of truth: 6 supported (pcloud implemented; google-drive implemented as a real USER adapter; onedrive, box, koofr, dropbox coming soon), 3 limited (mega, mediafire, proton-drive), 6 unsupported (degoo, icedrive, idrive, icloud, sync, internxt). Frontend consumes it via `/api/clouds` (`availability`, `implemented`, `oauth`, reasons).

## Environment status (`.env`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — set.
- `SUPABASE_SERVICE_ROLE_KEY` — SET (required at boot; blocked in browser contexts — use the Node SDK/server only).
- `TOKEN_ENCRYPTION_SECRET` — SET.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — SET; `GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google-drive/callback` (must match Google Cloud Console exactly).
- `PCLOUD_CLIENT_ID` / `PCLOUD_CLIENT_SECRET` — EMPTY (pCloud not testable yet).

## Remaining configuration (BLOCKING)
1. Run `db/schema.sql`, `db/migration_serverless.sql`, and `db/migration_provider_files.sql` (quota+files+refresh_token; self-contained) in the Supabase SQL editor. The live DB currently has ONLY a legacy empty `files` table — no `user_storage`, `connected_accounts`, `storage_providers`, `oauth_state`, `file_locations`.
2. Register `http://localhost:3000/api/oauth/google-drive/callback` as an authorized redirect URI in the Google Cloud Console (must match `GOOGLE_REDIRECT_URI` exactly). The old `/api/storage/google/callback` redirect no longer exists.
3. pCloud: create the app at https://docs.pcloud.com/my_apps/, register `http://localhost:3000/api/oauth/pcloud/callback`, add `PCLOUD_CLIENT_ID`/`PCLOUD_CLIENT_SECRET`.

## Test status
- Server boots; `/api/health` OK; `/api/config` returns `pcloudConfigured` (no `googleConfigured`).
- Unauthenticated `/api/storage`, `/api/files` → HTTP 401.
- Authenticated (confirmed test user via Node SDK `auth.admin.updateUserById(…, { email_confirm: true })`):
  - `/api/storage` → HTTP 503 `schema_missing` until `migration_512mb_storage.sql` / `migration_provider_files.sql` is applied.
  - `/api/files` → HTTP 503 `schema_missing` until `migration_provider_files.sql` is applied.
- NOT yet verified: OAuth connects against real pCloud/Google Drive, upload→provider→metadata→quota flow, delete→provider→metadata→quota, downloads, and the no-cloud "Connect a cloud storage provider" UX.

## Exact next task
1. Apply `db/schema.sql`, `db/migration_serverless.sql`, `db/migration_provider_files.sql` (and `db/migration_512mb_storage.sql`) in the Supabase SQL editor.
2. Register `http://localhost:3000/api/oauth/google-drive/callback` in the Google Cloud Console.
3. `npm run dev` → Sign in → dashboard shows NO authorization warning, Storage shows 0 MB / 512 MB, Files page opens with "No cloud storage connected yet" + Connect a cloud, no "storage database is not set up" from internal Google storage.
4. Clouds page: Google Drive Connect starts the USER OAuth consent; pCloud Connect works once credentials are set.
5. Upload a file → verify it lands on the connected provider, metadata in Supabase `files`, `storage_used` increases; delete → removed from provider, metadata row gone, `storage_used` decreases. Supabase Storage is never used.