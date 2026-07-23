// Clientes com contrato "a vencer" (E2c) por query (índice #4:
// lifecycleBucket ASC, currentContractEndsAt ASC), pro badge clientsAVencer —
// em vez de varrer o prop global de leads. A query traz uma JANELA que é
// superconjunto de A_VENCER (margem de 1 dia em cada ponta) e o filtro EXATO é
// deriveLeadContractStatus client-side (a fonte da verdade — exclui
// CANCELADO/VENCIDO na borda). Cliente sem currentContractEndsAt não é A_VENCER
// e some do range: a contagem casa mesmo sem backfill do campo.
//
// A JANELA da query vai até o MAIOR entre contractThresholdDays e os marcos
// de renovação (renewalCheckpoints — ver src/lib/renewalGoal.js): os marcos
// configuráveis da Meta (ex.: 90/60 dias) podem disparar bem antes do
// threshold do sistema (default 30), então o pool buscado precisa cobrir o
// marco mais distante, senão o cliente nem chega no client-side pra
// shouldPromptRenewal avaliar. `clients` (o filtro EXATO A_VENCER, usado pro
// badge/ClientsView) continua só em contractThresholdDays — não muda.
// `candidates` é o pool CRU (sem o filtro A_VENCER) que a Meta Diária consome
// via App.jsx (metaLeads) pra avaliar os marcos por conta própria.
//
// Não é ao vivo (getDocs). `reloadKey` (ex.: o dayKey do App) força o refetch na
// virada do dia.

import { useMemo } from 'react';
import { usePagedLeads } from './usePagedLeads.js';
import { renewalClientsQuerySpec } from '../lib/leadQueries.js';
import { LEADS_PATH } from '../lib/firebase.js';
import { DAY_MS } from '../lib/leadStatus.js';
import { normalizeLeadDoc } from '../lib/leads.js';
import { deriveLeadContractStatus, CONTRACT_STATUS } from '../lib/contracts.js';

export function useRenewalClients({ db, contractThresholdDays, renewalCheckpoints, enabled = true, reloadKey = 0 }) {
  const win = useMemo(() => {
    const now = Date.now();
    const days = [Number(contractThresholdDays) || 0, ...(Array.isArray(renewalCheckpoints) ? renewalCheckpoints.map(Number) : [])]
      .filter((n) => Number.isFinite(n) && n > 0);
    const maxDays = days.length ? Math.max(...days) : 0;
    return { start: now - DAY_MS, end: now + (maxDays + 1) * DAY_MS };
    // reloadKey entra pra recomputar a janela (novo "now") na virada do dia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractThresholdDays, renewalCheckpoints, reloadKey]);

  const spec = useMemo(() => renewalClientsQuerySpec(win.start, win.end), [win.start, win.end]);

  const { items, loading } = usePagedLeads({
    db, path: LEADS_PATH, spec,
    specKey: `renewal:${contractThresholdDays}:${(renewalCheckpoints || []).join(',')}:${reloadKey}`,
    // Mesmo shape do prop global (a Meta Diária no G1d injeta estes clientes na
    // base e computeDailyGoalSlots/volume esperam createdAt/nextFollowUp já como
    // Date). Não muda a contagem do badge — deriveLeadContractStatus lê só
    // currentContractEndsAt (que normalizeLeadDoc não toca).
    mapDoc: normalizeLeadDoc,
    enabled: enabled && !!db,
  });

  const clients = useMemo(() => {
    const now = new Date();
    return (items || []).filter(
      (l) => deriveLeadContractStatus(l, now, contractThresholdDays) === CONTRACT_STATUS.A_VENCER
    );
  }, [items, contractThresholdDays]);

  return { clients, candidates: items || [], loading };
}
