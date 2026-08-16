import { adminClient } from './supabase.js';
import { decryptToken } from './token-encryption.js';
import { getProvider } from './providers/index.js';

const providerIdCache = new Map();

export async function getProviderDbId(slug) {
  if (providerIdCache.has(slug)) return providerIdCache.get(slug);
  const { data } = await adminClient
    .from('storage_providers')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  providerIdCache.set(slug, data ? data.id : null);
  return data ? data.id : null;
}

export async function getProviderSlugById(providerId) {
  if (!providerId) return null;
  const { data } = await adminClient
    .from('storage_providers')
    .select('slug')
    .eq('id', providerId)
    .maybeSingle();
  return data ? data.slug : null;
}

// All server-side reads decrypt the provider token before it is used.
// The token is never included in any response sent to the browser.
// If a stored token cannot be decrypted (e.g. TOKEN_ENCRYPTION_SECRET rotated),
// the connection metadata stays visible but the token is dropped, so only the
// operations that actually need the credential fail with a clear error.
function withDecryptedToken(row) {
  if (!row) return row;
  if (row.access_token) {
    try {
      row.access_token = decryptToken(row.access_token);
    } catch (err) {
      console.error('[connections] Failed to decrypt provider token:', err.message);
      row.access_token = null;
    }
  }
  if (row.refresh_token) {
    try {
      row.refresh_token = decryptToken(row.refresh_token);
    } catch (err) {
      console.error('[connections] Failed to decrypt provider refresh token:', err.message);
      row.refresh_token = null;
    }
  }
  return row;
}

export async function listConnections({ userId, slug }) {
  const providerId = await getProviderDbId(slug);
  if (!providerId) return [];
  const { data, error } = await adminClient
    .from('connected_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('provider_id', providerId)
    .order('id', { ascending: true });
  if (error && error.code !== '42P01') throw error;
  return (data || []).map(withDecryptedToken);
}

export async function listConnectionsByProviderId({ userId, providerId }) {
  if (!providerId) return [];
  const { data, error } = await adminClient
    .from('connected_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('provider_id', providerId)
    .order('id', { ascending: true });
  if (error && error.code !== '42P01') throw error;
  return (data || []).map(withDecryptedToken);
}

// The active connection for a provider used by the file/API proxies: the most
// recently connected account for this user+provider.
export async function getConnection(user, slug) {
  const rows = await listConnections({ userId: user.id, slug });
  return rows.filter((r) => r.status === 'connected').sort((a, b) => b.id - a.id)[0] || null;
}

export async function getConnectionById({ id, userId, providerId }) {
  if (!id) return null;
  let query = adminClient
    .from('connected_accounts')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId);
  if (providerId) query = query.eq('provider_id', providerId);
  const { data, error } = await query.maybeSingle();
  if (error && error.code !== '42P01') throw error;
  return withDecryptedToken(data);
}

// The user's most recently connected, active provider account across ALL
// providers, with the token decrypted and the adapter resolved. Returns null
// when the user has no connected cloud. Used by the file router to decide where
// an upload/folder-create should land (deterministic: newest connection wins).
export async function getPrimaryConnection(userId) {
  const { data, error } = await adminClient
    .from('connected_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'connected')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== '42P01') throw error;
  if (!data) return null;
  const conn = withDecryptedToken(data);
  const slug = await getProviderSlugById(conn.provider_id);
  const provider = slug ? getProvider(slug) : null;
  if (!provider) return null;
  return { conn, provider };
}