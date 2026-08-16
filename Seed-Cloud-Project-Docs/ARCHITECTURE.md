# Seed Cloud — Architecture

## 1. High-level architecture

```text
Browser
  |
  | HTTPS
  v
Seed Cloud Frontend
HTML + CSS + JavaScript
  |
  | REST/API requests
  v
Node.js Backend
  |
  +--> Supabase Auth
  |
  +--> Supabase Database
  |
  +--> Storage Router
          |
          +--> Provider Adapter: Google Drive
          +--> Provider Adapter: OneDrive
          +--> Provider Adapter: Dropbox
          +--> Provider Adapter: MEGA
          +--> ...
```

## 2. Responsibility split

### Frontend

Responsible for:

- Authentication screens
- Dashboard
- File browser
- Upload UI
- Search
- Context menus
- Share dialogs
- Storage visualization
- Connected provider UI
- Progress/error states

### Node.js backend

Responsible for:

- Authentication verification
- Provider OAuth callbacks
- Provider API calls
- Router decisions
- File metadata operations
- Upload/download orchestration
- Share-link creation
- Error handling
- Provider health/capability checks

### Supabase

Responsible for:

- Authentication
- User records
- Application database
- Provider connection metadata
- File metadata
- Folder metadata
- Provider/file mappings
- User preferences

Supabase should not be treated as the primary storage location for large user files unless explicitly required for a future feature.

## 3. Provider adapter pattern

Each provider should have an isolated adapter.

```text
providers/
  google-drive/
    auth.js
    files.js
    share.js
    index.js

  onedrive/
    auth.js
    files.js
    share.js
    index.js

  dropbox/
    auth.js
    files.js
    share.js
    index.js
```

The router should talk to a common interface rather than provider-specific code.

## 4. Common provider interface

Conceptually:

```text
connect()
disconnect()
getAccount()
getCapabilities()
getStorageUsage()
listFiles()
createFolder()
upload()
download()
delete()
rename()
move()
createShareLink()
```

Not every provider will support every operation. Capability detection must be explicit.

## 5. File mapping

Example database record:

```text
file_id
user_id
name
size
mime_type
provider_id
provider_file_id
parent_folder_id
created_at
updated_at
```

The provider's native file ID must be preserved because Seed Cloud needs it to operate on the actual remote file.

## 6. Routing model

The first router version should be deterministic and observable.

Possible factors:

- Available free capacity
- Provider capability
- File size limits
- Provider health
- Upload failure history
- User preferences
- File type restrictions
- Provider-specific limits

Never assume that the provider with the most free GB is always the correct destination.

## 7. Security principles

- Never expose provider client secrets in frontend JavaScript.
- OAuth tokens belong on the backend or an appropriately secured token store.
- Use HTTPS in production.
- Validate every authenticated request.
- Enforce user ownership for every file/folder operation.
- Do not log access tokens.
- Encrypt sensitive credentials/tokens at rest where appropriate.
- Use least-privilege provider scopes.
- Implement CSRF/state protection for OAuth flows.
