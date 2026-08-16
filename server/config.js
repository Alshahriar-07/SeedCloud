import dotenv from 'dotenv';

dotenv.config();

function fail(message) {
  console.error(`[config] Missing environment variable: ${message}`);
  process.exit(1);
}

const port = Number(process.env.PORT) || 3000;

const config = {
  port,
  baseUrl: (process.env.BASE_URL || `http://localhost:${port}`).replace(/\/$/, ''),
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
    defaultQuotaBytes: 1073741824, // 1 GiB per Seed Cloud user
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

if (!config.pcloud.clientId || !config.pcloud.clientSecret) {
  console.warn('[config] PCLOUD_CLIENT_ID / PCLOUD_CLIENT_SECRET not set. pCloud connect will be disabled.');
}

if (!config.google.clientId || !config.google.clientSecret || !config.google.redirectUri) {
  console.warn(
    '[config] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI not set. The internal Google Drive storage backend will be disabled.'
  );
}

export default config;
