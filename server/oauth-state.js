import { randomBytes } from 'node:crypto';

const store = new Map();
const TTL_MS = 10 * 60 * 1000;

export function createOAuthState({ userId, provider }) {
  const state = randomBytes(24).toString('hex');
  store.set(state, { userId, provider, createdAt: Date.now() });
  return state;
}

export function consumeOAuthState(state) {
  const entry = store.get(state);
  if (!entry) return null;
  store.delete(state);
  if (Date.now() - entry.createdAt > TTL_MS) return null;
  return entry;
}
