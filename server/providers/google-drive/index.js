import config from '../../config.js';
import { ProviderAdapter } from '../base/ProviderAdapter.js';
import { GoogleDrive } from './drive.js';

// Google Drive as a USER-connected cloud provider. When a user connects their
// OWN Google Drive account, Seed Cloud routes file bytes there (scope:
// drive.file). This is NOT Seed Cloud's own storage backend — Seed Cloud has no
// internal/default storage of its own.

function decodeIdToken(idToken) {
  if (!idToken) return null;
  try {
    const payload = idToken.split('.')[1];
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export class GoogleDriveAdapter extends ProviderAdapter {
  constructor() {
    super({ id: 'google-drive', name: 'Google Drive' });
  }

  capabilities() {
    return {
      oauth: true,
      list: true,
      upload: true,
      download: true,
      createFolder: true,
      rename: true,
      delete: true,
      share: false,
      quota: true,
    };
  }

  client(conn) {
    return new GoogleDrive({
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      redirectUri: config.google.redirectUri,
      refreshToken: conn.refreshToken || null,
    });
  }

  getOAuthUrl({ state, redirectUri, clientId }) {
    return GoogleDrive.getAuthUrl({ clientId, redirectUri, state });
  }

  async exchangeCode({ code, redirectUri, clientId, clientSecret }) {
    const client = new GoogleDrive({ clientId, clientSecret, redirectUri });
    const json = await client.exchangeCode({ code });
    const decoded = decodeIdToken(json.id_token);
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token || null,
      tokenType: json.token_type || 'Bearer',
      providerAccountId: decoded && decoded.sub ? String(decoded.sub) : null,
      email: decoded && decoded.email ? decoded.email : null,
    };
  }

  async getAccount(conn) {
    const info = await this.client(conn).about();
    return {
      accountId: (info.user && info.user.emailAddress) || null,
      email: info.user && info.user.emailAddress,
      displayName: info.user && info.user.displayName,
    };
  }

  async getStorageUsage(conn) {
    return this.client(conn).aboutStorage();
  }

  async listFiles(conn, { folderId = 'root' } = {}) {
    const items = await this.client(conn).listChildren(folderId);
    return items.map((f) => ({
      id: f.id,
      parentId: folderId,
      name: f.name,
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      size: Number(f.size) || 0,
      mimeType: f.mimeType || null,
      modified: f.modifiedTime ? new Date(f.modifiedTime).getTime() : null,
    }));
  }

  async createFolder(conn, { name, parentId = 'root' }) {
    const created = await this.client(conn).createFolder(name, parentId === 'root' ? null : parentId);
    return { id: created.id, name: created.name, isFolder: true };
  }

  async rename(conn, { fileId, newName, isFolder }) {
    await this.client(conn).rename(fileId, newName);
    return { ok: true };
  }

  async delete(conn, { fileId, isFolder }) {
    await this.client(conn).trash(fileId);
    return { ok: true };
  }

  async upload(conn, { filename, folderId = 'root', data }) {
    const uploaded = await this.client(conn).uploadFile({
      folderId: folderId === 'root' ? null : folderId,
      name: filename,
      mimeType: null,
      data,
    });
    return {
      id: uploaded.id,
      name: uploaded.name,
      isFolder: false,
      size: Number(uploaded.size) || 0,
      mimeType: uploaded.mimeType || null,
    };
  }

  async download(conn, fileId) {
    return this.client(conn).download(fileId);
  }
}

export default new GoogleDriveAdapter();