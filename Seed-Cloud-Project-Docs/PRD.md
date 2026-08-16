# Seed Cloud — Product Requirements Document

## 1. Product

**Name:** Seed Cloud  
**Category:** Universal Cloud Storage Router / Aggregator  
**Parent ecosystem:** Seed Code

## 2. Problem

Users may have free storage spread across many cloud services. Each service has a separate interface, account, quota, and file-management workflow.

Seed Cloud aims to give the user one unified interface while routing operations to connected cloud providers.

## 3. Core concept

A user connects supported cloud-storage accounts. Seed Cloud maintains a unified virtual view of their available storage.

Example:

- File A → Google Drive
- File B → OneDrive
- File C → Dropbox

The user sees them as files inside Seed Cloud rather than needing to manually switch between providers.

## 4. Core user flow

1. User opens Seed Cloud.
2. User signs up/signs in with Supabase Auth.
3. User connects supported storage providers.
4. Seed Cloud verifies the connection and records provider metadata.
5. Router calculates usable connected capacity.
6. User uploads a file.
7. Router selects an appropriate connected provider.
8. File is uploaded to that provider.
9. Seed Cloud stores file metadata and provider mapping.
10. User can browse, download, share, rename, move, or delete supported files through Seed Cloud.

## 5. MVP capabilities

- Authentication
- Dashboard
- Connected cloud management
- Unified file list
- Folder navigation
- Upload
- Download
- Delete
- Rename
- Search
- Basic sharing
- Storage usage dashboard
- Provider-aware routing
- File-to-provider mapping
- Error/retry handling

## 6. Non-goals for MVP

- Replacing cloud providers
- Building a proprietary physical storage network
- Automatically bypassing provider restrictions
- Circumventing provider Terms of Service, rate limits, CAPTCHA, email verification, or anti-abuse systems
- Assuming every provider supports the same API capabilities

## 7. Critical feasibility requirement

Every provider must be researched independently for:

- Official API availability
- OAuth support
- Upload/download APIs
- File listing
- Sharing
- Delete/rename/move
- Free-tier rules
- Automation restrictions
- Developer/app registration requirements
- Terms of Service

A provider should only be integrated through an authorized and technically supported method.

## 8. Success criteria

A user should be able to sign in, connect at least one supported provider, upload a file, see it in the Seed Cloud interface, and download it again without needing to understand which backend provider handled the file.
