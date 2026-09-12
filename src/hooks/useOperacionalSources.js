// Fontes do Operacional por mês. Mês corrente: interações ao vivo (do App),
// leads criados buscados uma vez e unidos aos ao vivo, histórico ao vivo. Meses
// fechados: cache local conferido por contagem (queries.loadWithCountCheck).
// Cada entrada de mês guarda se foi carregada como fechada: na virada do mês
// com a tela aberta, a do mês que acabou de fechar deixa de valer e ele é
// recarregado como fechado. Busca que falha tenta de novo com espera crescente;
// esgotadas as tentativas, o mês entra vazio e sai em `failedKeys`, sem prender
// a tela carregando.
// Também busca os docs dos leads da carteira de renovação (responsável atual).

import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, documentId, getCountFromServer, getDocsFromCache, onSnapshot, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { specToConstraints, getDocsWithAuthRetry } from './usePagedLeads.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { getSafeDate } from '../lib/dates.js';
import { monthRange, monthKeyOf } from '../lib/operacional/month.js';
import {
  interactionsInMonthSpec, leadsCreatedInMonthSpec, goalHistorySinceSpec,
  loadWithCountCheck, retryWithBackoff, monthEntryFits, shouldStoreMonthEntry, failedMonthEntry,
  chunk, leadIdsForRenewal
} from '../lib/operacional/queries.js';

const colRef = (db, path) => collection(db, 'artifacts', appId, 'public', 'data', path);

const mapInteraction = (d) => {
  const data = d.data();
  return { id: d.id, ...data, createdAt: getSafeDate(data.createdAt) };
};

// Consulta de mês fechado: cache local conferido pela contagem do servidor.
const cachedOrServer = (q, mapDoc) => loadWithCountCheck({
  fromCache: async () => (await getDocsFromCache(q)).docs.map(mapDoc),
  fromServer: async () => (await getDocsWithAuthRetry(q)).docs.map(mapDoc),
  countOnServer: async () => (await getCountFromServer(q)).data().count
}).then((r) => r.docs);

// Uma tentativa de carga do mês. Aberto: só os leads criados, direto do
// servidor (as interações vêm ao vivo do App). Fechado: interações e leads
// criados, pelo cache conferido.
async function loadMonth(db, key, closed) {
  const { start, end } = monthRange(key);
  const [from, to] = [start.getTime(), end.getTime()];
  const qL = query(colRef(db, LEADS_PATH), ...specToConstraints(leadsCreatedInMonthSpec(from, to)));
  if (!closed) {
    const snap = await getDocsWithAuthRetry(qL);
    return { closed, interactions: null, leadsCreated: snap.docs.map(normalizeLeadDoc), history: null };
  }
  const qI = query(colRef(db, INTERACTIONS_PATH), ...specToConstraints(interactionsInMonthSpec(from, to)));
  const [interactions, leadsCreated] = await Promise.all([
    cachedOrServer(qI, mapInteraction),
    cachedOrServer(qL, normalizeLeadDoc)
  ]);
  return { closed, interactions, leadsCreated, history: null };
}

export function useOperacionalSources({ db, enabled = true, now, monthKeys, liveInteractions, liveLeads, contracts, appUser }) {
  const currentKey = monthKeyOf(now);
  const authUid = appUser?.authUid;

  // --- histórico de metas: uma assinatura desde o mês mais antigo pedido.
  const oldestKey = useMemo(() => [...(monthKeys || [])].sort()[0] || currentKey, [monthKeys, currentKey]);
  const [history, setHistory] = useState([]);
  const [historyScope, setHistoryScope] = useState('all');
  useEffect(() => {
    if (!db || !enabled) return undefined;
    let unsub = () => {};
    let cancelled = false;
    const all = query(colRef(db, DAILY_GOAL_HISTORY_PATH), ...specToConstraints(goalHistorySinceSpec(`${oldestKey}-01`)));
    unsub = onSnapshot(all, (snap) => {
      if (cancelled) return;
      setHistoryScope('all');
      setHistory(snap.docs.map((d) => d.data()));
    }, () => {
      if (cancelled) return;
      // Regra antiga (só o próprio histórico) ainda publicada: cai para os docs da pessoa.
      if (!authUid) return;
      setHistoryScope('own');
      unsub = onSnapshot(
        query(colRef(db, DAILY_GOAL_HISTORY_PATH), where('consultantAuthUid', '==', authUid)),
        (snap) => { if (!cancelled) setHistory(snap.docs.map((d) => d.data())); },
        () => { if (!cancelled) setHistory([]); }
      );
    });
    return () => { cancelled = true; unsub(); };
  }, [db, enabled, oldestKey, authUid]);

  // --- meses: os fechados completos; o corrente só com os leads criados.
  const [months, setMonths] = useState({});
  const loadingRef = useRef(new Set());
  useEffect(() => {
    if (!db || !enabled) return undefined;
    (monthKeys || []).forEach((key) => {
      const closed = key !== currentKey;
      // O estado entra na chave: a recarga do mês que acabou de fechar não
      // espera a busca dele como mês aberto terminar.
      const slot = `${key}:${closed ? 'fechado' : 'aberto'}`;
      if (monthEntryFits(months[key], key, currentKey) || loadingRef.current.has(slot)) return;
      loadingRef.current.add(slot);
      retryWithBackoff(() => loadMonth(db, key, closed))
        .catch((e) => {
          console.error('operacional fontes', key, e);
          return failedMonthEntry(closed);
        })
        .then((entry) => setMonths((prev) => (shouldStoreMonthEntry(prev[key], entry) ? { ...prev, [key]: entry } : prev)))
        .finally(() => loadingRef.current.delete(slot));
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- months entra só como guarda de "já carregado"
  }, [db, enabled, monthKeys, currentKey]);

  // --- leads da carteira (responsável atual), por id, em lotes de 30.
  const [fetchedLeads, setFetchedLeads] = useState(() => new Map());
  const askedRef = useRef(new Set());
  useEffect(() => {
    if (!db || !enabled) return undefined;
    const known = new Set((liveLeads || []).map((l) => l.id));
    askedRef.current.forEach((id) => known.add(id));
    const ids = leadIdsForRenewal(contracts, { monthKeys, known });
    if (!ids.length) return undefined;
    ids.forEach((id) => askedRef.current.add(id));
    chunk(ids).forEach((part) => {
      const q = query(colRef(db, LEADS_PATH), where(documentId(), 'in', part));
      loadWithCountCheck({
        fromCache: async () => (await getDocsFromCache(q)).docs.map(normalizeLeadDoc),
        fromServer: async () => (await getDocsWithAuthRetry(q)).docs.map(normalizeLeadDoc),
        countOnServer: async () => (await getCountFromServer(q)).data().count
      })
        .then(({ docs }) => {
          setFetchedLeads((prev) => {
            const next = new Map(prev);
            docs.forEach((l) => next.set(l.id, l));
            return next;
          });
        })
        .catch((e) => console.error('operacional carteira', e));
    });
    return undefined;
  }, [db, enabled, contracts, monthKeys, liveLeads]);

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
      byMonth[key] = {
        interactions: isCurrent ? (liveInteractions || []) : (loaded.interactions || []),
        leadsCreated,
        history: history.filter((h) => typeof h.date === 'string' && h.date.startsWith(key))
      };
    });
    const leadsById = new Map(fetchedLeads);
    (liveLeads || []).forEach((l) => leadsById.set(l.id, l));
    const loading = (monthKeys || []).some((k) => !monthEntryFits(months[k], k, currentKey));
    return { months: byMonth, leadsById, loading, failedKeys, historyScope };
  }, [monthKeys, months, currentKey, liveLeads, liveInteractions, history, fetchedLeads, historyScope]);
}
