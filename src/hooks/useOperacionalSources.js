// Fontes do Operacional por mês.
//
// Mês corrente: interações ao vivo (vêm do App), leads criados buscados do
// servidor e unidos aos ao vivo, histórico de metas ao vivo só deste mês.
// Mês fechado: interações, leads criados e histórico buscados por mês, com o
// cache local conferido por contagem (queries.loadWithCountCheck).
//
// Memória da sessão (mesesDaSessao): a tela desmonta a cada troca de aba e o
// estado volta vazio. As entradas de mês ficam guardadas por academia, fora do
// estado, e o estado inicial sai delas. Mês fechado guardado é usado direto,
// sem nova contagem. O corrente também, e na montagem busca só os leads
// criados desde a última busca, menos 2 minutos de folga, unidos por id. Entrada
// que falhou nunca é guardada, para a volta tentar de novo.
//
// Cada entrada de mês guarda se foi carregada como fechada: na virada do mês,
// com a tela aberta ou na volta, a do mês que acabou de fechar deixa de valer
// e ele é recarregado como fechado. Busca que falha tenta de novo com espera
// crescente; esgotadas as tentativas, o mês entra vazio e sai em `failedKeys`,
// sem prender a tela carregando.
//
// Também busca os docs dos leads da carteira de renovação (responsável atual),
// sempre do servidor e uma vez por id na sessão do navegador.

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, documentId, getCountFromServer, getDocsFromCache, onSnapshot, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { specToConstraints, getDocsWithAuthRetry } from './usePagedLeads.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { getSafeDate } from '../lib/dates.js';
import { monthRange, monthKeyOf, addMonthsToKey } from '../lib/operacional/month.js';
import {
  interactionsInMonthSpec, leadsCreatedInMonthSpec, goalHistorySinceSpec, goalHistoryInMonthSpec,
  loadWithCountCheck, retryWithBackoff, monthEntryFits, shouldStoreMonthEntry, failedMonthEntry,
  shouldRememberMonthEntry, monthsFromSession, currentMonthLeadsWindow, mergeNewLeads,
  chunk, leadIdsForRenewal
} from '../lib/operacional/queries.js';

const colRef = (db, path) => collection(db, 'artifacts', appId, 'public', 'data', path);

const mapInteraction = (d) => {
  const data = d.data();
  return { id: d.id, ...data, createdAt: getSafeDate(data.createdAt) };
};

const mapHistory = (d) => d.data();

// Consulta de mês fechado: cache local conferido pela contagem do servidor.
const cachedOrServer = (q, mapDoc) => loadWithCountCheck({
  fromCache: async () => (await getDocsFromCache(q)).docs.map(mapDoc),
  fromServer: async () => (await getDocsWithAuthRetry(q)).docs.map(mapDoc),
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
// inteiro na primeira vez; depois, só desde a última busca (menos a folga).
// Devolve junto o instante da busca.
async function loadCurrentLeads(db, key, lastFetchedAt = null) {
  const { from, to } = currentMonthLeadsWindow(key, lastFetchedAt);
  const q = query(colRef(db, LEADS_PATH), ...specToConstraints(leadsCreatedInMonthSpec(from, to)));
  const fetchedAt = Date.now();
  const snap = await getDocsWithAuthRetry(q);
  return { leads: snap.docs.map(normalizeLeadDoc), fetchedAt };
}

// Uma tentativa de carga do mês. Aberto: só os leads criados, direto do
// servidor (interações e histórico vêm ao vivo). Fechado: interações, leads
// criados e histórico, pelo cache conferido.
async function loadMonth(db, key, closed) {
  if (!closed) {
    const { leads, fetchedAt } = await loadCurrentLeads(db, key);
    return { closed, interactions: null, leadsCreated: leads, history: null, fetchedAt };
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

// Leads da carteira e entradas de mês já lidos nesta sessão do navegador, por
// academia (appId). Ficam fora do estado do hook porque a tela desmonta ao
// trocar de aba, e cada abertura leria tudo de novo.
const carteiraDaSessao = new Map();
const mesesDaSessao = new Map();

export function useOperacionalSources({ db, enabled = true, now, monthKeys, liveInteractions, liveLeads, contracts, appUser }) {
  const currentKey = monthKeyOf(now);
  const authUid = appUser?.authUid;

  // --- histórico de metas ao vivo: só o mês corrente. Os fechados vêm com o
  // mês (loadMonth). Seis meses ao vivo custavam cerca de 540 docs a cada
  // montagem ou volta do portão de atividade.
  const [liveHistory, setLiveHistory] = useState([]);
  const [historyScope, setHistoryScope] = useState('all');
  useEffect(() => {
    if (!db || !enabled) return undefined;
    let unsub = () => {};
    let cancelled = false;
    const live = query(colRef(db, DAILY_GOAL_HISTORY_PATH), ...specToConstraints(goalHistorySinceSpec(`${currentKey}-01`)));
    unsub = onSnapshot(live, (snap) => {
      if (cancelled) return;
      setHistoryScope('all');
      setLiveHistory(snap.docs.map(mapHistory));
    }, () => {
      if (cancelled) return;
      // Regra antiga (só o próprio histórico) ainda publicada: cai para os docs
      // da pessoa, de todos os meses. A saída recorta por mês.
      if (!authUid) return;
      setHistoryScope('own');
      unsub = onSnapshot(
        query(colRef(db, DAILY_GOAL_HISTORY_PATH), where('consultantAuthUid', '==', authUid)),
        (snap) => { if (!cancelled) setLiveHistory(snap.docs.map(mapHistory)); },
        () => { if (!cancelled) setLiveHistory([]); }
      );
    });
    return () => { cancelled = true; unsub(); };
  }, [db, enabled, currentKey, authUid]);

  // --- meses: os fechados completos; o corrente só com os leads criados. O
  // estado começa da memória da sessão, sem o que deixou de valer.
  const [months, setMonths] = useState(() => monthsFromSession(mesesDaSessao.get(appId), currentKey));
  const loadingRef = useRef(new Set());
  // Mês corrente já buscado nesta montagem, pela carga cheia ou pela
  // incremental: a incremental roda uma vez por montagem.
  const refreshedRef = useRef(new Set());
  useEffect(() => {
    if (!db || !enabled) return undefined;
    const tenant = appId;
    if (!mesesDaSessao.has(tenant)) mesesDaSessao.set(tenant, new Map());
    const memory = mesesDaSessao.get(tenant);
    const store = (key, entry) => {
      if (shouldRememberMonthEntry(memory.get(key), entry)) memory.set(key, entry);
      setMonths((prev) => (shouldStoreMonthEntry(prev[key], entry) ? { ...prev, [key]: entry } : prev));
    };
    // Mês corrente que veio da memória: busca só os leads criados desde a
    // última busca e une por id. Se falhar, fica o que já estava.
    const refresh = (key, lastFetchedAt) => {
      retryWithBackoff(() => loadCurrentLeads(db, key, lastFetchedAt))
        .then(({ leads, fetchedAt }) => {
          if (memory.has(key)) memory.set(key, mergeNewLeads(memory.get(key), leads, fetchedAt));
          setMonths((prev) => {
            const next = mergeNewLeads(prev[key], leads, fetchedAt);
            return next === prev[key] ? prev : { ...prev, [key]: next };
          });
        })
        .catch((e) => console.error('operacional leads novos', key, e));
    };
    (monthKeys || []).forEach((key) => {
      const closed = key !== currentKey;
      const entry = months[key];
      // Entrada que vale: o mês fechado é usado direto, sem nova contagem.
      if (monthEntryFits(entry, key, currentKey)) {
        if (!closed && !entry.failed && !refreshedRef.current.has(key)) {
          refreshedRef.current.add(key);
          refresh(key, entry.fetchedAt);
        }
        return;
      }
      // O estado entra na chave: a recarga do mês que acabou de fechar não
      // espera a busca dele como mês aberto terminar.
      const slot = `${key}:${closed ? 'fechado' : 'aberto'}`;
      if (loadingRef.current.has(slot)) return;
      loadingRef.current.add(slot);
      if (!closed) refreshedRef.current.add(key);
      retryWithBackoff(() => loadMonth(db, key, closed))
        .catch((e) => {
          console.error('operacional fontes', key, e);
          return failedMonthEntry(closed);
        })
        .then((next) => store(key, next))
        .finally(() => loadingRef.current.delete(slot));
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- months entra só como guarda de "já carregado"
  }, [db, enabled, monthKeys, currentKey]);

  // --- leads da carteira (responsável atual), por id, em lotes de 30. Sempre do
  // servidor: a conferência por contagem só enxerga exclusão, e uma troca de
  // responsável ficaria congelada no cache. Uma vez por id na sessão: o que já
  // foi lido (carteiraDaSessao) entra como semente e não é buscado de novo.
  const [seed] = useState(() => new Map(carteiraDaSessao.get(appId)));
  const [fetchedLeads, setFetchedLeads] = useState(seed);
  const askedRef = useRef(new Set());
  useEffect(() => {
    if (!db || !enabled) return undefined;
    const tenant = appId;
    const known = new Set([...(liveLeads || []).map((l) => l.id), ...seed.keys(), ...askedRef.current]);
    const ids = leadIdsForRenewal(contracts, { monthKeys, known });
    if (!ids.length) return undefined;
    ids.forEach((id) => askedRef.current.add(id));
    chunk(ids).forEach((part) => {
      const q = query(colRef(db, LEADS_PATH), where(documentId(), 'in', part));
      getDocsWithAuthRetry(q)
        .then((snap) => {
          const docs = snap.docs.map(normalizeLeadDoc);
          if (!carteiraDaSessao.has(tenant)) carteiraDaSessao.set(tenant, new Map());
          docs.forEach((l) => carteiraDaSessao.get(tenant).set(l.id, l));
          setFetchedLeads((prev) => {
            const next = new Map(prev);
            docs.forEach((l) => next.set(l.id, l));
            return next;
          });
        })
        .catch((e) => console.error('operacional carteira', e));
    });
    return undefined;
  }, [db, enabled, contracts, monthKeys, liveLeads, seed]);

  // --- saída no formato de ctx.months e ctx.leadsById. Mês cuja entrada não
  // vale mais (virada com a tela aberta) fica de fora até recarregar.
  return useMemo(() => {
    const byMonth = {};
    const failedKeys = [];
    (monthKeys || []).forEach((key) => {
      const loaded = months[key];
      if (!monthEntryFits(loaded, key, currentKey)) return;
      if (loaded.failed) failedKeys.push(key);
      const isCurrent = key === currentKey;
      const { start, end } = monthRange(key);
      const liveCreated = isCurrent
        ? (liveLeads || []).filter((l) => l.createdAt instanceof Date && l.createdAt >= start && l.createdAt < end)
        : [];
      const leadsCreated = [...new Map([...(loaded.leadsCreated || []), ...liveCreated].map((l) => [l.id, l])).values()];
      // Histórico: o ao vivo no mês corrente e, com a regra antiga, em todos os
      // meses (docs da pessoa); nos fechados, o que veio com o mês.
      const history = isCurrent || historyScope === 'own' || !loaded.history
        ? liveHistory.filter((h) => typeof h.date === 'string' && h.date.startsWith(key))
        : loaded.history;
      byMonth[key] = {
        interactions: isCurrent ? (liveInteractions || []) : (loaded.interactions || []),
        leadsCreated,
        history
      };
    });
    const leadsById = new Map(fetchedLeads);
    (liveLeads || []).forEach((l) => leadsById.set(l.id, l));
    const loading = (monthKeys || []).some((k) => !monthEntryFits(months[k], k, currentKey));
    return { months: byMonth, leadsById, loading, failedKeys, historyScope };
  }, [monthKeys, months, currentKey, liveLeads, liveInteractions, liveHistory, fetchedLeads, historyScope]);
}
