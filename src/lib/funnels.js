// Multi-funnel helpers: default funnel resolution, "is this item part of
// the selected funnel?" check (with legacy-data fallback), and the
// chunked batch writer used by the migration and the bulk-rename flows.

import { writeBatch } from 'firebase/firestore';

export const getDefaultFunnel = (funnels) => {
  if (!Array.isArray(funnels) || funnels.length === 0) return null;
  return funnels.find(f => f.isDefault === true) || funnels[0] || null;
};

// Returns true if the given item (lead or status) belongs to the selected
// funnel, *or* is a legacy item without funnelId that should fall through
// to the default funnel.
export const isItemInFunnel = (item, selectedFunnelId, defaultFunnelId) => {
  if (!selectedFunnelId) return true;
  if (item?.funnelId === selectedFunnelId) return true;
  if (!item?.funnelId && selectedFunnelId === defaultFunnelId) return true;
  return false;
};

// Performs the given { ref, data } updates in batches of `chunkSize`.
// Firestore caps each batch at 500 writes; 400 leaves headroom.
export const commitOpsInChunks = async (dbInstance, ops, chunkSize = 400) => {
  for (let i = 0; i < ops.length; i += chunkSize) {
    const chunk = ops.slice(i, i + chunkSize);
    const batch = writeBatch(dbInstance);
    chunk.forEach(op => {
      batch.update(op.ref, op.data);
    });
    await batch.commit();
  }
};
