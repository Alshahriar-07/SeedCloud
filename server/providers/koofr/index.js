import { ProviderAdapter } from '../base/ProviderAdapter.js';

// Placeholder. Koofr integration is researched and planned but NOT
// implemented. Every method call throws on purpose.
export class KoofrAdapter extends ProviderAdapter {
  constructor() {
    super({ id: 'koofr', name: 'Koofr' });
  }
}

export default new KoofrAdapter();