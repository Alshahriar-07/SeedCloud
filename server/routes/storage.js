import { Router } from 'express';
import config from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { adminClient } from '../supabase.js';
import { GoogleDrive } from '../providers/google-drive/drive.js';
import {
  StorageBackendError,
  getStorageInfo,
  ensureRootFolder,
  googleConfigured,
  saveBackendAccount,
} from '../storage-service.js';
import { readCookies } from '../utils/cookies.js';
import { createOAuthState, consumeOAuthState } from '../oauth-state.js';

const router = Router();

function redirect(res, query) {
  res.redirect(`/storage?${query}`);
}

function clearStateCookie(res) {
  res.clearCookie('sc_google_state', { path: '/' });
}

// GET /api/storage — the authenticated user's Seed Cloud quota (their own 1 GB,
// NOT the backend Google Drive account's quota).
router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json(await getStorageInfo(req.user.id));
  } catch (err) {
    if (err instanceof StorageBackendError) {
      const status = err.code === 'schema_missing' ? 503 : err.code === 'not_authorized' ? 503 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    next(err);
  }
});

// GET /api/storage/google/start — starts the OAuth consent for Seed Cloud's
// OWNER Google Drive account (backend infrastructure, not a user connection).
// Requires an authenticated Seed Cloud user. The state is persisted in Supabase
// (survives Vercel serverless invocations) and single-use.
router.get('/google/start', requireAuth, async (req, res, next) => {
  try {
    if (!googleConfigured()) {
      return res.status(503).json({
        error: 'The Google Drive storage backend is not configured on this server.',
        code: 'not_configured',
      });
    }
    const state = await createOAuthState({ userId: null, provider: 'google-storage' });
    const url = GoogleDrive.getAuthUrl({
      clientId: config.google.clientId,
      redirectUri: config.google.redirectUri,
      state,
    });
    res.cookie('sc_google_state', state, { httpOnly: true, sameSite: 'lax', maxAge: 10 * 60 * 1000, path: '/' });
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

// GET /api/storage/google/callback — OAuth redirect target. Exchanges the code,
// stores the encrypted refresh token, ensures the Seed Cloud root folder.
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    clearStateCookie(res);
    return redirect(res, 'storage_error=cancelled');
  }

  const cookies = readCookies(req);

  // consumeOAuthState validates the state and removes it (single-use). It
  // must also match the httpOnly cookie set by /google/start.
  const oauth = await consumeOAuthState(state).catch(() => null);
  if (!code || !state || state !== cookies.sc_google_state || !oauth || oauth.provider !== 'google-storage') {
    clearStateCookie(res);
    return redirect(res, 'storage_error=state');
  }

  try {
    const exchange = new GoogleDrive({
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      redirectUri: config.google.redirectUri,
    });
    const tokens = await exchange.exchangeCode({ code });
    if (!tokens.refresh_token) {
      clearStateCookie(res);
      return redirect(res, 'storage_error=refresh');
    }

    let email = null;
    try {
      const probe = new GoogleDrive({
        clientId: config.google.clientId,
        clientSecret: config.google.clientSecret,
        redirectUri: config.google.redirectUri,
        refreshToken: tokens.refresh_token,
      });
      const about = await probe.about();
      email = (about.user && about.user.emailAddress) || null;
    } catch {
      email = null;
    }

    await saveBackendAccount({ refreshToken: tokens.refresh_token, email });
    await ensureRootFolder();

    clearStateCookie(res);
    redirect(res, 'storage=connected');
  } catch (err) {
    console.error('[storage] google callback failed:', err.message);
    clearStateCookie(res);
    redirect(res, 'storage_error=unknown');
  }
});

export default router;
