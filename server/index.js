import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './config.js';
import authRoutes from './routes/auth.js';
import providersRoutes from './routes/providers.js';
import oauthRoutes from './routes/oauth.js';
import cloudsRoutes from './routes/clouds.js';
import pcloudRoutes from './routes/pcloud.js';
import sharesRoutes from './routes/shares.js';
import storageRoutes from './routes/storage.js';
import filesRoutes from './routes/files.js';
import { createMathChallenge, verifyMathChallenge } from './math-captcha.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
    pcloudConfigured: Boolean(config.pcloud.clientId && config.pcloud.clientSecret),
    googleConfigured: Boolean(config.google.clientId && config.google.clientSecret && config.google.redirectUri),
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'seed-cloud' });
});

// Math challenge ("human verification") for the signup form. The challenge is
// generated server-side; the expected answer is stored in Supabase (it must
// survive Vercel serverless invocations, which share no memory) and validated
// on /api/captcha/verify. The answer is never exposed to the browser.
app.get('/api/captcha', async (req, res, next) => {
  try {
    res.json(await createMathChallenge());
  } catch (err) {
    next(err);
  }
});

app.post('/api/captcha/verify', async (req, res, next) => {
  try {
    const { challengeId, answer } = req.body || {};
    const result = await verifyMathChallenge(challengeId, answer);
    if (!result.ok) {
      return res.status(400).json({ verified: false, error: result.reason });
    }
    res.json({ verified: true });
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRoutes);

// Canonical cloud connection API.
app.use('/api/oauth', oauthRoutes);
app.use('/api/clouds', cloudsRoutes);

// Mount the generic providers router BEFORE provider-specific routers so that
// unauthenticated OAuth callbacks are not intercepted by provider router auth.
app.use('/api/providers', providersRoutes);
app.use('/api/providers/pcloud', pcloudRoutes);
app.use('/api/shares', sharesRoutes);

// Seed Cloud internal default storage backend (Google Drive + quota + files).
app.use('/api/storage', storageRoutes);
app.use('/api/files', filesRoutes);

const APP_PAGE = path.join(__dirname, '..', 'public', 'app.html');
const APP_ROUTES = [
  '/dashboard',
  '/files',
  '/upload',
  '/downloads',
  '/access',
  '/storage',
  '/clouds',
  '/profile',
  '/settings',
];
for (const route of APP_ROUTES) {
  app.get(route, (req, res) => res.sendFile(APP_PAGE));
}

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'signup.html'));
});
app.get('/verify-email', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'verify-email.html'));
});
app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'forgot-password.html'));
});
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'reset-password.html'));
});
app.get('/docs/cloud-connections', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'docs', 'cloud-connections.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error('[error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Vercel imports this module as a serverless function and invokes the exported
// `app` directly. Only a long-running local/self-hosted process may call
// app.listen(). Vercel sets VERCEL=1 / VERCEL_ENV at runtime.
const onVercel = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
if (!onVercel) {
  app.listen(config.port, () => {
    console.log(`Seed Cloud running at ${config.baseUrl}`);
  });
}

export default app;
