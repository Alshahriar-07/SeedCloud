import { createClient } from '@supabase/supabase-js';
import config from './config.js';

const anonClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const adminClient = config.supabaseServiceRoleKey
  ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : anonClient;

export async function getUserFromToken(token) {
  if (!token) return null;
  const { data, error } = await anonClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
