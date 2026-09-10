import type { ApiHandler } from '@kvantjs/ryvax.js';

export const GET: ApiHandler = async () => ({
  json: {
    data: [
      { id: 'atlas-mobile', name: 'Atlas mobile', progress: 78, status: 'on-track' },
      { id: 'nova-central-de-ajuda', name: 'New help center', progress: 54, status: 'attention' },
      { id: 'checkout-v3', name: 'Checkout v3', progress: 31, status: 'on-track' }
    ],
    generatedAt: new Date().toISOString()
  }
});
