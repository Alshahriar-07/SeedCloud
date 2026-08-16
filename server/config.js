import dotenv from 'dotenv';

dotenv.config();

function fail(message) {
  console.error(`[config] Missing environment variable: ${message}`);
  process.exit(1);
}

const port = Number(process.env.PORT) || 3000;

// Resolves the public base URL used to build OAuth redirect_uri values.
// 1. Explicit BASE_URL wins (recommended; set it to https://seedcloud.vercel.app
//    in the Vercel project's production environment variables).
// 2. On Vercel, fall back to the production URL Vercel exposes at runtime.
// 3. Local development defaults to http://localhost:<port>.
function resolveBaseUrl() {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL) {
    const vercelBase = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    if (vercelBase) return `https://${vercelBase.replace(/^https?:\/\//, '')}`.replace(/\/$/, '');
  }
  return `http://localhost:${port}`;
}

const baseUrl = resolveBaseUrl();

const config = {
  port,
  baseUrl,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  tokenEncryptionSecret: process.env.TOKEN_ENCRYPTION_SECRET || '',
  pcloud: {
    clientId: process.env.PCLOUD_CLIENT_ID,
    clientSecret: process.env.PCLOUD_CLIENT_SECRET,
    redirectUri: process.env.PCLOUD_REDIRECT_URI || '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  },
  storage: {
    defaultQuotaBytes: 536870912, // 512 MiB per Seed Cloud user
  },
};

// The service role key is REQUIRED: adminClient (used for every privileged
// database operation, including reading/writing provider tokens in
// connected_accounts) must bypass RLS and column grants. Falling back to the
// publishable key would silently break every privileged write under RLS.
const required = ['supabaseUrl', 'supabaseAnonKey', 'supabaseServiceRoleKey'];
for (const key of required) {
  if (!config[key]) fail(key);
}

if (!config.tokenEncryptionSecret) {
  console.warn('[config] TOKEN_ENCRYPTION_SECRET not set. Provider tokens will be stored in plaintext (dev only). Set it before production.');
}

if (process.env.VERCEL && !process.env.BASE_URL) {
  console.warn(
    `[config] On Vercel with BASE_URL unset; OAuth redirect URIs will be derived from the deployment URL (${baseUrl}). Set BASE_URL=https://seedcloud.vercel.app in production to keep redirect URIs stable.`
  );
}

if (!config.pcloud.clientId || !config.pcloud.clientSecret) {
  console.warn('[config] PCLOUD_CLIENT_ID / PCLOUD_CLIENT_SECRET not set. pCloud connect will be disabled.');
}

if (!config.google.clientId || !config.google.clientSecret || !config.google.redirectUri) {
  console.warn(
    '[config] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI not set. Connecting a user\u2019s own Google Drive will be disabled.'
  );
}

export default config;
