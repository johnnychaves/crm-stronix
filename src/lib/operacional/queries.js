// Consultas do Operacional por mês e as regras da carga (cache conferido,
// novas tentativas, validade da entrada do mês, memória da sessão e busca
// incremental dos leads do mês corrente). As consultas são todas de
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

// Espera antes de tentar de novo depois da falha número `attempt` (a partir de
// 0): base, 2 × base, 4 × base... Esgotadas as `retries`, null: hora de desistir.
// Serve à carga do mês e à assinatura do histórico da equipe.
export const retryDelayMs = (attempt, { retries = 3, baseDelayMs = 1000 } = {}) =>
  (attempt < retries ? baseDelayMs * 2 ** attempt : null);

// Tenta `fn` e, se falhar, tenta de novo até `retries` vezes, com as esperas de
// retryDelayMs. Esgotadas as tentativas, sobe o último erro.
export async function retryWithBackoff(fn, { retries = 3, baseDelayMs = 1000, sleep = wait } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const delay = retryDelayMs(attempt, { retries, baseDelayMs });
      if (delay == null) throw e;
      await sleep(delay);
    }
  }
}

// Entrada de mês do hook: { closed, interactions, leadsCreated, history, failed?,
// fetchedAt? }. Vale enquanto o mês segue no estado em que foi carregada. O mês
// corrente é guardado sem interações nem histórico (null: vêm ao vivo) e com o
// instante da última busca dos leads (fetchedAt). Se ele fecha com a tela
// aberta, ou enquanto ela estava fechada, a entrada deixa de valer e o mês é
// recarregado como fechado.
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

// Memória da sessão: o que entra nela. Só entrada completa. A que falhou fica
// de fora, e também o mês fechado sem histórico (consulta negada pela regra
// antiga), para a volta à tela tentar de novo. Como no estado, o mês só anda
// de aberto para fechado.
export const shouldRememberMonthEntry = (prev, next) => Boolean(next)
  && !next.failed
  && !(next.closed && next.history == null)
  && shouldStoreMonthEntry(prev, next);

// Estado inicial do hook, a partir da memória da sessão (Map mês → entrada):
// só o que ainda vale no mês de agora. A entrada do mês que fechou desde a
// última visita não volta; ele é recarregado como fechado.
export function monthsFromSession(entries, currentKey) {
  const out = {};
  (entries || new Map()).forEach((entry, key) => {
    if (monthEntryFits(entry, key, currentKey)) out[key] = entry;
  });
  return out;
}

// Folga da busca incremental do mês corrente. O `createdAt` do lead é a hora
// do servidor (serverTimestamp), e a âncora da janela também sai do servidor
// (leadsWindowSince). A folga cobre o lead gravado com a data do aparelho,
// como na importação, e gravações que chegam quase juntas.
export const NEW_LEADS_SLACK_MS = 2 * 60 * 1000;

// Janela dos leads criados no mês corrente: o mês inteiro na primeira busca;
// depois, desde a âncora (leadsWindowSince) menos a folga, até o fim do mês.
export function currentMonthLeadsWindow(key, since = null) {
  const { start, end } = monthRange(key);
  const from = Number.isFinite(since)
    ? Math.max(start.getTime(), since - NEW_LEADS_SLACK_MS)
    : start.getTime();
  return { from, to: end.getTime() };
}

// Maior `createdAt` real entre os leads, ou null. Lead sem data real
// (createdAtMissing) não conta: o normalizeLeadDoc põe "agora" nele.
export function newestCreatedAtOf(leads) {
  let newest = null;
  (leads || []).forEach((l) => {
    if (l?.createdAtMissing || !(l?.createdAt instanceof Date)) return;
    const t = l.createdAt.getTime();
    if (Number.isFinite(t) && (newest === null || t > newest)) newest = t;
  });
  return newest;
}

// Âncora da próxima busca incremental: o lead mais novo que o servidor já
// devolveu no mês, e não o relógio do aparelho, que pode estar adiantado. Com
// o aparelho atrasado vale o instante da busca, o mais cedo dos dois; assim um
// lead gravado com data à frente (a importação grava a data do aparelho de
// quem importa) também não empurra a âncora para o futuro. Nada visto ainda:
// null, e a busca pega o mês inteiro. Lead apagado continua na entrada até a
// página recarregar.
export function leadsWindowSince(entry) {
  const newest = entry?.newestCreatedAt;
  if (!Number.isFinite(newest)) return null;
  return Number.isFinite(entry.fetchedAt) ? Math.min(newest, entry.fetchedAt) : newest;
}

// União por id: a versão de `newer` ganha.
export function unionById(older, newer) {
  const map = new Map((older || []).map((x) => [x.id, x]));
  (newer || []).forEach((x) => map.set(x.id, x));
  return [...map.values()];
}

// Leads da busca incremental entrando na entrada do mês corrente, com o
// instante da busca. Vale a busca mais recente: uma mais antiga que chega
// depois só acrescenta quem faltava. A entrada guarda o lead mais novo já
// visto (newestCreatedAt), que nunca recua. Entrada ausente, de mês fechado
// ou que falhou fica como está.
export function mergeNewLeads(entry, leads, fetchedAt) {
  if (!entry || entry.closed || entry.failed) return entry;
  const newer = !Number.isFinite(entry.fetchedAt) || fetchedAt >= entry.fetchedAt;
  const newest = [entry.newestCreatedAt, newestCreatedAtOf(leads)].filter(Number.isFinite);
  return {
    ...entry,
    leadsCreated: newer ? unionById(entry.leadsCreated, leads) : unionById(leads, entry.leadsCreated),
    fetchedAt: newer ? fetchedAt : entry.fetchedAt,
    ...(newest.length ? { newestCreatedAt: Math.max(...newest) } : {})
  };
}

// Busca que o hook espera do servidor. Com o cache persistente e sem rede, o
// getDocs responde do cache do aparelho sem dar erro, e essa resposta pode
// estar incompleta. Resposta do cache conta como falha: cai na nova tentativa
// e, esgotada, na entrada que falhou, que não vai para a memória da sessão.
export function docsFromServerOrThrow(snap) {
  if (snap?.metadata?.fromCache) {
    const err = new Error('Sem conexão com o servidor: a resposta veio do cache do aparelho');
    err.code = 'unavailable';
    throw err;
  }
  return snap?.docs || [];
}

// Histórico de um mês na saída do hook. No mês corrente, e em todos os meses
// quando a assinatura é só da pessoa (scope 'own'), vale o que veio ao vivo,
// recortado pelo mês. Sem resposta da assinatura ainda, ou com ela falhando
// (docs null), vai null: a meta fica sem número em vez de zerada. Mês fechado
// com a assinatura da equipe: o que veio com ele, ou null se a consulta foi
// negada.
export function monthHistory(key, { isCurrent, live, liveReady, loaded }) {
  if (isCurrent || live?.scope === 'own') {
    if (!liveReady || !Array.isArray(live?.docs)) return null;
    return live.docs.filter((h) => typeof h.date === 'string' && h.date.startsWith(key));
  }
  return loaded?.history ?? null;
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
