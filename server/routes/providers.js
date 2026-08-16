import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { adminClient } from '../supabase.js';
import { getProvider } from '../providers/index.js';
import { getProviderDbId, listConnections, getConnectionById } from '../connections.js';
import { safeConnection, buildProviderList, loadConnectionForUser, refreshConnection, disconnectConnection } from './clouds.js';
import { buildOAuthStart, handleOAuthCallback } from './oauth.js';

const router = Router();

// Legacy router. The canonical endpoints live at /api/oauth/:slug/start,
// /api/oauth/:slug/callback and /api/clouds. These routes exist so existing
// clients keep working; the behavior is identical.

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const providers = await buildProviderList(req.user.id);
    res.json({ providers });
  } catch (err) {
    next(err);
  }
});

router.post('/:slug/connect', requireAuth, async (req, res, next) => {
  try {
    const result = await buildOAuthStart({ user: req.user, slug: req.params.slug });
    if (!result.ok) {
      const messages = {
        not_configured: 'This provider is not configured on this server yet',
        coming_soon: 'This provider is not available for connecting yet',
        unknown: 'Provider not found',
      };
      return res.status(503).json({ error: messages[result.error] || 'Could not start connection', code: result.error });
    }
    res.cookie('sc_oauth_state', result.state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/',
    });
    res.json({ url: result.url });
  } catch (err) {
    next(err);
  }
});

router.get('/:slug/callback', (req, res, next) => {
  handleOAuthCallback(req, res).catch(next);
});

router.get('/:slug/connections/:id', requireAuth, async (req, res, next) => {
  try {
    const provider = getProvider(req.params.slug);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    const providerDbId = await getProviderDbId(provider.id);
    const conn = await getConnectionById({
      id: Number(req.params.id),
      userId: req.user.id,
      providerId: providerDbId,
    });
    if (!conn) return res.status(404).json({ error: 'Connection not found' });
    res.json(safeConnection(conn));
  } catch (err) {
    next(err);
  }
});

router.post('/:slug/connections/:id/refresh', requireAuth, async (req, res, next) => {
  try {
    const conn = await loadConnectionForUser(req.params.id, req.user.id);
    if (!conn) return res.status(404).json({ error: 'Connection not found' });
    const updated = await refreshConnection(conn);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/:slug/connections/:id/disconnect', requireAuth, async (req, res, next) => {
  try {
    const conn = await loadConnectionForUser(req.params.id, req.user.id);
    if (!conn) return res.status(404).json({ error: 'Connection not found' });
    await disconnectConnection(conn, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Backwards-compatible alias: disconnect every connection of this provider.
router.post('/:slug/disconnect', requireAuth, async (req, res, next) => {
  try {
    const provider = getProvider(req.params.slug);
    if (!provider) return res.status(404).json({ error: 'Provider not found' });
    const providerDbId = await getProviderDbId(provider.id);
    if (providerDbId) {
      const connections = await listConnections({ userId: req.user.id, slug: provider.id });
      const ids = connections.map((c) => c.id);
      if (ids.length) {
        const { error } = await adminClient
          .from('connected_accounts')
          .delete()
          .in('id', ids)
          .eq('user_id', req.user.id);
        if (error) throw error;
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;