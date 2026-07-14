// Clientes com contrato "a vencer" (E2c) por query (índice #4:
// lifecycleBucket ASC, currentContractEndsAt ASC), pro badge clientsAVencer —
// em vez de varrer o prop global de leads. A query traz uma JANELA que é
// superconjunto de A_VENCER (margem de 1 dia em cada ponta) e o filtro EXATO é
// deriveLeadContractStatus client-side (a fonte da verdade — exclui
// CANCELADO/VENCIDO na borda). Cliente sem currentContractEndsAt não é A_VENCER
// e some do range: a contagem casa mesmo sem backfill do campo.
//
// Não é ao vivo (getDocs). `reloadKey` (ex.: o dayKey do App) força o refetch na
// virada do dia. A categoria Renovação da Meta Diária NÃO é migrada aqui: ela
// vive em dailyGoal.js e precisa dos leads inteiros pras outras categorias —
// migra junto com a Meta na PR G.

import { useMemo } from 'react';
import { usePagedLeads } from './usePagedLeads.js';
import { renewalClientsQuerySpec } from '../lib/leadQueries.js';
import { LEADS_PATH } from '../lib/firebase.js';
import { DAY_MS } from '../lib/leadStatus.js';
import { deriveLeadContractStatus, CONTRACT_STATUS } from '../lib/contracts.js';

export function useRenewalClients({ db, contractThresholdDays, enabled = true, reloadKey = 0 }) {
  const win = useMemo(() => {
    const now = Date.now();
    return { start: now - DAY_MS, end: now + (Number(contractThresholdDays || 0) + 1) * DAY_MS };
    // reloadKey entra pra recomputar a janela (novo "now") na virada do dia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractThresholdDays, reloadKey]);

  const spec = useMemo(() => renewalClientsQuerySpec(win.start, win.end), [win.start, win.end]);

  const { items, loading } = usePagedLeads({
    db, path: LEADS_PATH, spec,
    specKey: `renewal:${contractThresholdDays}:${reloadKey}`,
    enabled: enabled && !!db,
  });

  const clients = useMemo(() => {
    const now = new Date();
    return (items || []).filter(
      (l) => deriveLeadContractStatus(l, now, contractThresholdDays) === CONTRACT_STATUS.A_VENCER
    );
  }, [items, contractThresholdDays]);

  return { clients, loading };
}
