# Seed Cloud — Data Model

## users

Supabase Auth owns the authentication identity.

Application profile fields may include:

- id
- display_name
- avatar_url
- created_at
- updated_at

## storage_providers

Represents a provider type.

- id
- name
- slug
- enabled
- capabilities
- created_at

## connected_accounts

Represents a user's connection to a provider.

- id
- user_id
- provider_id
- provider_account_id
- display_name
- encrypted_token_reference
- status
- last_sync_at
- created_at
- updated_at

## files

Represents a logical Seed Cloud file.

- id
- user_id
- name
- size
- mime_type
- folder_id
- created_at
- updated_at
- deleted_at

## file_locations

Maps a logical Seed Cloud file to its actual provider object.

- id
- file_id
- connected_account_id
- provider_file_id
- path
- size
- checksum
- status
- created_at
- updated_at

This separate mapping allows the application layer to remain provider-independent.

## folders

- id
- user_id
- name
- parent_folder_id
- created_at
- updated_at

## share_links

- id
- file_id
- created_by
- provider_share_url
- access_type
- expires_at
- created_at
- revoked_at

## Important rule

Every query involving user-owned data must be scoped to the authenticated user. Supabase Row Level Security should be used where applicable.
