import { randomBytes } from 'node:crypto';
import { adminClient } from './supabase.js';

// OAuth authorization state, persisted in Supabase so it survives Vercel
// serverless invocations (which share no process memory). Rows are single-use
// (deleted on consume) and expire server-side.
//
// Requires the `oauth_state` table from db/migration_serverless.sql.

const TTL_MS = 10 * 60 * 1000;

export async function createOAuthState({ userId = null, provider }) {
  const state = randomBytes(24).toString('hex');
  const { error } = await adminClient.from('oauth_state').insert({
    state,
    user_id: userId,
    provider,
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
  });
  if (error) {
    throw new Error(`Could not persist OAuth state (${error.message})`);
  }
  // Opportunistic cleanup of expired rows; best-effort.
  await adminClient
    .from('oauth_state')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .catch(() => {});
  return state;
}

// consumeOAuthState removes the row, so the state is single-use. A reused,
// missing or expired state returns null and must be rejected by the caller.
export async function consumeOAuthState(state) {
  if (!state) return null;
  const { data, error } = await adminClient
    .from('oauth_state')
    .select('user_id, provider, expires_at')
    .eq('state', state)
    .maybeSingle();
  if (error || !data) {
    await adminClient.from('oauth_state').delete().eq('state', state).catch(() => {});
    return null;
  }
  await adminClient.from('oauth_state').delete().eq('state', state);
  if (Date.now() > new Date(data.expires_at).getTime()) return null;
  return { userId: data.user_id, provider: data.provider };
}