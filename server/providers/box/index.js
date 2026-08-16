import { ProviderAdapter } from '../base/ProviderAdapter.js';

// Placeholder. Box integration is researched and planned but NOT implemented.
// Every method call throws on purpose.
export class BoxAdapter extends ProviderAdapter {
  constructor() {
    super({ id: 'box', name: 'Box' });
  }
}

export default new BoxAdapter();