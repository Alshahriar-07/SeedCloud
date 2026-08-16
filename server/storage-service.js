import { Readable } from 'node:stream';
import config from './config.js';
import { adminClient } from './supabase.js';
import { getProvider } from './providers/index.js';
import { getPrimaryConnection, getConnectionById, getProviderSlugById } from './connections.js';

// Seed Cloud is a CLOUD STORAGE ROUTER. Actual file bytes live ONLY on the
// user's connected third-party cloud providers (their Google Drive, pCloud,
// Dropbox, ...). Supabase stores ONLY:
//   - auth (Supabase Auth)
//   - the user's logical quota (user_storage)
//   - file metadata (files)
//   - provider connection metadata (connected_accounts)
// This module never runs in the browser, never returns a provider token, and
// never uses Supabase Storage for file bytes.

export const DEFAULT_STORAGE_LIMIT = 536870912; // 512 MiB per Seed Cloud user

export class StorageBackendError extends Error {
  constructor(message, code = 'storage_error') {
    super(message);
    this.code = code;
  }
}

function isMissingTable(error) {
  // PostgREST reports a missing table as PGRST205; the raw Postgres code is 42P01.
  return error && (error.code === 'PGRST205' || error.code === '42P01');
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const num = value / 1024 ** i;
  return `${num >= 100 ? num.toFixed(0) : num.toFixed(1)} ${units[i]}`;
}

// ---------------------------------------------------------------------------
// Logical Seed Cloud quota (user_storage). The quota is the LOGICAL Seed Cloud
// allowance (512 MiB by default) and is independent of the connected
// providers' physical capacity.
// ---------------------------------------------------------------------------

async function readUserStorage(userId) {
  const { data, error } = await adminClient
    .from('user_storage')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error && !isMissingTable(error)) {
    throw new StorageBackendError('Could not read your storage record.', 'database');
  }
  if (isMissingTable(error)) {
    throw new StorageBackendError(
      'Seed Cloud database is not set up yet. Apply the SQL migrations in the Supabase SQL editor.',
      'schema_missing'
    );
  }
  return data;
}

// Returns the user's storage row, creating it with the default 512 MiB quota if
// it does not exist. New user records are normally created by a database
// trigger on auth.users insert (db/migration_512mb_storage.sql); this is the
// idempotent lazy fallback (user_id is the primary key / unique index).
export async function ensureUserStorage(userId) {
  let data = await readUserStorage(userId);
  if (data) return data;

  const { error: insError } = await adminClient
    .from('user_storage')
    .upsert(
      {
        user_id: userId,
        storage_limit: config.storage.defaultQuotaBytes,
        storage_used: 0,
      },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );
  if (insError) throw new StorageBackendError('Could not create your storage record.', 'database');

  const rec = await readUserStorage(userId);
  if (!rec) throw new StorageBackendError('Could not read your storage record.', 'database');
  return rec;
}

export async function getStorageInfo(userId) {
  const rec = await ensureUserStorage(userId);
  const used = Number(rec.storage_used) || 0;
  const limit = Number(rec.storage_limit) || config.storage.defaultQuotaBytes;
  return {
    used,
    limit,
    available: Math.max(0, limit - used),
    percentage: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
    overQuota: Boolean(rec.is_over_quota),
  };
}

async function loadUsage(userId) {
  const { data, error } = await adminClient
    .from('user_storage')
    .select('storage_used, storage_limit')
    .eq('user_id', userId)
    .maybeSingle();
  if (error && !isMissingTable(error)) throw new StorageBackendError('Could not read your storage usage.', 'database');
  if (!data) throw new StorageBackendError('No storage record found for this user.', 'database');
  return data;
}

// ---------------------------------------------------------------------------
// Provider routing
// ---------------------------------------------------------------------------

// Shape passed to provider adapters: server-side, token already decrypted.
function providerConn(conn) {
  return {
    accessToken: conn.access_token,
    refreshToken: conn.refresh_token,
    apiHost: conn.api_host,
    tokenType: conn.token_type,
  };
}

// Resolves the connected account that actually holds a file row (so rename /
// delete / download always go back to the right provider account).
async function requireConnectionForRow(userId, row) {
  if (!row.connected_account_id) {
    throw new StorageBackendError(
      'The cloud that holds this file is no longer connected. Reconnect it to manage the file.',
      'not_found'
    );
  }
  const conn = await getConnectionById({ id: row.connected_account_id, userId });
  if (!conn || conn.status !== 'connected') {
    throw new StorageBackendError(
      'The cloud that holds this file is no longer connected. Reconnect it to manage the file.',
      'not_found'
    );
  }
  const slug = await getProviderSlugById(conn.provider_id);
  const provider = getProvider(slug);
  if (!provider) throw new StorageBackendError('The provider for this file is not available.', 'provider');
  return { conn, provider };
}

function ensureCapability(provider, capability) {
  const caps = typeof provider.capabilities === 'function' ? provider.capabilities() : {};
  if (!caps[capability]) {
    throw new StorageBackendError(`${provider.name} does not support ${capability} yet.`, 'provider');
  }
}

function cleanName(name) {
  const value = String(name || '').trim();
  if (!value || value.length > 255 || value.includes('\u0000')) return null;
  return value;
}

// ---------------------------------------------------------------------------
// File metadata (files table) + operations routed to the connected provider
// ---------------------------------------------------------------------------

export function safeFile(row) {
  return {
    id: row.provider_file_id,
    dbId: row.id,
    name: row.name,
    mimeType: row.mime_type,
    size: Number(row.size) || 0,
    isFolder: Boolean(row.is_folder),
    parentFolderId: row.parent_folder_id || null,
    provider: 'Seed Cloud Storage',
    modified: row.updated_at ? new Date(row.updated_at).getTime() : null,
    createdAt: row.created_at,
  };
}

export async function getUserFile(userId, fileId) {
  const idParam = String(fileId);
  const { data, error } = await adminClient
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .eq('provider_file_id', idParam)
    .maybeSingle();
  if (error && !isMissingTable(error)) throw new StorageBackendError('Could not read the file.', 'database');
  if (isMissingTable(error)) {
    throw new StorageBackendError(
      'Seed Cloud database is not set up yet. Apply the SQL migrations in the Supabase SQL editor.',
      'schema_missing'
    );
  }
  if (data) return data;
  if (/^\d+$/.test(idParam)) {
    const r2 = await adminClient.from('files').select('*').eq('user_id', userId).eq('id', Number(idParam)).maybeSingle();
    if (r2.error && !isMissingTable(r2.error)) throw new StorageBackendError('Could not read the file.', 'database');
    if (r2.data) return r2.data;
  }
  return null;
}

// Lists the user's files inside a folder. Root = rows with no parent folder.
// user_id is always taken from the authenticated session, never the client.
export async function listFiles(userId, folderId = null) {
  let query = adminClient.from('files').select('*').eq('user_id', userId);
  if (folderId) query = query.eq('parent_folder_id', folderId);
  else query = query.is('parent_folder_id', null);
  const { data, error } = await query.order('name', { ascending: true });
  if (error && !isMissingTable(error)) throw new StorageBackendError('Could not list your files.', 'database');
  if (isMissingTable(error)) {
    throw new StorageBackendError(
      'Seed Cloud database is not set up yet. Apply the SQL migrations in the Supabase SQL editor.',
      'schema_missing'
    );
  }
  return (data || []).map(safeFile);
}

export async function uploadFile({ userId, name, mimeType, data, folderId }) {
  const rec = await ensureUserStorage(userId);
  const size = Buffer.byteLength(data);
  const used = Number(rec.storage_used) || 0;
  const limit = Number(rec.storage_limit) || config.storage.defaultQuotaBytes;

  const quotaMessage = `Storage limit reached. You have ${formatBytes(limit)} of free storage.`;
  if (rec.is_over_quota || used + size > limit) {
    const err = new StorageBackendError(quotaMessage, 'quota_exceeded');
    err.status = 413;
    throw err;
  }

  const clean = cleanName(name);
  if (!clean) throw new StorageBackendError('Invalid file name.');

  const primary = await getPrimaryConnection(userId);
  if (!primary) {
    throw new StorageBackendError('Connect a cloud storage provider before uploading files.', 'no_cloud_connected');
  }
  const { conn, provider } = primary;
  ensureCapability(provider, 'upload');

  let uploaded;
  try {
    uploaded = await provider.upload(providerConn(conn), {
      filename: clean,
      folderId: folderId || undefined,
      data,
    });
  } catch (err) {
    throw new StorageBackendError(`Upload to ${provider.name} failed: ${err.message}`, 'provider');
  }

  // Metadata + usage must move together. If the database write fails after the
  // provider upload, delete the just-uploaded file so quota stays consistent.
  try {
    const { error: insError } = await adminClient.from('files').insert({
      user_id: userId,
      name: clean,
      mime_type: mimeType || uploaded.mimeType || null,
      size,
      provider: provider.id,
      connected_account_id: conn.id,
      provider_file_id: String(uploaded.id),
      parent_folder_id: folderId || null,
      is_folder: false,
    });
    if (insError) throw insError;
    const { error: usageError } = await adminClient
      .from('user_storage')
      .update({ storage_used: used + size, is_over_quota: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (usageError) throw usageError;
  } catch (dbErr) {
    try {
      await provider.delete(providerConn(conn), { fileId: uploaded.id, isFolder: false });
    } catch (cleanupErr) {
      console.error('[files] orphaned provider file cleanup failed:', cleanupErr.message);
    }
    throw new StorageBackendError('Could not save the uploaded file metadata.', 'database');
  }

  const saved = await getUserFile(userId, String(uploaded.id));
  return saved ? safeFile(saved) : null;
}

export async function createUserFolder(userId, name, folderId) {
  const clean = cleanName(name);
  if (!clean) throw new StorageBackendError('Invalid folder name.');

  const primary = await getPrimaryConnection(userId);
  if (!primary) {
    throw new StorageBackendError('Connect a cloud storage provider before creating folders.', 'no_cloud_connected');
  }
  const { conn, provider } = primary;
  ensureCapability(provider, 'createFolder');

  let created;
  try {
    created = await provider.createFolder(providerConn(conn), {
      name: clean,
      parentId: folderId || undefined,
    });
  } catch (err) {
    throw new StorageBackendError(`Could not create the folder in ${provider.name}: ${err.message}`, 'provider');
  }

  const { error: insError } = await adminClient.from('files').insert({
    user_id: userId,
    name: clean,
    mime_type: 'application/vnd.google-apps.folder',
    size: 0,
    provider: provider.id,
    connected_account_id: conn.id,
    provider_file_id: String(created.id),
    parent_folder_id: folderId || null,
    is_folder: true,
  });
  if (insError) {
    try {
      await provider.delete(providerConn(conn), { fileId: created.id, isFolder: true });
    } catch (cleanupErr) {
      console.error('[files] orphaned folder cleanup failed:', cleanupErr.message);
    }
    throw new StorageBackendError('Could not save the folder.', 'database');
  }
  const saved = await getUserFile(userId, String(created.id));
  return saved ? safeFile(saved) : null;
}

export async function renameFile(userId, fileId, name) {
  const file = await getUserFile(userId, fileId);
  if (!file) throw new StorageBackendError('File not found.', 'not_found');
  const clean = cleanName(name);
  if (!clean) throw new StorageBackendError('Invalid file name.');

  const { conn, provider } = await requireConnectionForRow(userId, file);
  try {
    await provider.rename(providerConn(conn), {
      fileId: file.provider_file_id,
      newName: clean,
      isFolder: file.is_folder,
    });
  } catch (err) {
    throw new StorageBackendError(`Could not rename the file in ${provider.name}: ${err.message}`, 'provider');
  }

  const { error: updError } = await adminClient
    .from('files')
    .update({ name: clean, updated_at: new Date().toISOString() })
    .eq('id', file.id)
    .eq('user_id', userId);
  if (updError) throw new StorageBackendError('Could not update the file name.', 'database');

  const updated = await getUserFile(userId, fileId);
  return safeFile(updated);
}

export async function deleteFile(userId, fileId) {
  const file = await getUserFile(userId, fileId);
  if (!file) throw new StorageBackendError('File not found.', 'not_found');

  const { conn, provider } = await requireConnectionForRow(userId, file);
  try {
    await provider.delete(providerConn(conn), { fileId: file.provider_file_id, isFolder: file.is_folder });
  } catch (err) {
    throw new StorageBackendError(`Could not delete the file in ${provider.name}: ${err.message}`, 'provider');
  }

  const { error: delError } = await adminClient.from('files').delete().eq('id', file.id).eq('user_id', userId);
  if (delError) throw new StorageBackendError('Could not remove the file metadata.', 'database');

  const usage = await loadUsage(userId);
  const newUsed = Math.max(0, (Number(usage.storage_used) || 0) - (Number(file.size) || 0));
  const limit = Number(usage.storage_limit) || config.storage.defaultQuotaBytes;
  await adminClient
    .from('user_storage')
    .update({
      storage_used: newUsed,
      is_over_quota: newUsed > limit,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  return { ok: true };
}

export async function downloadFile(userId, fileId) {
  const file = await getUserFile(userId, fileId);
  if (!file) throw new StorageBackendError('File not found.', 'not_found');
  if (file.is_folder) throw new StorageBackendError('Cannot download a folder.', 'invalid');

  const { conn, provider } = await requireConnectionForRow(userId, file);
  let res;
  try {
    res = await provider.download(providerConn(conn), file.provider_file_id);
  } catch (err) {
    throw new StorageBackendError(`Could not download the file from ${provider.name}: ${err.message}`, 'provider');
  }
  return { res, file };
}

export function webStreamToNode(webStream) {
  if (!webStream) throw new Error('No response body');
  if (typeof webStream[Symbol.asyncIterator] === 'function') return Readable.from(webStream);
  return Readable.fromWeb(webStream);
}