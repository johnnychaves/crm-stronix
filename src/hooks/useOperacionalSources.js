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
// criados desde o mais novo que o servidor já devolveu, menos 2 minutos de
// folga, unidos por id (queries.leadsWindowSince). Entrada que falhou nunca é
// guardada, para a volta tentar de novo.
//
// Toda busca que precisa do servidor confere de onde veio a resposta: sem
// rede, o getDocs responde do cache do aparelho sem erro, e isso conta como
// falha (queries.docsFromServerOrThrow). Assim um resultado incompleto não
// entra na memória da sessão como mês completo.
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
import { documentId, onSnapshot, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH, DAILY_GOAL_HISTORY_PATH } from '../lib/firebase.js';
import { specToConstraints } from './usePagedLeads.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { monthRange, monthKeyOf } from '../lib/operacional/month.js';
import {
  goalHistorySinceSpec, retryWithBackoff, retryDelayMs, monthEntryFits, shouldStoreMonthEntry, failedMonthEntry,
  shouldRememberMonthEntry, monthsFromSession, mergeNewLeads, leadsWindowSince, monthHistory,
  chunk, leadIdsForRenewal
} from '../lib/operacional/queries.js';
// Busca dos meses e memória da sessão, divididas com o CRM (monthSources.js).
import { colRef, mapHistory, serverDocs, loadCurrentLeads, loadMonth, leadsPorIdDaSessao, mesesDaSessao } from './monthSources.js';

export function useOperacionalSources({ db, enabled = true, now, monthKeys, liveInteractions, liveLeads, contracts, appUser }) {
  const currentKey = monthKeyOf(now);
  const authUid = appUser?.authUid;

  // --- histórico de metas ao vivo: só o mês corrente. Os fechados vêm com o
  // mês (loadMonth). Seis meses ao vivo custavam cerca de 540 docs a cada
  // montagem ou volta do portão de atividade.
  //
  // A assinatura da equipe pode ser negada: pela regra antiga do histórico
  // (cada um lê só o próprio) ou por um permission-denied passageiro logo
  // depois do login. Tenta de novo com espera de 1, 2 e 4 segundos e só então
  // cai para os docs da pessoa, de todos os meses (scope 'own'); a saída
  // recorta por mês. `key` diz de que mês corrente é a resposta: sem resposta
  // ainda, o histórico que depende da assinatura sai null e a meta fica sem
  // número em vez de zerada. Sem a assinatura da pessoa (sem authUid, ou com
  // ela falhando), docs fica null pelo mesmo motivo.
  const [live, setLive] = useState({ key: null, scope: 'all', docs: [] });
  useEffect(() => {
    if (!db || !enabled) return undefined;
    const key = currentKey;
    let stop = () => {};
    let timer = null;
    let over = false;
    const team = query(colRef(db, DAILY_GOAL_HISTORY_PATH), ...specToConstraints(goalHistorySinceSpec(`${key}-01`)));
    const listenOwn = () => {
      if (!authUid) { setLive({ key, scope: 'own', docs: null }); return; }
      stop = onSnapshot(
        query(colRef(db, DAILY_GOAL_HISTORY_PATH), where('consultantAuthUid', '==', authUid)),
        (snap) => { if (!over) setLive({ key, scope: 'own', docs: snap.docs.map(mapHistory) }); },
        () => { if (!over) setLive({ key, scope: 'own', docs: null }); }
      );
    };
    const listenTeam = (attempt) => {
      stop = onSnapshot(team, (snap) => {
        if (!over) setLive({ key, scope: 'all', docs: snap.docs.map(mapHistory) });
      }, () => {
        if (over) return;
        const delay = retryDelayMs(attempt);
        if (delay == null) { listenOwn(); return; }
        timer = setTimeout(() => { timer = null; if (!over) listenTeam(attempt + 1); }, delay);
      });
    };
    listenTeam(0);
    // Desmontou ou o efeito se refez: some a espera pendente e a assinatura.
    return () => {
      over = true;
      if (timer) clearTimeout(timer);
      stop();
    };
  }, [db, enabled, currentKey, authUid]);

  // --- meses: os fechados completos; o corrente só com os leads criados. O
  // estado começa da memória da sessão, sem o que deixou de valer.
  const [months, setMonths] = useState(() => monthsFromSession(mesesDaSessao.get(appId), currentKey));
  const loadingRef = useRef(new Set());
  // Mês corrente já buscado nesta montagem, pela carga cheia ou pela
  // incremental: a incremental roda uma vez por montagem.
  const refreshedRef = useRef(new Set());
  // Mês fechado que veio sem histórico (consulta negada) quando a assinatura
  // da equipe já responde: a negação passou, e ele recarrega. Em texto, para o
  // efeito rodar quando a lista muda e não a cada entrada nova.
  const historyGaps = live.scope === 'all' && live.key === currentKey
    ? Object.keys(months).filter((k) => months[k]?.closed && months[k].history == null).sort().join(',')
    : '';
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
    // âncora e une por id. Se falhar (inclusive sem rede), fica o que já estava.
    const refresh = (key, since) => {
      retryWithBackoff(() => loadCurrentLeads(db, key, since))
        .then(({ leads, fetchedAt }) => {
          if (memory.has(key)) memory.set(key, mergeNewLeads(memory.get(key), leads, fetchedAt));
          setMonths((prev) => {
            const next = mergeNewLeads(prev[key], leads, fetchedAt);
            return next === prev[key] ? prev : { ...prev, [key]: next };
          });
        })
        .catch((e) => console.error('operacional leads novos', key, e));
    };
    const gaps = historyGaps ? historyGaps.split(',') : [];
    (monthKeys || []).forEach((key) => {
      const closed = key !== currentKey;
      const entry = months[key];
      // Entrada que vale: o mês fechado é usado direto, sem nova contagem.
      if (monthEntryFits(entry, key, currentKey) && !gaps.includes(key)) {
        if (!closed && !entry.failed && !refreshedRef.current.has(key)) {
          refreshedRef.current.add(key);
          refresh(key, leadsWindowSince(entry));
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
  }, [db, enabled, monthKeys, currentKey, historyGaps]);

  // --- leads da carteira (responsável atual), por id, em lotes de 30. Sempre do
  // servidor: a conferência por contagem só enxerga exclusão, e uma troca de
  // responsável ficaria congelada no cache. Uma vez por id na sessão: o que já
  // foi lido (leadsPorIdDaSessao) entra como semente e não é buscado de novo.
  // Resposta que veio do cache do aparelho (sem rede) não entra na memória: a
  // próxima montagem tenta de novo.
  const [seed] = useState(() => new Map(leadsPorIdDaSessao.get(appId)));
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
      serverDocs(q)
        .then((snapDocs) => {
          const docs = snapDocs.map(normalizeLeadDoc);
          if (!leadsPorIdDaSessao.has(tenant)) leadsPorIdDaSessao.set(tenant, new Map());
          docs.forEach((l) => leadsPorIdDaSessao.get(tenant).set(l.id, l));
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
    const liveReady = live.key === currentKey;
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
        // O ao vivo no mês corrente e, com a assinatura só da pessoa, em todos
        // os meses; nos fechados, o que veio com o mês. Sem resposta, ou com a
        // assinatura falhando, null: a meta fica sem número (queries.monthHistory).
        history: monthHistory(key, { isCurrent, live, liveReady, loaded }),
        // Mês que falhou vai marcado: os marcos de outro mês que dependem dele
        // ficam sem número em vez de menores.
        ...(loaded.failed ? { failed: true } : {})
      };
    });
    const leadsById = new Map(fetchedLeads);
    (liveLeads || []).forEach((l) => leadsById.set(l.id, l));
    const loading = (monthKeys || []).some((k) => !monthEntryFits(months[k], k, currentKey));
    // A assinatura só da pessoa também falhou (ou não há authUid): nem a meta
    // dela tem número, e a tela diz "indisponível" em vez de "carregando".
    const historyFailed = live.scope === 'own' && liveReady && !Array.isArray(live.docs);
    return { months: byMonth, leadsById, loading, failedKeys, historyScope: live.scope, historyFailed };
  }, [monthKeys, months, currentKey, liveLeads, liveInteractions, live, fetchedLeads]);
}
