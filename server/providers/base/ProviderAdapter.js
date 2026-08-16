// Base class for every cloud provider adapter. It defines the full contract a
// real adapter must implement. Placeholder adapters inherit from it and fail
// loudly (never fake a result) until a real implementation is written.
//
// A "conn" object passed to the methods below is the server-side connection
// shape: { accessToken, tokenType, apiHost }. Access tokens are decrypted
// server-side only and never leave the server.

export class ProviderAdapter {
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
  }

  _notImplemented() {
    throw new Error(`${this.name} adapter is not implemented yet`);
  }

  // Declares which operations a real implementation supports.
  capabilities() {
    return {
      oauth: false,
      list: false,
      upload: false,
      download: false,
      createFolder: false,
      rename: false,
      delete: false,
      share: false,
      quota: false,
    };
  }

  // Builds the provider authorization URL for the OAuth2 consent screen.
  getOAuthUrl() {
    this._notImplemented();
  }

  // Exchanges the authorization code for tokens.
  exchangeCode() {
    this._notImplemented();
  }

  // Returns { accountId, email, ... } for the connected account.
  getAccount() {
    this._notImplemented();
  }

  // Returns { used, total } in bytes.
  getStorageUsage() {
    this._notImplemented();
  }

  listFiles() {
    this._notImplemented();
  }

  createFolder() {
    this._notImplemented();
  }

  rename() {
    this._notImplemented();
  }

  delete() {
    this._notImplemented();
  }

  createShareLink() {
    this._notImplemented();
  }

  upload() {
    this._notImplemented();
  }

  download() {
    this._notImplemented();
  }

  // Optional. Providers without a revoke endpoint leave this as a no-op.
  async revoke() {
    return { ok: true, revoked: false };
  }
}