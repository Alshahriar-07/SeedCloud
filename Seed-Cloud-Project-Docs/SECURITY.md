# Seed Cloud — Security Rules

## Authentication

- Supabase Auth is the identity provider.
- Never implement password storage manually.
- Protect all private API routes.

## OAuth

For every provider supporting OAuth:

1. Generate provider authorization URL on the backend.
2. Use a secure state value.
3. Receive callback on the backend.
4. Validate state.
5. Exchange authorization code server-side.
6. Store token references securely.
7. Request only necessary scopes.

## Secrets

Never put these in frontend source:

- Client secrets
- Provider refresh tokens
- Server-side API keys
- Supabase service-role key

The Supabase anon/publishable client key can be used according to Supabase's security model, but privileged keys must remain server-side.

## File access

Every operation must verify:

```text
authenticated user
        +
ownership of Seed Cloud file
        +
valid connected provider
```

## Logging

Never log:

- access tokens
- refresh tokens
- passwords
- session secrets
- private share tokens

## Provider compliance

Seed Cloud must not attempt to bypass:

- CAPTCHA
- rate limits
- email verification
- account restrictions
- provider security controls
- provider Terms of Service
