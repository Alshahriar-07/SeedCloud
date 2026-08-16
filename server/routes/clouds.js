import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { adminClient } from '../supabase.js';
import { getProviderRegistry } from '../providers/registry.js';
import { getProvider } from '../providers/index.js';
import {
  getProviderDbId,
  getProviderSlugById,
  listConnectionsByProviderId,
  getConnectionById,
} from '../connections.js';

const router = Router();

router.use(requireAuth);

// Strips every credential field. Nothing in these responses may ever contain a
// token, refresh token, or client secret.
export function safeConnection(row) {
  return {
    id: row.id,
    providerAccountId: row.provider_account_id,
    displayName: row.display_name,
    email: row.email,
    status: row.status,
    storageTotal: row.storage_total,
    storageUsed: row.storage_used,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// A provider is "connected" when at least one of the user's connections for it
// is active.
function connectionStatus(connections) {
  if (!connections.length) return 'not_connected';
  if (connections.some((c) => c.status === 'connected')) return 'connected';
  return connections[0].status;
}

// Builds the full provider list for the current user: registry metadata +
// their (safe) connections. Used by GET /api/clouds and legacy GET /api/providers.
// availability: 'supported' | 'limited' | 'unsupported' (from the registry).
// status: 'connected' | 'not_connected' | ... (the user's connection state).
export async function buildProviderList(userId) {
  const providers = [];
  for (const reg of getProviderRegistry()) {
    const providerDbId = await getProviderDbId(reg.id);
    const connections = providerDbId
      ? await listConnectionsByProviderId({ userId, providerId: providerDbId })
      : [];
    providers.push({
      id: reg.id,
      name: reg.name,
      description: reg.description,
      freeTier: reg.freeTier,
      availability: reg.status,
      oauth: reg.oauth,
      implemented: reg.implemented,
      limitedReason: reg.limitedReason || null,
      unavailableReason: reg.unavailableReason || null,
      configured: Boolean(reg.implemented && reg.oauth),
      status: connectionStatus(connections),
      connections: connections.map(safeConnection),
    });
  }
  return providers;
}

// Loads a connection row (token decrypted server-side) only if it belongs to
// the given user.
export async function loadConnectionForUser(id, userId) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  return getConnectionById({ id: numericId, userId });
}

// Pulls live storage usage from the provider and persists it. Returns the
// updated (safe) connection data. Provider tokens stay server-side.
export async function refreshConnection(conn) {
  if (conn.status !== 'connected') return safeConnection(conn);

  const slug = await getProviderSlugById(conn.provider_id);
  const provider = getProvider(slug);
  if (!provider) throw new Error('Provider adapter not found');

  const usage = await provider.getStorageUsage({
    accessToken: conn.access_token,
    refreshToken: conn.refresh_token,
    apiHost: conn.api_host,
  });
  const storageTotal = usage && usage.total ? usage.total : null;
  const storageUsed = usage && usage.used ? usage.used : null;

  await adminClient
    .from('connected_accounts')
    .update({
      storage_total: storageTotal,
      storage_used: storageUsed,
      last_sync_at: new Date().toISOString(),
    })
    .eq('id', conn.id);

  conn.storage_total = storageTotal;
  conn.storage_used = storageUsed;
  return safeConnection(conn);
}

// Safe disconnect. Revokes provider access when the adapter supports it,
// deletes the stored credentials and the connection row. The provider's actual
// files are never touched; file_locations rows that referenced this account
// keep their metadata with connected_account_id nulled (ON DELETE SET NULL).
export async function disconnectConnection(conn, userId) {
  if (conn.status === 'connected') {
    const slug = await getProviderSlugById(conn.provider_id);
    const provider = getProvider(slug);
    if (provider && typeof provider.revoke === 'function') {
      try {
        await provider.revoke({ accessToken: conn.access_token, apiHost: conn.api_host });
      } catch (err) {
        // Revocation is best-effort; the local disconnect still succeeds.
        console.error('[clouds] revoke failed:', err.message);
      }
    }
  }

  const { error: delError } = await adminClient
    .from('connected_accounts')
    .delete()
    .eq('id', conn.id)
    .eq('user_id', userId);
  if (delError) throw delError;

  return { ok: true };
}

// GET /api/clouds — every known provider (supported, limited, unsupported)
// with the user's connections and real status.
router.get('/', async (req, res, next) => {
  try {
    const providers = await buildProviderList(req.user.id);
    res.json({ providers });
  } catch (err) {
    next(err);
  }
});

// GET /api/clouds/:connectionId — safe metadata for one connected account.
router.get('/:id', async (req, res, next) => {
  try {
    const conn = await loadConnectionForUser(req.params.id, req.user.id);
    if (!conn) return res.status(404).json({ error: 'Connection not found' });
    res.json(safeConnection(conn));
  } catch (err) {
    next(err);
  }
});

// POST /api/clouds/:connectionId/refresh
router.post('/:id/refresh', async (req, res, next) => {
  try {
    const conn = await loadConnectionForUser(req.params.id, req.user.id);
    if (!conn) return res.status(404).json({ error: 'Connection not found' });
    const updated = await refreshConnection(conn);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /api/clouds/:connectionId/disconnect
router.post('/:id/disconnect', async (req, res, next) => {
  try {
    const conn = await loadConnectionForUser(req.params.id, req.user.id);
    if (!conn) return res.status(404).json({ error: 'Connection not found' });
    await disconnectConnection(conn, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;