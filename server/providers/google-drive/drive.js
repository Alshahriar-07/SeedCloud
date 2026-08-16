import { Readable } from 'node:stream';

// Server-side Google Drive API client (Google OAuth2 + Drive v3) built on the
// global fetch. Used for Seed Cloud's INTERNAL default storage backend (the
// Seed Cloud owner's Google Drive account). Never import this in the browser.

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API_ROOT = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function apiError(res, json) {
  const detail = (json && json.error && json.error.message) || '';
  const err = new Error(detail || `Google Drive API error (HTTP ${res.status})`);
  err.status = res.status;
  return err;
}

export class GoogleDrive {
  constructor({ clientId, clientSecret, redirectUri, refreshToken }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
    this.refreshToken = refreshToken || null;
    this.accessToken = null;
    this.accessTokenExpiry = 0;
  }

  static getAuthUrl({ clientId, redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCode({ code }) {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: this.redirectUri,
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.error) {
      throw new Error('Google token exchange failed');
    }
    return json;
  }

  async refreshAccessToken() {
    if (!this.refreshToken) throw new Error('No Google refresh token available');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.error) {
      throw new Error('Google token refresh failed');
    }
    this.accessToken = json.access_token;
    this.accessTokenExpiry = Date.now() + ((json.expires_in || 3600) * 1000) - 60000;
    return this.accessToken;
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.accessTokenExpiry) return this.accessToken;
    return this.refreshAccessToken();
  }

  // Low-level JSON API call. path starts with "/".
  async api(path, { method = 'GET', params = {}, body = null, headers = {} } = {}) {
    const token = await this.getAccessToken();
    const url = new URL(`${API_ROOT}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw apiError(res, json);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async about() {
    return this.api('/about', { params: { fields: 'user(emailAddress,displayName)' } });
  }

  async createFolder(name, parentId) {
    const body = { name, mimeType: FOLDER_MIME };
    if (parentId) body.parents = [parentId];
    return this.api('/files', {
      method: 'POST',
      params: { fields: 'id,name,mimeType,modifiedTime' },
      body,
    });
  }

  async findFolder(parentId, name) {
    let q = `name='${String(name).replace(/'/g, "\\'")}' and mimeType='${FOLDER_MIME}' and trashed=false`;
    if (parentId) q += ` and '${parentId}' in parents`;
    const data = await this.api('/files', { params: { q, fields: 'files(id,name,mimeType)' } });
    return data.files && data.files[0] ? data.files[0] : null;
  }

  async listChildren(folderId) {
    let pageToken = null;
    const files = [];
    do {
      const params = {
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken,files(id,name,size,mimeType,modifiedTime)',
        pageSize: 200,
      };
      if (pageToken) params.pageToken = pageToken;
      const data = await this.api('/files', { params });
      files.push(...(data.files || []));
      pageToken = data.nextPageToken || null;
    } while (pageToken);
    return files;
  }

  async uploadFile({ folderId, name, mimeType, data }) {
    const token = await this.getAccessToken();
    const metadata = { name };
    if (folderId) metadata.parents = [folderId];
    const form = new FormData();
    form.set('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.set('file', new Blob([data], { type: mimeType || 'application/octet-stream' }), name);
    const res = await fetch(`${API_ROOT}/files?uploadType=multipart&fields=id,name,size,mimeType,modifiedTime`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw apiError(res, json);
    }
    return res.json();
  }

  async getFile(fileId) {
    return this.api(`/files/${fileId}`, { params: { fields: 'id,name,size,mimeType,modifiedTime,trashed' } });
  }

  async rename(fileId, name) {
    return this.api(`/files/${fileId}`, { method: 'PATCH', body: { name } });
  }

  async trash(fileId) {
    return this.api(`/files/${fileId}`, { method: 'PATCH', body: { trashed: true } });
  }

  async delete(fileId) {
    return this.api(`/files/${fileId}`, { method: 'DELETE' });
  }

  // Returns the raw fetch Response so the caller can stream the body.
  async download(fileId) {
    const token = await this.getAccessToken();
    const res = await fetch(`${API_ROOT}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Google Drive download failed (HTTP ${res.status})`);
    return res;
  }
}

export function webStreamToNode(webStream) {
  if (!webStream) throw new Error('No response body');
  if (typeof webStream[Symbol.asyncIterator] === 'function') return Readable.from(webStream);
  return Readable.fromWeb(webStream);
}
