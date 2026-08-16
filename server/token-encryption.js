import crypto from 'node:crypto';
import config from './config.js';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:';

function keyBytes() {
  const secret = config.tokenEncryptionSecret;
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest();
}

// Encrypts a provider access token at rest. Without a configured
// TOKEN_ENCRYPTION_SECRET this returns the plaintext (dev fallback) so the
// app keeps working locally, but a warning is emitted at startup. In
// production the secret MUST be set.
export function encryptToken(value) {
  if (value == null || value === '') return value;
  const key = keyBytes();
  if (!key) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptToken(value) {
  if (value == null) return value;
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  const key = keyBytes();
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_SECRET is not configured; cannot decrypt stored provider token');
  }
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Stored provider token is malformed');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}