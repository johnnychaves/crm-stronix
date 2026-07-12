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
  dgDateKey
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
    const map = {};
    (usersList || []).forEach((u) => {
      const { totalSlots, doneSlots } = slotTotals(computeDailyGoalSlots(leads, byLead, u.id));
      const volTarget = volumeTargetFor(u, dailyVolumeTarget);
      const vol = volTarget > 0 ? computeDailyVolume(leads, interactions, u.id, u.authUid) : null;
      const monthVol = volTarget > 0 ? computeVolumeInRange(leads, interactions, u.id, u.authUid, monthStart, null, metaWeekdays) : null;
      // Só dias PROGRAMADOS da meta contam no "X de Y dias" do mês (mesma régua
      // do alvo monthDays) — meta batida em dia fora da meta (ex.: sábado) não entra.
      const monthHits = teamHistory.filter((h) => {
        if (h.consultantId !== u.id) return false;
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
