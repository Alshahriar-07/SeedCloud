import { getProviderConfig } from './registry.js';
import pcloud from './pcloud/index.js';
import googleDrive from './google-drive/index.js';
import onedrive from './onedrive/index.js';
import dropbox from './dropbox/index.js';
import koofr from './koofr/index.js';
import box from './box/index.js';

// Adapter registry. Only adapters listed here can participate in a real
// connection. Placeholder adapters throw on any method call until implemented.
const ADAPTERS = {
  pcloud,
  'google-drive': googleDrive,
  onedrive,
  dropbox,
  koofr,
  box,
};

// Returns the provider adapter instance for a slug, or null when unknown.
// The adapter carries id/name plus the connection methods (connect, account,
// quota, files, etc.). Registry metadata (status, free tier, reasons) comes
// from getProviderConfig() in registry.js.
export function getProvider(slug) {
  return ADAPTERS[slug] || null;
}

// Convenience: registry metadata + adapter in one object. Returns null for
// unknown slugs.
export function getProviderDescriptor(slug) {
  const config = getProviderConfig(slug);
  const adapter = getProvider(slug);
  if (!config && !adapter) return null;
  return {
    ...config,
    adapter,
    name: (config && config.name) || (adapter && adapter.name) || slug,
  };
}