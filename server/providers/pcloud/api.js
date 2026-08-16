import { Readable } from 'node:stream';

export class PcloudApi {
  constructor({ accessToken, apiHost }) {
    this.accessToken = accessToken;
    this.apiHost = apiHost ? `https://${apiHost}` : 'https://api.pcloud.com';
  }

  buildUrl(method, params = {}) {
    const url = new URL(`${this.apiHost}/${method}`);
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) search.set(key, String(value));
    }
    if (this.accessToken) search.set('access_token', this.accessToken);
    url.search = search.toString();
    return url;
  }

  async call(method, params = {}) {
    const res = await fetch(this.buildUrl(method, params));
    const json = await res.json().catch(() => null);
    if (!json || json.result !== 0) {
      const error = new Error((json && json.error) || `pCloud API error (${method})`);
      error.code = json && json.result;
      throw error;
    }
    return json;
  }

  async upload({ folderId, filename, data }) {
    const form = new FormData();
    form.set('folderid', String(folderId));
    form.set('filename', filename);
    form.set('file', new Blob([data]), filename);
    const url = this.buildUrl('uploadfile', {});
    const res = await fetch(url, { method: 'POST', body: form });
    const json = await res.json().catch(() => null);
    if (!json || json.result !== 0) {
      const error = new Error((json && json.error) || 'pCloud upload failed');
      error.code = json && json.result;
      throw error;
    }
    return json;
  }

  async download(fileId) {
    const url = this.buildUrl('downloadfile', { fileid: fileId });
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`pCloud download failed (HTTP ${res.status})`);
    }
    return res;
  }
}

export function webStreamToNode(webStream) {
  if (webStream && typeof webStream[Symbol.asyncIterator] === 'function') {
    return Readable.from(webStream);
  }
  return Readable.fromWeb(webStream);
}
