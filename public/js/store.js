import { api } from './api.js';

export const store = {
  user: null,
  profile: null,
  supabase: null,
  providers: [],
  pcloudConnected: false,
  storageByProvider: {},
  googleConfigured: false,
  seed: { used: 0, limit: 0, available: 0, percentage: 0, overQuota: false, ready: false },
};

export async function refreshProviders() {
  const data = await api.get('/api/clouds');
  store.providers = data.providers;
  const pcloud = data.providers.find((p) => p.id === 'pcloud');
  store.pcloudConnected = Boolean(
    pcloud && pcloud.connections && pcloud.connections.some((c) => c.status === 'connected')
  );
  return data.providers;
}

// Loads the user's Seed Cloud quota (512 MB logical quota, independent of the
// backend Google Drive account's own quota).
export async function refreshSeedStorage() {
  try {
    const data = await api.get('/api/storage');
    store.seed = {
      used: data.used || 0,
      limit: data.limit || 0,
      available: data.available || 0,
      percentage: data.percentage || 0,
      overQuota: Boolean(data.overQuota),
      ready: true,
    };
  } catch (err) {
    store.seed = { used: 0, limit: 0, available: 0, percentage: 0, overQuota: false, ready: false };
  }
  return store.seed;
}

export async function refreshProfile() {
  const data = await api.get('/api/auth/me');
  store.profile = data;
  return data;
}

export function isEmailConfirmed(user) {
  return Boolean(user && (user.email_confirmed_at || user.confirmed_at));
}
