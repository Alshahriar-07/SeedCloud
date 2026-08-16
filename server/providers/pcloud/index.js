import { ProviderAdapter } from '../base/ProviderAdapter.js';
import { PcloudApi } from './api.js';

const OAUTH_AUTHORIZE_URL = 'https://my.pcloud.com/oauth2/authorize';
const OAUTH_TOKEN_URL = 'https://api.pcloud.com/oauth2_token';

function toFileEntry(item) {
  const isFolder = Boolean(item.isfolder);
  return {
    id: isFolder ? String(item.folderid) : String(item.fileid),
    parentId: item.parentfolderid !== undefined ? String(item.parentfolderid) : null,
    name: item.name,
    isFolder,
    size: Number(item.size) || 0,
    mimeType: item.contenttype || null,
    modified: item.mtime ? item.mtime * 1000 : null,
    isLocked: Boolean(item.islocked),
  };
}

export class PCloudAdapter extends ProviderAdapter {
  constructor() {
    super({ id: 'pcloud', name: 'pCloud' });
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
      share: true,
      quota: true,
    };
  }

  getOAuthUrl({ state, redirectUri, clientId }) {
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      state,
      permissions: 'manageshares',
    });
    return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCode({ code, redirectUri, clientId, clientSecret }) {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = await res.json().catch(() => null);
    if (!json || json.result !== 0) {
      throw new Error((json && json.error) || 'pCloud token exchange failed');
    }
    return {
      accessToken: json.access_token,
      tokenType: json.token_type,
      providerAccountId: String(json.uid),
    };
  }

  async getAccount(conn) {
    const api = new PcloudApi(conn);
    const info = await api.call('userinfo');
    return {
      accountId: String(info.userid),
      email: info.email,
      plan: info.plan,
      quota: info.quota,
      usedQuota: info.usedquota,
    };
  }

  async getStorageUsage(conn) {
    const api = new PcloudApi(conn);
    const info = await api.call('userinfo');
    return {
      used: Number(info.usedquota) || 0,
      total: Number(info.quota) || null,
    };
  }

  async listFiles(conn, { folderId = 0 } = {}) {
    const api = new PcloudApi(conn);
    const res = await api.call('listfolder', { folderid: folderId });
    const contents = (res.metadata && res.metadata.contents) || [];
    return contents.map(toFileEntry);
  }

  async createFolder(conn, { name, parentId = 0 }) {
    const api = new PcloudApi(conn);
    const res = await api.call('createfolder', { name, folderid: parentId });
    return {
      id: String(res.metadata.folderid),
      name: res.metadata.name,
      isFolder: true,
    };
  }

  async rename(conn, { fileId, newName, isFolder }) {
    const api = new PcloudApi(conn);
    if (isFolder) {
      await api.call('renamefolder', { folderid: fileId, toname: newName });
    } else {
      await api.call('renamefile', { fileid: fileId, toname: newName });
    }
    return { ok: true };
  }

  async delete(conn, { fileId, isFolder }) {
    const api = new PcloudApi(conn);
    if (isFolder) {
      await api.call('deletefolderrecursive', { folderid: fileId });
    } else {
      await api.call('deletefile', { fileid: fileId });
    }
    return { ok: true };
  }

  async createShareLink(conn, { fileId, isFolder }) {
    const api = new PcloudApi(conn);
    const method = isFolder ? 'getfolderpublink' : 'getfilepublink';
    const param = isFolder ? 'folderid' : 'fileid';
    const res = await api.call(method, { [param]: fileId });
    return { url: res.link };
  }

  async upload(conn, { filename, folderId = 0, data }) {
    const api = new PcloudApi(conn);
    const res = await api.upload({ folderId, filename, data });
    const meta = (res.metadata && res.metadata[0]) || {};
    return toFileEntry(meta);
  }

  async download(conn, fileId) {
    const api = new PcloudApi(conn);
    return api.download(fileId);
  }
}

export default new PCloudAdapter();