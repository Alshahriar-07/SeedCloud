import { ProviderAdapter } from '../base/ProviderAdapter.js';

// Placeholder. Microsoft OneDrive integration is researched and planned but
// NOT implemented. Every method call throws on purpose.
export class OneDriveAdapter extends ProviderAdapter {
  constructor() {
    super({ id: 'onedrive', name: 'Microsoft OneDrive' });
  }
}

export default new OneDriveAdapter();