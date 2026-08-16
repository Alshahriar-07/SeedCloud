import config from './config.js';
import { adminClient } from './supabase.js';
import { encryptToken, decryptToken } from './token-encryption.js';
import { GoogleDrive } from './providers/google-drive/drive.js';

// Core logic for Seed Cloud's INTERNAL default storage backend. Real file
// bytes live in the Seed Cloud owner's Google Drive account. Supabase stores
// only metadata (file rows, quota, Drive folder ids) and auth data. This module
// never runs in the browser and never returns tokens to a client.

const PROVIDER = 'google-drive';
const ROOT_FOLDER_NAME = 'Seed Cloud Storage';
export const DEFAULT_STORAGE_LIMIT = 1073741824; // 1 GiB per Seed Cloud user

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

export function googleConfigured() {
  return Boolean(config.google.clientId && config.google.clientSecret && config.google.redirectUri);
}

// Loads the single backend storage account row (provider = google-drive).
// Throws a clear StorageBackendError when it does not exist / is not authorized.
export async function getBackendAccount() {
  const { data, error } = await adminClient
    .from('storage_accounts')
    .select('*')
    .eq('provider', PROVIDER)
    .maybeSingle();
  if (error && !isMissingTable(error)) {
    throw new StorageBackendError('Could not read the storage backend account.', 'database');
  }
  if (isMissingTable(error)) {
    throw new StorageBackendError(
      'Seed Cloud storage database is not set up yet. Apply db/migration_google_storage.sql in the Supabase SQL editor.',
      'schema_missing'
    );
  }
  if (!data || data.status !== 'authorized' || !data.refresh_token_enc) {
    throw new StorageBackendError(
      'Seed Cloud storage backend is not authorized. The owner must authorize the Google Drive account.',
      'not_authorized'
    );
  }
  return data;
}

export async function getDrive() {
  const account = await getBackendAccount();
  let refreshToken;
  try {
    refreshToken = decryptToken(account.refresh_token_enc);
  } catch (err) {
    throw new StorageBackendError(
      'Stored Google credentials could not be decrypted (TOKEN_ENCRYPTION_SECRET may have changed).',
      'decrypt'
    );
  }
  return new GoogleDrive({
    clientId: config.google.clientId,
    clientSecret: config.google.clientSecret,
    redirectUri: config.google.redirectUri,
    refreshToken,
  });
}

// Finds or creates the single "Seed Cloud Storage" root folder inside the
// backend Drive account. The id is persisted in storage_accounts so restarts
// never create duplicates.
export async function ensureRootFolder() {
  const account = await getBackendAccount();
  if (account.root_folder_id) return account.root_folder_id;

  const drive = await getDrive();
  let folder = await drive.findFolder(null, ROOT_FOLDER_NAME);
  if (!folder) folder = await drive.createFolder(ROOT_FOLDER_NAME, null);

  const { error } = await adminClient
    .from('storage_accounts')
    .update({ root_folder_id: folder.id, updated_at: new Date().toISOString() })
    .eq('id', account.id);
  if (error) throw new StorageBackendError('Could not persist the Seed Cloud root folder.', 'database');
  return folder.id;
}

async function findOrCreateUserFolder(drive, rootFolderId, userId) {
  let folder = await drive.findFolder(rootFolderId, userId);
  if (!folder) folder = await drive.createFolder(userId, rootFolderId);
  return folder;
}

// Every user gets a user_storage row (1 GB quota) and their own Drive folder
// Seed Cloud Storage/<user_id>/ whose id is persisted (never name-based lookup).
export async function ensureUserStorage(userId) {
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
      'Seed Cloud storage database is not set up yet. Apply db/migration_google_storage.sql in the Supabase SQL editor.',
      'schema_missing'
    );
  }
  if (data && data.root_folder_id) return data;

  const rootFolderId = await ensureRootFolder();
  const drive = await getDrive();
  const userFolder = await findOrCreateUserFolder(drive, rootFolderId, userId);

  if (data) {
    const { error: updError } = await adminClient
      .from('user_storage')
      .update({ root_folder_id: userFolder.id, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (updError) throw new StorageBackendError('Could not persist your storage folder.', 'database');
    data.root_folder_id = userFolder.id;
    return data;
  }

  const { data: inserted, error: insError } = await adminClient
    .from('user_storage')
    .insert({
      user_id: userId,
      storage_limit: config.storage.defaultQuotaBytes,
      storage_used: 0,
      root_folder_id: userFolder.id,
    })
    .select()
    .single();
  if (insError) throw new StorageBackendError('Could not create your storage record.', 'database');
  return inserted;
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
  };
}

export function safeFile(row) {
  return {
    id: row.provider_file_id,
    dbId: row.id,
    name: row.name,
    mimeType: row.mime_type,
    size: Number(row.size) || 0,
    isFolder: Boolean(row.is_folder),
    parentFolderId: row.parent_folder_id,
    provider: 'Seed Cloud Storage',
    modified: row.updated_at ? new Date(row.updated_at).getTime() : null,
    createdAt: row.created_at,
  };
}

// Lists the user's files inside a folder (defaults to their own root folder).
// user_id is always taken from the authenticated session, never the client.
export async function listFiles(userId, folderId = null) {
  const rec = await ensureUserStorage(userId);
  const parent = folderId || rec.root_folder_id;
  let query = adminClient.from('files').select('*').eq('user_id', userId).order('name', { ascending: true });
  if (parent) query = query.eq('parent_folder_id', parent);
  const { data, error } = await query;
  if (error && !isMissingTable(error)) throw new StorageBackendError('Could not list your files.', 'database');
  if (isMissingTable(error)) {
    throw new StorageBackendError(
      'Seed Cloud storage database is not set up yet. Apply db/migration_google_storage.sql in the Supabase SQL editor.',
      'schema_missing'
    );
  }
  return (data || []).map(safeFile);
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
      'Seed Cloud storage database is not set up yet. Apply db/migration_google_storage.sql in the Supabase SQL editor.',
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

function cleanName(name) {
  const value = String(name || '').trim();
  if (!value || value.length > 255 || value.includes('\u0000')) return null;
  return value;
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

export async function uploadFile({ userId, name, mimeType, data, folderId }) {
  const rec = await ensureUserStorage(userId);
  const size = Buffer.byteLength(data);
  const used = Number(rec.storage_used) || 0;
  const limit = Number(rec.storage_limit) || config.storage.defaultQuotaBytes;

  if (used + size > limit) {
    const err = new StorageBackendError(
      `Storage limit reached. Your Seed Cloud storage limit is ${formatBytes(limit)}.`,
      'quota_exceeded'
    );
    err.status = 413;
    throw err;
  }

  let parentId = rec.root_folder_id;
  if (folderId) {
    const folder = await getUserFile(userId, folderId);
    if (!folder || !folder.is_folder) throw new StorageBackendError('Target folder not found.', 'not_found');
    parentId = folder.provider_file_id;
  }

  const drive = await getDrive();
  let driveFile;
  try {
    driveFile = await drive.uploadFile({
      folderId: parentId,
      name,
      mimeType: mimeType || 'application/octet-stream',
      data,
    });
  } catch (err) {
    throw new StorageBackendError(`Upload to Google Drive failed: ${err.message}`, 'provider');
  }

  // Metadata + usage must move together. If the database write fails after the
  // Drive upload, clean up the orphaned Drive file so quota stays consistent.
  try {
    const { error: insError } = await adminClient.from('files').insert({
      user_id: userId,
      name,
      mime_type: mimeType || driveFile.mimeType || null,
      size,
      provider: PROVIDER,
      provider_file_id: driveFile.id,
      parent_folder_id: parentId,
      is_folder: false,
    });
    if (insError) throw insError;
    const { error: usageError } = await adminClient
      .from('user_storage')
      .update({ storage_used: used + size, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (usageError) throw usageError;
  } catch (dbErr) {
    try {
      await drive.delete(driveFile.id);
    } catch (cleanupErr) {
      console.error('[storage] orphaned Drive file cleanup failed:', cleanupErr.message);
    }
    throw new StorageBackendError('Could not save the uploaded file metadata.', 'database');
  }

  const { data: saved } = await adminClient
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .eq('provider_file_id', driveFile.id)
    .maybeSingle();
  return safeFile(saved);
}

export async function createUserFolder(userId, name, folderId) {
  const rec = await ensureUserStorage(userId);
  const clean = cleanName(name);
  if (!clean) throw new StorageBackendError('Invalid folder name.');

  let parentId = rec.root_folder_id;
  if (folderId) {
    const folder = await getUserFile(userId, folderId);
    if (!folder || !folder.is_folder) throw new StorageBackendError('Target folder not found.', 'not_found');
    parentId = folder.provider_file_id;
  }

  const drive = await getDrive();
  let driveFolder;
  try {
    driveFolder = await drive.createFolder(clean, parentId);
  } catch (err) {
    throw new StorageBackendError(`Could not create the folder in Google Drive: ${err.message}`, 'provider');
  }

  const { error: insError } = await adminClient.from('files').insert({
    user_id: userId,
    name: clean,
    mime_type: 'application/vnd.google-apps.folder',
    size: 0,
    provider: PROVIDER,
    provider_file_id: driveFolder.id,
    parent_folder_id: parentId,
    is_folder: true,
  });
  if (insError) {
    try {
      await drive.delete(driveFolder.id);
    } catch (cleanupErr) {
      console.error('[storage] orphaned folder cleanup failed:', cleanupErr.message);
    }
    throw new StorageBackendError('Could not save the folder.', 'database');
  }
  const { data: saved } = await adminClient
    .from('files')
    .select('*')
    .eq('user_id', userId)
    .eq('provider_file_id', driveFolder.id)
    .maybeSingle();
  return safeFile(saved);
}

export async function renameFile(userId, fileId, name) {
  const file = await getUserFile(userId, fileId);
  if (!file) throw new StorageBackendError('File not found.', 'not_found');
  const clean = cleanName(name);
  if (!clean) throw new StorageBackendError('Invalid file name.');

  const drive = await getDrive();
  try {
    await drive.rename(file.provider_file_id, clean);
  } catch (err) {
    throw new StorageBackendError(`Could not rename the file in Google Drive: ${err.message}`, 'provider');
  }

  const { error: updError } = await adminClient
    .from('files')
    .update({ name: clean, updated_at: new Date().toISOString() })
    .eq('id', file.id)
    .eq('user_id', userId);
  if (updError) throw new StorageBackendError('Could not update the file name.', 'database');

  const { data: updated } = await adminClient.from('files').select('*').eq('id', file.id).maybeSingle();
  return safeFile(updated);
}

export async function deleteFile(userId, fileId) {
  const file = await getUserFile(userId, fileId);
  if (!file) throw new StorageBackendError('File not found.', 'not_found');

  const drive = await getDrive();
  try {
    await drive.delete(file.provider_file_id);
  } catch (err) {
    throw new StorageBackendError(`Could not delete the file in Google Drive: ${err.message}`, 'provider');
  }

  const { error: delError } = await adminClient.from('files').delete().eq('id', file.id).eq('user_id', userId);
  if (delError) throw new StorageBackendError('Could not remove the file metadata.', 'database');

  const usage = await loadUsage(userId);
  await adminClient
    .from('user_storage')
    .update({
      storage_used: Math.max(0, (Number(usage.storage_used) || 0) - (Number(file.size) || 0)),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  return { ok: true };
}

export async function downloadFile(userId, fileId) {
  const file = await getUserFile(userId, fileId);
  if (!file) throw new StorageBackendError('File not found.', 'not_found');
  if (file.is_folder) throw new StorageBackendError('Cannot download a folder.', 'invalid');
  const drive = await getDrive();
  const res = await drive.download(file.provider_file_id);
  return { res, file };
}

export async function saveBackendAccount({ refreshToken, email }) {
  const { data: existing } = await adminClient
    .from('storage_accounts')
    .select('id')
    .eq('provider', PROVIDER)
    .maybeSingle();
  const payload = {
    provider: PROVIDER,
    status: 'authorized',
    refresh_token_enc: encryptToken(refreshToken),
    account_email: email || null,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    const { error } = await adminClient.from('storage_accounts').update(payload).eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }
  const { error, data } = await adminClient.from('storage_accounts').insert({ ...payload, root_folder_id: null }).select().single();
  if (error) throw error;
  return data.id;
}
