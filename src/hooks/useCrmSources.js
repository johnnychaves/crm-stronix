// Fontes do CRM por mês.
//
// Parte compartilhada com o Operacional: interações, leads criados e histórico
// de metas do mês, pela mesma carga e pela mesma memória de sessão
// (monthSources.js). O que um dos painéis carregou serve ao outro. O mês
// corrente usa as interações ao vivo do App e une os leads criados ao vivo.
//
// Parte do CRM, por mês: leads por convertedAt, leads por lostAt e registros
// de stronix_aulas por scheduledFor, as três de campo único (índice
// automático). Mês fechado: cache do aparelho conferido por contagem no
// servidor, menos as aulas dos dois meses anteriores ao corrente, que vêm do
// servidor uma vez por sessão (crm/queries.js, aulasFromServerFor): o desfecho
// e a conversão mudam o registro sem mudar a data, e a contagem não vê isso.
// Mês corrente: do servidor; na volta à tela, matrículas e perdas vêm pela
// busca incremental e os agendamentos vêm inteiros, porque o desfecho muda o
// registro sem mudar nenhuma data (crm/queries.js, mergeCrmCurrent).
//
// Leads citados por agendamento ou por troca de etapa que não estão em
// nenhuma lista são buscados por id, do servidor, uma vez por sessão, na
// mesma memória de leads por id do Operacional (leadsPorIdDaSessao). Quem não
// existe mais fica como desconhecido e conta em Outros.
//
// Limites conhecidos:
// - matrícula ou perda que acontece com a tela aberta só aparece na próxima
//   abertura. O bloco "Agora" é ao vivo;
// - a importação de planilha que promove um lead com data antiga só aparece
//   no mês corrente depois de recarregar a página, porque a busca incremental
//   parte da mais nova já vista.

import { useEffect, useMemo, useRef, useState } from 'react';
import { documentId, query, where } from 'firebase/firestore';
import { appId, LEADS_PATH, AULAS_PATH } from '../lib/firebase.js';
import { specToConstraints } from './usePagedLeads.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { getSafeDateOrNull } from '../lib/dates.js';
import { monthRange, monthKeyOf } from '../lib/operacional/month.js';
import {
  retryWithBackoff, monthEntryFits, shouldStoreMonthEntry, shouldRememberMonthEntry, failedMonthEntry,
  monthsFromSession, leadsWindowSince, mergeNewLeads, chunk
} from '../lib/operacional/queries.js';
import {
  convertedInMonthSpec, lostInMonthSpec, aulasInMonthSpec, currentFieldWindow, newestTimeOf,
  failedCrmEntry, shouldRememberCrmEntry, mergeCrmCurrent, referencedLeadIds, mergeLeadsById, aulasFromServerFor
} from '../lib/crm/queries.js';
import { colRef, serverDocs, cachedOrServer, loadMonth, loadCurrentLeads, leadsPorIdDaSessao, mesesDaSessao } from './monthSources.js';

const mapAula = (d) => {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    scheduledFor: getSafeDateOrNull(data.scheduledFor),
    createdAt: getSafeDateOrNull(data.createdAt),
    outcomeAt: getSafeDateOrNull(data.outcomeAt),
    convertedAt: getSafeDateOrNull(data.convertedAt)
  };
};

const leadsQuery = (db, spec) => query(colRef(db, LEADS_PATH), ...specToConstraints(spec));
const aulasQuery = (db, spec) => query(colRef(db, AULAS_PATH), ...specToConstraints(spec));

// Mês corrente, do servidor. Com a entrada da memória, matrículas e perdas vêm
// desde as âncoras dela; sem, o mês inteiro. Os agendamentos vêm sempre inteiros.
async function loadCrmCurrent(db, key, entry = null) {
  const { start, end } = monthRange(key);
  const winC = currentFieldWindow(key, entry?.newestConvertedAt, entry?.fetchedAt);
  const winL = currentFieldWindow(key, entry?.newestLostAt, entry?.fetchedAt);
  const fetchedAt = Date.now();
  const [converted, lost, aulas] = await Promise.all([
    serverDocs(leadsQuery(db, convertedInMonthSpec(winC.from, winC.to))).then((docs) => docs.map(normalizeLeadDoc)),
    serverDocs(leadsQuery(db, lostInMonthSpec(winL.from, winL.to))).then((docs) => docs.map(normalizeLeadDoc)),
    serverDocs(aulasQuery(db, aulasInMonthSpec(start.getTime(), end.getTime()))).then((docs) => docs.map(mapAula))
  ]);
  return { converted, lost, aulas, fetchedAt };
}

// Uma tentativa de carga da parte do CRM de um mês. Com `aulasFromServer`, as
// aulas do mês fechado vêm do servidor em vez do cache conferido
// (aulasFromServerFor).
async function loadCrmMonth(db, key, closed, { aulasFromServer = false } = {}) {
  if (!closed) {
    const fresh = await loadCrmCurrent(db, key);
    return {
      closed,
      ...fresh,
      newestConvertedAt: newestTimeOf(fresh.converted, 'convertedAt'),
      newestLostAt: newestTimeOf(fresh.lost, 'lostAt')
    };
  }
  const { start, end } = monthRange(key);
  const [from, to] = [start.getTime(), end.getTime()];
  const qAulas = aulasQuery(db, aulasInMonthSpec(from, to));
  const [converted, lost, aulas] = await Promise.all([
    cachedOrServer(leadsQuery(db, convertedInMonthSpec(from, to)), normalizeLeadDoc),
    cachedOrServer(leadsQuery(db, lostInMonthSpec(from, to)), normalizeLeadDoc),
    aulasFromServer ? serverDocs(qAulas).then((docs) => docs.map(mapAula)) : cachedOrServer(qAulas, mapAula)
  ]);
  return { closed, converted, lost, aulas };
}

// Memória de sessão da parte do CRM, por academia (appId).
const crmMesesDaSessao = new Map();

export function useCrmSources({ db, enabled = true, now, monthKeys, liveInteractions, liveLeads }) {
  const currentKey = monthKeyOf(now);

  // --- parte compartilhada: mesma carga e mesma memória do Operacional.
  const [shared, setShared] = useState(() => monthsFromSession(mesesDaSessao.get(appId), currentKey));
  const sharedLoadingRef = useRef(new Set());
  const sharedRefreshedRef = useRef(new Set());
  useEffect(() => {
    if (!db || !enabled) return undefined;
    const tenant = appId;
    if (!mesesDaSessao.has(tenant)) mesesDaSessao.set(tenant, new Map());
    const memory = mesesDaSessao.get(tenant);
    const store = (key, entry) => {
      if (shouldRememberMonthEntry(memory.get(key), entry)) memory.set(key, entry);
      setShared((prev) => (shouldStoreMonthEntry(prev[key], entry) ? { ...prev, [key]: entry } : prev));
    };
    (monthKeys || []).forEach((key) => {
      const closed = key !== currentKey;
      const entry = shared[key];
      if (monthEntryFits(entry, key, currentKey)) {
        // Mês corrente que veio da memória: busca só os leads criados desde a
        // âncora, uma vez por montagem. Se falhar, fica o que já estava.
        if (!closed && !entry.failed && !sharedRefreshedRef.current.has(key)) {
          sharedRefreshedRef.current.add(key);
          retryWithBackoff(() => loadCurrentLeads(db, key, leadsWindowSince(entry)))
            .then(({ leads, fetchedAt }) => {
              if (memory.has(key)) memory.set(key, mergeNewLeads(memory.get(key), leads, fetchedAt));
              setShared((prev) => {
                const next = mergeNewLeads(prev[key], leads, fetchedAt);
                return next === prev[key] ? prev : { ...prev, [key]: next };
              });
            })
            .catch((e) => console.error('crm leads novos', key, e));
        }
        return;
      }
      const slot = `${key}:${closed ? 'fechado' : 'aberto'}`;
      if (sharedLoadingRef.current.has(slot)) return;
      sharedLoadingRef.current.add(slot);
      if (!closed) sharedRefreshedRef.current.add(key);
      retryWithBackoff(() => loadMonth(db, key, closed))
        .catch((e) => {
          console.error('crm fontes compartilhadas', key, e);
          return failedMonthEntry(closed);
        })
        .then((next) => store(key, next))
        .finally(() => sharedLoadingRef.current.delete(slot));
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared entra só como guarda de "já carregado"
  }, [db, enabled, monthKeys, currentKey]);

  // --- parte do CRM: matrículas, perdas e agendamentos de cada mês.
  const [crm, setCrm] = useState(() => monthsFromSession(crmMesesDaSessao.get(appId), currentKey));
  const crmLoadingRef = useRef(new Set());
  const crmRefreshedRef = useRef(new Set());
  useEffect(() => {
    if (!db || !enabled) return undefined;
    const tenant = appId;
    if (!crmMesesDaSessao.has(tenant)) crmMesesDaSessao.set(tenant, new Map());
    const memory = crmMesesDaSessao.get(tenant);
    const store = (key, entry) => {
      if (shouldRememberCrmEntry(memory.get(key), entry)) memory.set(key, entry);
      setCrm((prev) => (shouldStoreMonthEntry(prev[key], entry) ? { ...prev, [key]: entry } : prev));
    };
    (monthKeys || []).forEach((key) => {
      const closed = key !== currentKey;
      const entry = crm[key];
      if (monthEntryFits(entry, key, currentKey)) {
        // Mês corrente que veio da memória: matrículas e perdas novas e os
        // agendamentos de novo, uma vez por montagem. Se falhar, fica o que já estava.
        if (!closed && !entry.failed && !crmRefreshedRef.current.has(key)) {
          crmRefreshedRef.current.add(key);
          retryWithBackoff(() => loadCrmCurrent(db, key, entry))
            .then((fresh) => {
              if (memory.has(key)) memory.set(key, mergeCrmCurrent(memory.get(key), fresh));
              setCrm((prev) => {
                const next = mergeCrmCurrent(prev[key], fresh);
                return next === prev[key] ? prev : { ...prev, [key]: next };
              });
            })
            .catch((e) => console.error('crm mês corrente', key, e));
        }
        return;
      }
      const slot = `${key}:${closed ? 'fechado' : 'aberto'}`;
      if (crmLoadingRef.current.has(slot)) return;
      crmLoadingRef.current.add(slot);
      if (!closed) crmRefreshedRef.current.add(key);
      retryWithBackoff(() => loadCrmMonth(db, key, closed, { aulasFromServer: aulasFromServerFor(key, currentKey) }))
        .catch((e) => {
          console.error('crm fontes', key, e);
          return failedCrmEntry(closed);
        })
        .then((next) => store(key, next))
        .finally(() => crmLoadingRef.current.delete(slot));
    });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- crm entra só como guarda de "já carregado"
  }, [db, enabled, monthKeys, currentKey]);

  // --- meses no formato de ctx.months: só os que têm as duas partes valendo.
  const months = useMemo(() => {
    const out = {};
    (monthKeys || []).forEach((key) => {
      const s = shared[key];
      const c = crm[key];
      if (!monthEntryFits(s, key, currentKey) || !monthEntryFits(c, key, currentKey)) return;
      const isCurrent = key === currentKey;
      const { start, end } = monthRange(key);
      const liveCreated = isCurrent
        ? (liveLeads || []).filter((l) => l.createdAt instanceof Date && l.createdAt >= start && l.createdAt < end)
        : [];
      out[key] = {
        interactions: isCurrent ? (liveInteractions || []) : (s.interactions || []),
        leadsCreated: [...new Map([...(s.leadsCreated || []), ...liveCreated].map((l) => [l.id, l])).values()],
        converted: c.converted || [],
        lost: c.lost || [],
        aulas: c.aulas || [],
        ...(s.failed || c.failed ? { failed: true } : {})
      };
    });
    return out;
  }, [monthKeys, shared, crm, currentKey, liveLeads, liveInteractions]);

  // --- leads citados que não estão em lista nenhuma, por id, em lotes de 30,
  // do servidor. `fetched` guarda null para quem não existe mais ou cuja busca
  // falhou nesta montagem (conta como desconhecido). A memória da sessão só
  // guarda os achados, e a próxima montagem tenta os outros de novo.
  const [fetched, setFetched] = useState(() => new Map(leadsPorIdDaSessao.get(appId)));
  const askedRef = useRef(new Set());
  const missing = useMemo(() => {
    const known = new Set(fetched.keys());
    (liveLeads || []).forEach((l) => known.add(l.id));
    Object.values(months).forEach((m) => {
      [m.leadsCreated, m.converted, m.lost].forEach((list) => (list || []).forEach((l) => known.add(l.id)));
    });
    return referencedLeadIds(months, known);
  }, [fetched, liveLeads, months]);
  useEffect(() => {
    if (!db || !enabled) return undefined;
    const tenant = appId;
    const ids = missing.filter((id) => !askedRef.current.has(id));
    if (!ids.length) return undefined;
    ids.forEach((id) => askedRef.current.add(id));
    const settle = (part, found) => setFetched((prev) => {
      const next = new Map(prev);
      part.forEach((id) => { if (!next.has(id)) next.set(id, null); });
      found.forEach((l) => next.set(l.id, l));
      return next;
    });
    chunk(ids).forEach((part) => {
      serverDocs(query(colRef(db, LEADS_PATH), where(documentId(), 'in', part)))
        .then((docs) => {
          const found = docs.map(normalizeLeadDoc);
          if (!leadsPorIdDaSessao.has(tenant)) leadsPorIdDaSessao.set(tenant, new Map());
          found.forEach((l) => leadsPorIdDaSessao.get(tenant).set(l.id, l));
          settle(part, found);
        })
        .catch((e) => {
          console.error('crm leads por id', e);
          settle(part, []);
        });
    });
    return undefined;
  }, [db, enabled, missing]);

  return useMemo(() => {
    const failedKeys = (monthKeys || []).filter((k) => months[k]?.failed);
    const loading = (monthKeys || []).some((k) => !months[k]) || missing.length > 0;
    const leadsById = mergeLeadsById({ months, currentKey, fetched, liveLeads });
    return { months, leadsById, loading, failedKeys };
  }, [monthKeys, months, missing, currentKey, fetched, liveLeads]);
}
