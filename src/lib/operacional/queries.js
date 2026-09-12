// Consultas do Operacional por mês e as regras da carga (cache conferido,
// novas tentativas, validade da entrada do mês). As consultas são todas de
// campo único (range e orderBy no mesmo campo): usam o índice automático do
// Firestore, sem índice composto e sem publicação manual. Puras, sem SDK: o
// hook traduz com specToConstraints.

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

// Histórico de um mês fechado: [primeiro dia, primeiro dia do mês seguinte).
// `date` é 'YYYY-MM-DD', e a ordem do texto é a das datas.
export const goalHistoryInMonthSpec = (fromDayKey, toDayKey) => ({
  wheres: [
    { field: 'date', op: '>=', value: fromDayKey },
    { field: 'date', op: '<', value: toDayKey }
  ],
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Tenta `fn` e, se falhar, tenta de novo até `retries` vezes, esperando base,
// 2 × base, 4 × base... Esgotadas as tentativas, sobe o último erro.
export async function retryWithBackoff(fn, { retries = 3, baseDelayMs = 1000, sleep = wait } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
}

// Entrada de mês do hook: { closed, interactions, leadsCreated, history, failed? }.
// Vale enquanto o mês segue no estado em que foi carregada. O mês corrente é
// guardado sem interações nem histórico (null: vêm ao vivo). Se ele fecha com a
// tela aberta, a entrada deixa de valer e o mês é recarregado como fechado.
export const monthEntryFits = (entry, key, currentKey) => Boolean(entry) && entry.closed === (key !== currentKey);

// O mês só anda de aberto para fechado. A busca do mês ainda aberto que termina
// depois da virada não pode apagar a recarga dele como fechado.
export const shouldStoreMonthEntry = (prev, next) => !(prev?.closed && !next?.closed);

// Busca que falhou em todas as tentativas: o mês entra carregado e vazio, com a
// marca, para a tela não ficar presa carregando. No mês corrente, interações e
// histórico seguem ao vivo (null).
export const failedMonthEntry = (closed) => ({
  closed,
  interactions: closed ? [] : null,
  leadsCreated: [],
  history: closed ? [] : null,
  failed: true
});

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
