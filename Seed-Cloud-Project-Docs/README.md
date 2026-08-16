# Seed Cloud

**Seed Cloud** is a Universal Cloud Storage Router under the Seed Code ecosystem.

## Vision

One simple storage interface for the user, backed by multiple independent cloud-storage providers.

> **One account. One interface. Multiple clouds.**

## Planned stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js
- Authentication: Supabase Auth
- Application data: Supabase Database
- Storage providers: provider-specific APIs/OAuth/integrations

## Important principle

Seed Cloud does not create its own large physical storage pool. It provides a unified abstraction over connected storage providers. Actual file bytes remain with the underlying provider whenever the provider integration supports the required operation.

## Initial provider research list

1. Degoo
2. MEGA
3. Google Drive
4. pCloud
5. Icedrive
6. Box
7. MediaFire
8. IDrive
9. Microsoft OneDrive
10. Apple iCloud
11. Proton Drive
12. Sync.com
13. Koofr
14. Dropbox
15. Internxt

## UI direction

Simple, familiar, and functional—Google Drive-inspired in usability, but not a visual copy.

## Current status

Project starts from zero. No provider APIs, credentials, integrations, or production backend are assumed to exist yet.
