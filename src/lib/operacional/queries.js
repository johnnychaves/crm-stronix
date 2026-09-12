// Consultas do Operacional por mês. Todas de campo único (range e orderBy no
// mesmo campo): usam o índice automático do Firestore, sem índice composto e
// sem publicação manual. Puras, sem SDK: o hook traduz com specToConstraints.

import { monthRange } from './month.js';

const DAY_MS = 86400000;

export const monthWindowSpec = (field, startMs, endMs) => ({
  wheres: [
    { field, op: '>=', value: new Date(startMs) },
    { field, op: '<', value: new Date(endMs) }
  ],
  orderBy: { field, dir: 'asc' }
});

export const interactionsInMonthSpec = (startMs, endMs) => monthWindowSpec('createdAt', startMs, endMs);
export const leadsCreatedInMonthSpec = (startMs, endMs) => monthWindowSpec('createdAt', startMs, endMs);
export const goalHistorySinceSpec = (fromDayKey) => ({
  wheres: [{ field: 'date', op: '>=', value: fromDayKey }],
  orderBy: { field: 'date', dir: 'asc' }
});

export function chunk(list, size = 30) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Mês fechado: tenta o cache local e confere com a contagem do servidor (uma
// leitura por até mil docs). Contagem igual: usa o cache. Qualquer falha ou
// diferença: busca do servidor.
export async function loadWithCountCheck({ fromCache, fromServer, countOnServer }) {
  let cached = null;
  try { cached = await fromCache(); } catch { cached = null; }
  if (cached && cached.length) {
    try {
      if ((await countOnServer()) === cached.length) return { docs: cached, source: 'cache' };
    } catch { /* sem contagem: segue para o servidor */ }
  }
  return { docs: await fromServer(), source: 'server' };
}

// Leads cujo responsável atual a renovação precisa: contratos que vencem entre o
// início do mês mais antigo pedido e 91 dias depois do fim do mais novo (cobre
// coorte, marcos e a vencer). `known` = ids já em memória (metaLeads).
export function leadIdsForRenewal(contracts, { monthKeys, known = new Set() }) {
  if (!monthKeys?.length) return [];
  const sorted = [...monthKeys].sort();
  const from = monthRange(sorted[0]).start.getTime();
  const to = monthRange(sorted[sorted.length - 1]).end.getTime() + 91 * DAY_MS;
  const ids = new Set();
  (contracts || []).forEach((c) => {
    if (!c.leadId || !c.endsAt || known.has(c.leadId)) return;
    const t = c.endsAt.getTime();
    if (t >= from && t < to) ids.add(c.leadId);
  });
  return [...ids];
}
