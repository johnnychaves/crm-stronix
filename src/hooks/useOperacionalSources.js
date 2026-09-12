// Fontes do Operacional por mês. Mês corrente: interações ao vivo (do App),
// leads criados buscados uma vez e unidos aos ao vivo, histórico ao vivo. Meses
// fechados: cache local conferido por contagem (queries.loadWithCountCheck).
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
  loadWithCountCheck, chunk, leadIdsForRenewal
} from '../lib/operacional/queries.js';

const mapInteraction = (d) => {
  const data = d.data();
  return { id: d.id, ...data, createdAt: getSafeDate(data.createdAt) };
};

export function useOperacionalSources({ db, enabled = true, now, monthKeys, liveInteractions, liveLeads, contracts, appUser }) {
  const currentKey = monthKeyOf(now);
  const ref = (p) => collection(db, 'artifacts', appId, 'public', 'data', p);

  // --- histórico de metas: uma assinatura desde o mês mais antigo pedido.
  const oldestKey = useMemo(() => [...(monthKeys || [])].sort()[0] || currentKey, [monthKeys, currentKey]);
  const [history, setHistory] = useState([]);
  const [historyScope, setHistoryScope] = useState('all');
  useEffect(() => {
    if (!db || !enabled) return undefined;
    let unsub = () => {};
    let cancelled = false;
    const all = query(ref(DAILY_GOAL_HISTORY_PATH), ...specToConstraints(goalHistorySinceSpec(`${oldestKey}-01`)));
    unsub = onSnapshot(all, (snap) => {
      if (cancelled) return;
      setHistoryScope('all');
      setHistory(snap.docs.map((d) => d.data()));
    }, () => {
      if (cancelled) return;
      // Regra antiga (só o próprio histórico) ainda publicada: cai para os docs da pessoa.
      if (!appUser?.authUid) return;
      setHistoryScope('own');
      unsub = onSnapshot(
        query(ref(DAILY_GOAL_HISTORY_PATH), where('consultantAuthUid', '==', appUser.authUid)),
        (snap) => { if (!cancelled) setHistory(snap.docs.map((d) => d.data())); },
        () => { if (!cancelled) setHistory([]); }
      );
    });
    return () => { cancelled = true; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref() é estável por db/appId
  }, [db, enabled, oldestKey, appUser?.authUid]);

  // --- meses fechados e leads criados no mês corrente.
  const [months, setMonths] = useState({});
  const loadingRef = useRef(new Set());
  useEffect(() => {
    if (!db || !enabled) return undefined;
    (monthKeys || []).forEach((key) => {
      if (months[key] || loadingRef.current.has(key)) return;
      loadingRef.current.add(key);
      const { start, end } = monthRange(key);
      const qI = query(ref(INTERACTIONS_PATH), ...specToConstraints(interactionsInMonthSpec(start.getTime(), end.getTime())));
      const qL = query(ref(LEADS_PATH), ...specToConstraints(leadsCreatedInMonthSpec(start.getTime(), end.getTime())));
      const closed = key !== currentKey;
      const load = (q, mapDoc) => (closed
        ? loadWithCountCheck({
            fromCache: async () => (await getDocsFromCache(q)).docs.map(mapDoc),
            fromServer: async () => (await getDocsWithAuthRetry(q)).docs.map(mapDoc),
            countOnServer: async () => (await getCountFromServer(q)).data().count
          }).then((r) => r.docs)
        : getDocsWithAuthRetry(q).then((snap) => snap.docs.map(mapDoc)));
      Promise.all([closed ? load(qI, mapInteraction) : Promise.resolve(null), load(qL, normalizeLeadDoc)])
        .then(([interactions, leadsCreated]) => {
          setMonths((prev) => ({ ...prev, [key]: { interactions, leadsCreated } }));
        })
        .catch((e) => console.error('operacional fontes', key, e))
        .finally(() => loadingRef.current.delete(key));
    });
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
      const q = query(ref(LEADS_PATH), where(documentId(), 'in', part));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref() é estável por db/appId
  }, [db, enabled, contracts, monthKeys, liveLeads]);

  // --- saída no formato de ctx.months e ctx.leadsById.
  return useMemo(() => {
    const byMonth = {};
    (monthKeys || []).forEach((key) => {
      const loaded = months[key];
      if (!loaded) return;
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
    const loading = (monthKeys || []).some((k) => !months[k]);
    return { months: byMonth, leadsById, loading, historyScope };
  }, [monthKeys, months, currentKey, liveLeads, liveInteractions, history, fetchedLeads, historyScope]);
}
