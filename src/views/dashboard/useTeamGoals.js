// Meta de HOJE + prospecção (dia e MÊS) por consultor — mesma régua da Meta
// Diária e do painel da Equipe (lib compartilhada em lib/dailyGoal.js). Usa a
// base CRUA de leads/interações (não a janela de período do dashboard): a
// leitura de cobrança é sempre do dia/mês corrente. Admin-only: consultor não
// lê o histórico da equipe (regras) e as telas dele não usam este mapa.

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { appId, DAILY_GOAL_HISTORY_PATH } from '../../lib/firebase.js';
import { isAdminUser } from '../../lib/leads.js';
import { useGeneralConfig } from '../../contexts/GeneralConfigContext.jsx';
import {
  buildInteractionsByLead,
  computeDailyGoalSlots,
  slotTotals,
  computeDailyVolume,
  computeVolumeInRange,
  countMetaDaysInMonth,
  volumeTargetFor,
  dgDateKey,
  interactionOwnerAuthUid
} from '../../lib/dailyGoal.js';

export function useTeamGoals({ db, appUser, usersList, leads, interactions }) {
  const { metaWeekdays = [1, 2, 3, 4, 5], dailyVolumeTarget = 0 } = useGeneralConfig();

  // Histórico de metas batidas da equipe (admin lê todos — mesma regra usada
  // pelo painel da Equipe) p/ o "X de Y dias" do mês.
  const [teamHistory, setTeamHistory] = useState([]);
  useEffect(() => {
    if (!isAdminUser(appUser)) return undefined;
    const unsub = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', DAILY_GOAL_HISTORY_PATH),
      (snap) => setTeamHistory(snap.docs.map((d) => d.data())),
      (e) => console.error('dash team history', e)
    );
    return () => unsub();
  }, [db, appUser]);

  const goalByConsultant = useMemo(() => {
    if (!isAdminUser(appUser)) return {};
    const byLead = buildInteractionsByLead(interactions);
    const monthDays = countMetaDaysInMonth(metaWeekdays);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthPrefix = dgDateKey(new Date()).slice(0, 7); // 'YYYY-MM'
    // Fatias por dono calculadas UMA vez (O(N+M+H)) em vez de re-varrer tudo
    // POR usuário (era O(U×(N+M))). Mesmo resultado: as funções de meta/volume
    // filtram por dono internamente (caracterizado em __tests__/dailyGoal.test.js).
    const leadsByConsultant = new Map();
    (leads || []).forEach((l) => {
      const arr = leadsByConsultant.get(l.consultantId);
      if (arr) arr.push(l); else leadsByConsultant.set(l.consultantId, [l]);
    });
    // Chave = dono do VOLUME (interactionOwnerAuthUid), a MESMA que
    // computeVolumeInRange usa para filtrar — senão a fatia não bate. As
    // interações da PR C gravam actorAuthUid; as antigas caem no dono do lead.
    const interactionsByAuth = new Map();
    (interactions || []).forEach((i) => {
      const owner = interactionOwnerAuthUid(i);
      const arr = interactionsByAuth.get(owner);
      if (arr) arr.push(i); else interactionsByAuth.set(owner, [i]);
    });
    const historyByConsultant = new Map();
    (teamHistory || []).forEach((h) => {
      if (!h?.consultantId) return;
      const arr = historyByConsultant.get(h.consultantId);
      if (arr) arr.push(h); else historyByConsultant.set(h.consultantId, [h]);
    });
    const map = {};
    (usersList || []).forEach((u) => {
      const myLeads = leadsByConsultant.get(u.id) || [];
      const myInteractions = interactionsByAuth.get(u.authUid) || [];
      const { totalSlots, doneSlots } = slotTotals(computeDailyGoalSlots(myLeads, byLead, u.id));
      const volTarget = volumeTargetFor(u, dailyVolumeTarget);
      const vol = volTarget > 0 ? computeDailyVolume(myLeads, myInteractions, u.id, u.authUid) : null;
      const monthVol = volTarget > 0 ? computeVolumeInRange(myLeads, myInteractions, u.id, u.authUid, monthStart, null, metaWeekdays) : null;
      // Só dias PROGRAMADOS da meta contam no "X de Y dias" do mês (mesma régua
      // do alvo monthDays) — meta batida em dia fora da meta (ex.: sábado) não entra.
      const monthHits = (historyByConsultant.get(u.id) || []).filter((h) => {
        const ds = String(h.date || '');
        if (!ds.startsWith(monthPrefix)) return false;
        const [yy, mm, dd] = ds.split('-').map(Number);
        return Boolean(yy && mm && dd) && (metaWeekdays || []).includes(new Date(yy, mm - 1, dd).getDay());
      }).length;
      map[u.id] = {
        goalDone: doneSlots, goalTotal: totalSlots,
        volTotal: vol?.total || 0, volTarget,
        monthHits, monthDays,
        monthVol: monthVol?.total || 0, monthVolTarget: volTarget * monthDays,
      };
    });
    return map;
  }, [appUser, usersList, leads, interactions, metaWeekdays, dailyVolumeTarget, teamHistory]);

  return goalByConsultant;
}
