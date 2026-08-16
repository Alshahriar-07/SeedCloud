import { Router } from 'express';
import crypto from 'node:crypto';
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

const router = Router();

// In-memory single-use OAuth state for the backend Google authorization.
const stateStore = new Map();
const STATE_TTL = 10 * 60 * 1000;

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
// Requires an authenticated Seed Cloud user.
router.get('/google/start', requireAuth, (req, res) => {
  if (!googleConfigured()) {
    return res.status(503).json({
      error: 'The Google Drive storage backend is not configured on this server.',
      code: 'not_configured',
    });
  }
  const state = crypto.randomBytes(24).toString('hex');
  stateStore.set(state, { createdAt: Date.now() });
  const url = GoogleDrive.getAuthUrl({
    clientId: config.google.clientId,
    redirectUri: config.google.redirectUri,
    state,
  });
  res.cookie('sc_google_state', state, { httpOnly: true, sameSite: 'lax', maxAge: STATE_TTL, path: '/' });
  res.json({ url });
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
  const entry = stateStore.get(state);
  if (!code || !state || state !== cookies.sc_google_state || !entry) {
    clearStateCookie(res);
    return redirect(res, 'storage_error=state');
  }
  stateStore.delete(state);
  if (Date.now() - entry.createdAt > STATE_TTL) {
    clearStateCookie(res);
    return redirect(res, 'storage_error=expired');
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
