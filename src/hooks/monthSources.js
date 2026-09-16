// Carga e memória de sessão dos meses, compartilhadas pelo Operacional
// (useOperacionalSources) e pelo CRM (useCrmSources): as interações, os leads
// criados e o histórico de metas de cada mês, e os leads buscados por id. O
// que um dos painéis carregou na sessão serve ao outro. Não é hook: são as
// buscas e os mapas de memória, fora do estado porque as telas desmontam a
// cada troca de aba.

import { collection, getCountFromServer, getDocsFromCache, query } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { specToConstraints, getDocsWithAuthRetry } from './usePagedLeads.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { getSafeDate } from '../lib/dates.js';
import { monthRange, addMonthsToKey } from '../lib/operacional/month.js';
import {
  interactionsInMonthSpec, leadsCreatedInMonthSpec, goalHistoryInMonthSpec, loadWithCountCheck,
  currentMonthLeadsWindow, docsFromServerOrThrow, newestCreatedAtOf
} from '../lib/operacional/queries.js';

export const colRef = (db, path) => collection(db, 'artifacts', appId, 'public', 'data', path);

const mapInteraction = (d) => {
  const data = d.data();
  return { id: d.id, ...data, createdAt: getSafeDate(data.createdAt) };
};

export const mapHistory = (d) => d.data();

// Busca que precisa do servidor: resposta do cache do aparelho é falha.
export const serverDocs = async (q) => docsFromServerOrThrow(await getDocsWithAuthRetry(q));

// Consulta de mês fechado: cache local conferido pela contagem do servidor.
export const cachedOrServer = (q, mapDoc) => loadWithCountCheck({
  fromCache: async () => (await getDocsFromCache(q)).docs.map(mapDoc),
  fromServer: async () => (await serverDocs(q)).map(mapDoc),
  countOnServer: async () => (await getCountFromServer(q)).data().count
}).then((r) => r.docs);

// Com a regra antiga do histórico publicada (cada um lê só o próprio), a
// consulta do mês inteiro é negada. O mês fica sem histórico (null) e quem
// cobre é a assinatura dos docs da pessoa (historyScope 'own').
const unlessDenied = (promise) => promise.catch((e) => {
  if (e?.code === 'permission-denied') return null;
  throw e;
});

// Leads criados no mês corrente, direto do servidor, na janela da busca: o mês
// inteiro na primeira vez; depois, só desde a âncora (leadsWindowSince), menos
// a folga. Devolve junto o instante da busca.
export async function loadCurrentLeads(db, key, since = null) {
  const { from, to } = currentMonthLeadsWindow(key, since);
  const q = query(colRef(db, LEADS_PATH), ...specToConstraints(leadsCreatedInMonthSpec(from, to)));
  const fetchedAt = Date.now();
  const leads = (await serverDocs(q)).map(normalizeLeadDoc);
  return { leads, fetchedAt };
}

// Uma tentativa de carga do mês. Aberto: só os leads criados, direto do
// servidor (interações e histórico vêm ao vivo). Fechado: interações, leads
// criados e histórico, pelo cache conferido.
export async function loadMonth(db, key, closed) {
  if (!closed) {
    const { leads, fetchedAt } = await loadCurrentLeads(db, key);
    return {
      closed, interactions: null, leadsCreated: leads, history: null, fetchedAt,
      newestCreatedAt: newestCreatedAtOf(leads)
    };
  }
  const { start, end } = monthRange(key);
  const [from, to] = [start.getTime(), end.getTime()];
  const qL = query(colRef(db, LEADS_PATH), ...specToConstraints(leadsCreatedInMonthSpec(from, to)));
  const qI = query(colRef(db, INTERACTIONS_PATH), ...specToConstraints(interactionsInMonthSpec(from, to)));
  const qH = query(
    colRef(db, DAILY_GOAL_HISTORY_PATH),
    ...specToConstraints(goalHistoryInMonthSpec(`${key}-01`, `${addMonthsToKey(key, 1)}-01`))
  );
  const [interactions, leadsCreated, history] = await Promise.all([
    cachedOrServer(qI, mapInteraction),
    cachedOrServer(qL, normalizeLeadDoc),
    unlessDenied(cachedOrServer(qH, mapHistory))
  ]);
  return { closed, interactions, leadsCreated, history };
}

// Memória da sessão do navegador, por academia (appId). Fica fora do estado
// dos hooks porque as telas desmontam ao trocar de aba, e cada abertura leria
// tudo de novo.
// - leadsPorIdDaSessao: os leads buscados por id pelo Operacional (a carteira
//   de renovação) e pelo CRM (os leads citados por agendamento e por troca de
//   etapa que não estão em nenhuma lista).
// - mesesDaSessao: as entradas de mês já lidas.
export const leadsPorIdDaSessao = new Map();
export const mesesDaSessao = new Map();
