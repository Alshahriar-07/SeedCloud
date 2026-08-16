# Seed Cloud — API Design

## Authentication

Authentication is handled through Supabase Auth. The Node.js backend validates the user's authenticated session/token before protected operations.

## Example backend routes

### Providers

```text
GET    /api/providers
GET    /api/providers/:provider/capabilities
POST   /api/providers/:provider/connect
GET    /api/providers/:provider/callback
DELETE /api/providers/:connectionId
```

### Files

```text
GET    /api/files
GET    /api/files/:id
POST   /api/files/upload
GET    /api/files/:id/download
PATCH  /api/files/:id
DELETE /api/files/:id
```

### Folders

```text
GET    /api/folders
POST   /api/folders
PATCH  /api/folders/:id
DELETE /api/folders/:id
```

### Sharing

```text
POST   /api/files/:id/share
DELETE /api/shares/:id
```

## Upload flow

```text
Browser
  |
  | upload
  v
Node.js
  |
  | authenticate user
  v
Storage Router
  |
  | select provider
  v
Provider Adapter
  |
  | upload
  v
Cloud Provider
  |
  | provider file ID
  v
Node.js
  |
  | save metadata + mapping
  v
Supabase
```

## API rules

- Protected endpoints require authentication.
- Validate file size and type.
- Never trust provider IDs supplied directly by the browser.
- Verify ownership before every operation.
- Use streaming for large files where practical.
- Return consistent JSON errors.
