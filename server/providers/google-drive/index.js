import { ProviderAdapter } from '../base/ProviderAdapter.js';

// Placeholder. Google Drive integration is researched and planned but NOT
// implemented. Do not call any method yet — every call throws on purpose.
export class GoogleDriveAdapter extends ProviderAdapter {
  constructor() {
    super({ id: 'google-drive', name: 'Google Drive' });
  }
}

export default new GoogleDriveAdapter();