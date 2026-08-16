import { ProviderAdapter } from '../base/ProviderAdapter.js';

// Placeholder. Dropbox integration is researched and planned but NOT
// implemented. Every method call throws on purpose.
export class DropboxAdapter extends ProviderAdapter {
  constructor() {
    super({ id: 'dropbox', name: 'Dropbox' });
  }
}

export default new DropboxAdapter();