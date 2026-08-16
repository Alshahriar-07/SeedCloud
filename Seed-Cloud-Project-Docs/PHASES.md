# Seed Cloud — Development Phases

## Phase 0 — Discovery

- Research all 15 providers.
- Identify official APIs.
- Identify OAuth support.
- Identify upload/download capabilities.
- Identify developer account requirements.
- Identify free-tier limitations.
- Identify automation restrictions.
- Classify providers as supported, limited, or unsupported.

**Deliverable:** Provider Capability Matrix.

## Phase 1 — Foundation

- Create Node.js project.
- Create frontend structure.
- Configure Supabase.
- Implement authentication.
- Establish environment variable strategy.
- Establish API structure.

**Deliverable:** User can register, log in, and reach a protected dashboard.

## Phase 2 — Database

- Create tables.
- Add relationships.
- Configure Row Level Security.
- Implement user-scoped queries.

**Deliverable:** Secure application data layer.

## Phase 3 — First provider

Choose one provider with a strong official API/OAuth flow.

- OAuth connection
- Account information
- Storage quota
- File listing
- Upload
- Download
- Delete
- Rename

**Deliverable:** One complete working integration.

## Phase 4 — Unified file system

- File browser
- Folders
- Search
- Metadata mapping
- Provider abstraction
- Download proxy/redirect strategy
- Basic sharing

**Deliverable:** User can operate the first connected cloud through Seed Cloud.

## Phase 5 — Storage Router

- Capacity calculation
- Provider capability checks
- Provider health
- Routing rules
- Upload fallback
- Retry logic

**Deliverable:** Seed Cloud automatically chooses an appropriate provider.

## Phase 6 — More providers

Add providers one at a time through the adapter architecture.

Each provider must pass:

- authentication
- quota
- upload
- download
- listing
- delete
- rename
- error handling

## Phase 7 — Production hardening

- Rate limiting
- Security audit
- Token security
- Large-file streaming
- Monitoring
- Error reporting
- Backup/recovery strategy
- Privacy documentation
- Terms/ToS review

## Phase 8 — Launch

- Production deployment
- Domain
- Branding
- Landing page
- Documentation
- Support/contact flow
- Usage analytics with privacy consideration
