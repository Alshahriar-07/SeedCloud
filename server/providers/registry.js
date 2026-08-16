import config from '../config.js';

// Central provider registry. Single source of truth for every cloud provider
// Seed Cloud represents, including its status. The API (GET /api/clouds,
// GET /api/providers) is built from this list so the frontend never hardcodes
// provider statuses itself.
//
// status:
//   supported    - documented, legitimate integration path exists
//   limited      - some operations possible but important ones are missing
//   unsupported  - no suitable authorized integration available today
//
// implemented:  an adapter exists and can complete a real connection.
// oauth:        the provider supports an OAuth2 consent flow.
//
// Providers are NEVER hidden. Unsupported ones stay discoverable with a clear
// reason instead of a Connect button.

export const PROVIDER_STATUS = {
  supported: 'supported',
  limited: 'limited',
  unsupported: 'unsupported',
};

const PROVIDERS = [
  {
    id: 'pcloud',
    name: 'pCloud',
    description: 'Secure cloud storage with client-side encryption',
    freeTier: '10 GB free',
    status: PROVIDER_STATUS.supported,
    oauth: true,
    implemented: true,
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Google Workspace storage',
    freeTier: '15 GB free',
    status: PROVIDER_STATUS.supported,
    oauth: true,
    implemented: true,
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    description: 'Microsoft 365 storage',
    freeTier: '5 GB free',
    status: PROVIDER_STATUS.supported,
    oauth: true,
    implemented: false,
  },
  {
    id: 'box',
    name: 'Box',
    description: 'Business content management',
    freeTier: '10 GB free',
    status: PROVIDER_STATUS.supported,
    oauth: true,
    implemented: false,
  },
  {
    id: 'koofr',
    name: 'Koofr',
    description: 'Unified storage manager',
    freeTier: 'Free tier available',
    status: PROVIDER_STATUS.supported,
    oauth: true,
    implemented: false,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'File sync and sharing',
    freeTier: '2 GB free',
    status: PROVIDER_STATUS.supported,
    oauth: true,
    implemented: false,
  },
  {
    id: 'mega',
    name: 'MEGA',
    description: 'Encrypted cloud storage',
    freeTier: '20 GB free',
    status: PROVIDER_STATUS.limited,
    oauth: false,
    implemented: false,
    limitedReason: 'Official SDK only — no OAuth2 consent flow yet',
  },
  {
    id: 'mediafire',
    name: 'MediaFire',
    description: 'File hosting and sharing',
    freeTier: '10 GB free',
    status: PROVIDER_STATUS.limited,
    oauth: false,
    implemented: false,
    limitedReason: 'Official API exists but has no OAuth2 — session-token auth only',
  },
  {
    id: 'proton-drive',
    name: 'Proton Drive',
    description: 'End-to-end encrypted storage',
    freeTier: 'Free tier available',
    status: PROVIDER_STATUS.limited,
    oauth: false,
    implemented: false,
    limitedReason: 'Official SDKs exist, but no third-party OAuth yet',
  },
  {
    id: 'degoo',
    name: 'Degoo',
    description: 'Backup-focused cloud storage',
    freeTier: '100 GB free',
    status: PROVIDER_STATUS.unsupported,
    oauth: false,
    implemented: false,
    unavailableReason: 'No public API or OAuth. Only undocumented internal endpoints.',
  },
  {
    id: 'icedrive',
    name: 'Icedrive',
    description: 'Cloud storage and backup',
    freeTier: '10 GB free',
    status: PROVIDER_STATUS.unsupported,
    oauth: false,
    implemented: false,
    unavailableReason: 'No public API or OAuth. WebDAV access is paid-only and being phased out.',
  },
  {
    id: 'idrive',
    name: 'IDrive',
    description: 'Backup and cloud storage',
    freeTier: '10 GB free',
    status: PROVIDER_STATUS.unsupported,
    oauth: false,
    implemented: false,
    unavailableReason: 'No official API for consumer accounts.',
  },
  {
    id: 'icloud',
    name: 'Apple iCloud',
    description: 'Apple ecosystem storage',
    freeTier: '5 GB free',
    status: PROVIDER_STATUS.unsupported,
    oauth: false,
    implemented: false,
    unavailableReason: 'No official API for a user\u2019s iCloud Drive.',
  },
  {
    id: 'sync',
    name: 'Sync.com',
    description: 'Privacy-focused cloud storage',
    freeTier: '5 GB free',
    status: PROVIDER_STATUS.unsupported,
    oauth: false,
    implemented: false,
    unavailableReason: 'No public API; its terms forbid third-party access.',
  },
  {
    id: 'internxt',
    name: 'Internxt',
    description: 'Encrypted cloud storage',
    freeTier: 'Free tier available',
    status: PROVIDER_STATUS.unsupported,
    oauth: false,
    implemented: false,
    unavailableReason: 'No public API for Internxt Drive.',
  },
];

export function getProviderRegistry() {
  return PROVIDERS.map((p) => ({ ...p }));
}

export function getProviderConfig(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
}

// Resolves the redirect_uri for a provider's OAuth app. A provider-specific
// PCLOUD_REDIRECT_URI-style env var wins; otherwise fall back to the canonical
// callback path on this server.
export function getRedirectUri(provider) {
  const providerConfig = config[provider.id];
  if (providerConfig && providerConfig.redirectUri) return providerConfig.redirectUri;
  return `${config.baseUrl}/api/oauth/${provider.id}/callback`;
}

// Whether this server has the credentials needed to run a real OAuth flow.
export function isProviderConfigured(id) {
  const providerConfig = config[id];
  if (!providerConfig) return false;
  return Boolean(providerConfig.clientId && providerConfig.clientSecret);
}