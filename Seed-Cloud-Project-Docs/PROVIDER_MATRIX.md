# Seed Cloud — Provider Capability Matrix

Phase 0 research (Aug 2026). Each entry verified against official developer documentation.

| Provider | Official API | OAuth | Upload | Download | Share | Quota | Status | Notes |
|---|---|---|---|---|---|---|---|---|
| Degoo | No | No | - | - | - | - | Unsupported | No public API or OAuth. Only undocumented internal GraphQL (reverse-engineered). |
| MEGA | Yes (SDK) | No | Yes | Yes | Yes | Yes | Limited | Official C++ SDK, not REST/OAuth2. Session-based auth (no user-consent flow). App-key issuance unclear. |
| Google Drive | Yes (Drive API v3) | Yes | Yes | Yes | Yes | Yes | Supported | Full OAuth2 + all ops. Production app verification required (>100 users / sensitive scopes). |
| pCloud | Yes (docs.pcloud.com) | Yes | Yes | Yes | Yes | Yes | Supported | OAuth2, all ops, non-expiring tokens. Free self-service app console, no approval. |
| Icedrive | No | No | - | - | - | - | Unsupported | No public API/OAuth. WebDAV is paid-only and being phased out; heavy rate limiting. |
| Box | Yes (developer.box.com) | Yes | Yes | Yes | Yes | Yes | Supported | OAuth2, all ops + quota. Free dev account. Production may need enterprise-admin app authorization. |
| MediaFire | Yes (Core API v1.5) | No | Yes | Yes | Yes | Yes | Limited | Official API but NOT OAuth2 (app ID/key + user session tokens). Free-tier caps apply. |
| IDrive | No (consumer) | No | - | - | - | - | Unsupported | No official API for consumer accounts. e2 (S3 object storage) is a different model, no OAuth/share/folders. |
| Microsoft OneDrive | Yes (Graph API) | Yes | Yes | Yes | Yes | Yes | Supported | OAuth2 via Entra ID, all ops + quota. Free registration, works with free accounts. |
| Apple iCloud | No (Drive) | No | - | - | - | - | Unsupported | No official API for a user's iCloud Drive. CloudKit only exposes your own app's container. |
| Proton Drive | Yes (SDKs) | No | Yes | Yes | Yes | Unverified | Limited | Official open-source SDKs, but no third-party auth/OAuth yet. Personal/non-commercial only for now. |
| Sync.com | No | No | - | - | - | - | Unsupported | No public API. ToS explicitly forbids automation/third-party access. |
| Koofr | Yes (API v2) | Yes | Yes | Yes | Yes | Yes | Supported | OAuth2, all ops + quota + share links. Free self-service registration, no approval. Free-tier share caps. |
| Dropbox | Yes (developers.dropbox.com) | Yes | Yes | Yes | Yes | Yes | Supported | OAuth2 + all ops + quota. Scoped apps; production review required after ~50 linked users. |
| Internxt | No (Drive) | No | - | - | - | - | Unsupported | No public API for Drive. Internxt S3 (object storage) is separate, paid, no OAuth — out of scope. |

## Status definitions

- **Supported:** Official documented integration is available and tested.
- **Limited:** Some required operations are possible, but important functionality is missing.
- **Unsupported:** No suitable authorized integration is currently available.
- **Research:** Not yet verified.

Never classify a provider based only on a third-party blog or a remembered API.

## Recommendation — first integration

**First: pCloud**

- Documented public API + clean OAuth2 user-consent flow.
- All required capabilities: connect, account, quota, list, upload, download, delete, rename, create folder, share links.
- Free self-service app registration with **no approval process**.
- OAuth access tokens do not expire (simpler token handling for the first adapter).
- 10 GB free tier is sufficient for real end-to-end testing.

**Backups (in order):**

1. Google Drive — best-documented ecosystem, but requires OAuth app verification before scaling past 100 users.
2. Microsoft OneDrive — huge user base, free app registration, no admin setup for consumer accounts.
3. Koofr — simplest registration and full capabilities; free-tier share-link restrictions.

**Avoid for now:** Degoo, Icedrive, IDrive (consumer), iCloud, Sync.com, Internxt (Drive) — no legitimate API/OAuth path. MEGA, MediaFire, Proton Drive — workable but auth model does not fit the OAuth consent design; revisit later.
