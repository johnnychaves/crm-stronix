// Multi-funnel helpers: default funnel resolution, "is this item part of
// the selected funnel?" check (with legacy-data fallback), and the
// chunked batch writer used by the migration and the bulk-rename flows.

import { writeBatch } from 'firebase/firestore';

// Sentinel for the Dashboard "Todos os funis" (aggregated/general) mode.
// Stored in localStorage and passed via setSelectedFunnelId(). Chosen to
// not collide with Firestore-generated IDs (which are alphanumeric).
export const ALL_FUNNELS_ID = '__all_funnels__';

export const isAllFunnels = (id) => id === ALL_FUNNELS_ID;

export const getDefaultFunnel = (funnels) => {
  if (!Array.isArray(funnels) || funnels.length === 0) return null;
  return funnels.find(f => f.isDefault === true) || funnels[0] || null;
};

// Etapa de sistema: fase fixa criada pelo app (flag isSystem) ou a 'Negociação'
// legada anterior ao flag. Não pode ser renomeada/excluída na FunnelsSection.
// Funil de SISTEMA: criado e mantido pelo app, não pela academia. Não pode ser
// excluído e tem o nome travado nas Configurações. Hoje são quatro —
// Indicações, Upgrade, Renovações e Vencidos — e a checagem vive aqui para
// não espalhar a condição pelas telas.
// O discriminador é sempre a flag `systemKind`, NUNCA o nome.
export const isSystemFunnel = (f) => Boolean(f?.systemKind);

export const isSystemStage = (s) =>
  Boolean(s?.isSystem) || (s?.name || '').trim().toLowerCase() === 'negociação';

// Returns true if the given item (lead or status) belongs to the selected
// funnel, *or* is a legacy item without funnelId that should fall through
// to the default funnel.
export const isItemInFunnel = (item, selectedFunnelId, defaultFunnelId) => {
  if (!selectedFunnelId) return true;
  if (item?.funnelId === selectedFunnelId) return true;
  if (!item?.funnelId && selectedFunnelId === defaultFunnelId) return true;
  return false;
};

// Por que um nome não pode virar etapa deste funil (texto do aviso), ou null.
// O lead guarda o NOME da etapa: dois nomes iguais no mesmo funil juntam os
// leads das duas colunas sem volta. Venda e Perda são as colunas finais do
// Pipeline. `editingId` é a etapa sendo renomeada, que não conta contra si.
export const stageNameProblem = (stages, name, editingId = null) => {
  const norm = (v) => String(v || '').trim().toLowerCase();
  const same = (stages || []).find((s) => s.id !== editingId && norm(s.name) === norm(name));
  if (same) return `A etapa "${same.name}" já existe neste funil.`;
  if (['venda', 'perda'].includes(norm(name))) return `"${String(name).trim()}" é uma coluna fixa do Pipeline e não pode ser nome de etapa.`;
  return null;
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
