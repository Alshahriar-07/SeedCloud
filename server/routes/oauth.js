import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { adminClient } from '../supabase.js';
import config from '../config.js';
import { getProvider } from '../providers/index.js';
import { getProviderConfig, getRedirectUri, isProviderConfigured } from '../providers/registry.js';
import { getProviderDbId } from '../connections.js';
import { createOAuthState, consumeOAuthState } from '../oauth-state.js';
import { readCookies } from '../utils/cookies.js';
import { encryptToken } from '../token-encryption.js';

const router = Router();

// Shared by GET /api/oauth/:slug/start and the legacy
// POST /api/providers/:slug/connect. Creates a single-use OAuth state bound to
// the authenticated Seed Cloud user, then builds the provider authorization URL.
// Returns { ok: true, state, url } or { ok: false, error } where error is a
// short machine code mapped to a friendly message on the frontend.
export async function buildOAuthStart({ user, slug }) {
  const provider = getProvider(slug);
  const registry = getProviderConfig(slug);
  if (!provider || !registry) {
    return { ok: false, error: 'unknown' };
  }
  if (registry.status !== 'supported') {
    return { ok: false, error: 'unknown' };
  }
  if (!registry.implemented) {
    return { ok: false, error: 'coming_soon' };
  }
  if (!isProviderConfigured(slug)) {
    return { ok: false, error: 'not_configured' };
  }

  const providerConfig = config[provider.id];
  const state = await createOAuthState({ userId: user.id, provider: provider.id });
  const redirectUri = getRedirectUri(provider);
  const url = provider.getOAuthUrl({
    state,
    redirectUri,
    clientId: providerConfig.clientId,
  });
  return { ok: true, state, url };
}

// GET /api/oauth/:slug/start
// Requires an authenticated Seed Cloud user (Bearer token). Generates the
// OAuth state, stores it single-use in Supabase, sets an httpOnly cookie, and
// returns { url } so the SPA navigates to the provider. The provider redirects
// back to GET /api/oauth/:slug/callback.
router.get('/:slug/start', requireAuth, async (req, res, next) => {
  try {
    const result = await buildOAuthStart({ user: req.user, slug: req.params.slug });
    if (!result.ok) {
      res.clearCookie('sc_oauth_state', { path: '/' });
      return res.status(503).json({ error: oauthStartErrorMessage(result.error), code: result.error });
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

function oauthStartErrorMessage(code) {
  switch (code) {
    case 'not_configured':
      return 'This provider is not configured on this server yet';
    case 'coming_soon':
      return 'This provider is not available for connecting yet';
    default:
      return 'Provider not found';
  }
}

// GET /api/oauth/:slug/callback
// Called by the provider after the user approves. Validates the single-use
// state, exchanges the code for tokens server-side, stores the connected
// account (tokens encrypted at rest), and redirects to /clouds.
export async function handleOAuthCallback(req, res) {
  const provider = getProvider(req.params.slug);
  if (!provider) {
    return res.redirect('/clouds?connect_error=unknown');
  }

  const providerConfig = getProviderConfig(req.params.slug);
  const configured = providerConfig && isProviderConfigured(req.params.slug);
  const { code, state, error } = req.query;

  // Provider-side refusal (e.g. the user cancelled the consent screen).
  if (error) {
    res.clearCookie('sc_oauth_state', { path: '/' });
    return res.redirect('/clouds?connect_error=cancelled');
  }

  const cookies = readCookies(req);
  const cookieState = cookies.sc_oauth_state;

  if (!code || !state || state !== cookieState) {
    res.clearCookie('sc_oauth_state', { path: '/' });
    return res.redirect('/clouds?connect_error=state');
  }

  // consumeOAuthState removes the state from Supabase, so it is single-use. A
  // reused, missing or expired state returns null and is rejected here.
  const oauth = await consumeOAuthState(state);
  if (!oauth || oauth.provider !== provider.id) {
    res.clearCookie('sc_oauth_state', { path: '/' });
    return res.redirect('/clouds?connect_error=expired');
  }

  try {
    if (!configured) {
      res.clearCookie('sc_oauth_state', { path: '/' });
      return res.redirect('/clouds?connect_error=not_configured');
    }

    let tokens;
    try {
      tokens = await provider.exchangeCode({
        code,
        redirectUri: getRedirectUri(provider),
        clientId: config[provider.id].clientId,
        clientSecret: config[provider.id].clientSecret,
      });
    } catch (err) {
      console.error('[oauth] token exchange failed:', err.message);
      res.clearCookie('sc_oauth_state', { path: '/' });
      return res.redirect('/clouds?connect_error=invalid_code');
    }

    const conn = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || null,
      tokenType: tokens.tokenType,
      apiHost: req.query.hostname || null,
    };

    let account;
    try {
      account = await provider.getAccount(conn);
    } catch (err) {
      console.error('[oauth] provider account lookup failed:', err.message);
      res.clearCookie('sc_oauth_state', { path: '/' });
      return res.redirect('/clouds?connect_error=provider_api');
    }

    const usage = await provider.getStorageUsage(conn).catch(() => null);

    const providerDbId = await getProviderDbId(provider.id);
    if (!providerDbId) {
      res.clearCookie('sc_oauth_state', { path: '/' });
      return res.redirect('/clouds?connect_error=database');
    }

    const providerAccountId = tokens.providerAccountId || account.accountId || null;

    // Do not create a duplicate connection for the same provider account.
    if (providerAccountId) {
      const { data: existing } = await adminClient
        .from('connected_accounts')
        .select('id')
        .eq('user_id', oauth.userId)
        .eq('provider_id', providerDbId)
        .eq('provider_account_id', providerAccountId)
        .maybeSingle();
      if (existing) {
        res.clearCookie('sc_oauth_state', { path: '/' });
        return res.redirect('/clouds?connect_error=already_connected');
      }
    }

    const { error: insertError } = await adminClient.from('connected_accounts').insert({
      user_id: oauth.userId,
      provider_id: providerDbId,
      provider_account_id: providerAccountId,
      display_name: account.email || account.accountId || provider.name,
      email: account.email || null,
      access_token: encryptToken(tokens.accessToken),
      refresh_token: tokens.refreshToken ? encryptToken(tokens.refreshToken) : null,
      token_type: tokens.tokenType,
      api_host: conn.apiHost,
      status: 'connected',
      storage_total: usage && usage.total ? usage.total : null,
      storage_used: usage && usage.used ? usage.used : null,
      last_sync_at: new Date().toISOString(),
    });
    if (insertError) {
      console.error('[oauth] failed to save connection:', insertError.message);
      res.clearCookie('sc_oauth_state', { path: '/' });
      return res.redirect('/clouds?connect_error=database');
    }

    res.clearCookie('sc_oauth_state', { path: '/' });
    res.redirect(`/clouds?connected=${provider.id}`);
  } catch (err) {
    console.error('[oauth] callback failed:', err.message);
    res.clearCookie('sc_oauth_state', { path: '/' });
    res.redirect('/clouds?connect_error=unknown');
  }
}

router.get('/:slug/callback', (req, res, next) => {
  handleOAuthCallback(req, res).catch(next);
});

export default router;