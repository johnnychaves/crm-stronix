// Clientes com contato marcado para HOJE, para a Meta Diária.
//
// POR QUE EXISTE: a base da Meta (App.jsx, metaLeads) é formada por leads
// 'ativo' mais os clientes que estão numa janela de vencimento de contrato
// (useRenewalClients). Aluno com contrato longe de vencer não entra em nenhum
// dos dois. Resultado: marcar um contato com ele fazia a tarefa sumir da Meta
// sem aviso, apesar de a categoria "Contato Hoje" ter uma exceção explícita
// para cliente (ver dailyGoal.js, categoria 5).
//
// CUSTO: uma query por carga, recortada por dia. Traz só quem tem toque marcado
// para hoje, então o volume é de unidades, não da base. Usa o índice composto
// (lifecycleBucket, nextFollowUp) declarado em firestore.indexes.json — sem ele
// a query falha com failed-precondition.
//
// Não é ao vivo (mesmo padrão do useRenewalClients): `reloadKey` (o dayKey do
// App) refaz a busca na virada do dia.

import { useMemo } from 'react';
import { usePagedLeads } from './usePagedLeads.js';
import { clientsWithContactTodayQuerySpec } from '../lib/leadQueries.js';
import { LEADS_PATH } from '../lib/firebase.js';
import { normalizeLeadDoc } from '../lib/leads.js';

export function useClientsWithContactToday({ db, enabled = true, reloadKey = 0 }) {
  const win = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
    // reloadKey entra para recomputar o dia na virada da meia-noite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const spec = useMemo(() => clientsWithContactTodayQuerySpec(win.start, win.end), [win.start, win.end]);

  const { items, loading } = usePagedLeads({
    db, path: LEADS_PATH, spec,
    specKey: `clientContactToday:${reloadKey}`,
    // Mesmo shape do prop global: computeDailyGoalSlots espera createdAt e
    // nextFollowUp já como Date.
    mapDoc: normalizeLeadDoc,
    enabled: enabled && !!db,
  });

  return { clients: items || [], loading };
}
