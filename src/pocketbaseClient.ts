import PocketBase from 'pocketbase';

let pocketbaseUrl = import.meta.env.VITE_POCKETBASE_URL || 'https://pb-casadolago.janagencia.com.br';

pocketbaseUrl = String(pocketbaseUrl).replace(/['"]/g, '').trim();

if (!pocketbaseUrl.startsWith('http://') && !pocketbaseUrl.startsWith('https://')) {
  pocketbaseUrl = `https://${pocketbaseUrl}`;
}

// Remove trailing slash
pocketbaseUrl = pocketbaseUrl.replace(/\/$/, '');

export const pb = new PocketBase(pocketbaseUrl);

// Disable auto-cancellation globally so multiple parallel requests don't cancel each other
pb.autoCancellation(false);

export default pb;
