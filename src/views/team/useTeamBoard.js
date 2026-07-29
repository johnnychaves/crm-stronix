// Deriva TUDO que a tela "Meta da equipe" mostra, a partir do que já está em
// memória: as asas do mês (só dias encerrados), a régua de dias programados e
// as linhas do dia selecionado. Nenhuma leitura própria — o histórico vem por
// parâmetro, assinado pela view.
import { useMemo } from 'react';
import { DAILY_GOAL_CATEGORIES } from '../../lib/leads.js';
import {
  buildInteractionsByLead, computeDailyGoalSlots, slotTotals, computeRitmo,
  overdueDaysOf, dgDateKey, computeDailyVolume, computeVolumeInRange,
  listVolumeActionsInRange, volumeTargetFor, countClosedMetaDaysInMonth,
  interactionOwnerAuthUid,
} from '../../lib/dailyGoal.js';

// Fatiar leads e interações por dono UMA vez, em vez de re-varrer tudo por
// usuário. Mesmo critério que useTeamGoals usa — se divergir, a fatia não bate
// com o filtro interno das funções de meta e volume.
function sliceByOwner(leads, interactions) {
  const leadsByConsultant = new Map();
  (leads || []).forEach((l) => {
    const arr = leadsByConsultant.get(l.consultantId);
    if (arr) arr.push(l); else leadsByConsultant.set(l.consultantId, [l]);
  });
  const interactionsByAuth = new Map();
  (interactions || []).forEach((i) => {
    const owner = interactionOwnerAuthUid(i);
    const arr = interactionsByAuth.get(owner);
    if (arr) arr.push(i); else interactionsByAuth.set(owner, [i]);
  });
  return { leadsByConsultant, interactionsByAuth };
}

export function useTeamBoard({
  leads, interactions, usersList, teamHistory,
  metaWeekdays, slaOverdueDays, renewalCheckpoints, selectedDay, now,
}) {
  return useMemo(() => {
    const ref = now || new Date();
    const todayNum = ref.getDate();
    const year = ref.getFullYear(), month = ref.getMonth();
    const todayStart = new Date(year, month, todayNum);
    const monthStart = new Date(year, month, 1);
    const closedDays = countClosedMetaDaysInMonth(metaWeekdays, ref);

    const byLead = buildInteractionsByLead(interactions);
    const { leadsByConsultant, interactionsByAuth } = sliceByOwner(leads, interactions);

    const historyByConsultant = new Map();
    (teamHistory || []).forEach((h) => {
      if (!h?.consultantId) return;
      const arr = historyByConsultant.get(h.consultantId);
      if (arr) arr.push(h); else historyByConsultant.set(h.consultantId, [h]);
    });

    // Dia em foco. null = hoje.
    const isToday = selectedDay == null || selectedDay === todayNum;
    const dayNum = isToday ? todayNum : selectedDay;
    const from = new Date(year, month, dayNum);
    const to = new Date(year, month, dayNum + 1);
    const sel = {
      isToday, dayNum, dateKey: dgDateKey(from), from, to,
      isMetaDay: (metaWeekdays || []).includes(from.getDay()),
    };

    // Dias PROGRAMADOS do mês até hoje. Folga não é célula vazia: é ausência.
    const scheduled = [];
    for (let d = 1; d <= todayNum; d++) {
      const day = new Date(year, month, d);
      if ((metaWeekdays || []).includes(day.getDay())) scheduled.push(d);
    }

    const hitsByDate = new Map();
    (teamHistory || []).forEach((h) => {
      if (!h?.date) return;
      hitsByDate.set(h.date, (hitsByDate.get(h.date) || 0) + 1);
    });

    const rows = (usersList || []).map((u) => {
      const myLeads = leadsByConsultant.get(u.id) || [];
      const myInteractions = interactionsByAuth.get(u.authUid) || [];
      const history = historyByConsultant.get(u.id) || [];
      const ritmo = computeRitmo(history, metaWeekdays);
      const cota = volumeTargetFor(u);
      const hasCota = cota > 0;

      // ── Asas: só dias ENCERRADOS, dos dois lados da fração. Contar hoje num
      // lado só faria quem bate a meta de manhã aparecer 14/13.
      const metaPct = closedDays > 0 ? Math.round((ritmo.monthHits / closedDays) * 100) : null;
      const prospMes = hasCota
        ? computeVolumeInRange(myLeads, myInteractions, u.id, u.authUid, monthStart, todayStart, metaWeekdays).total
        : 0;
      const prospAlvoMes = cota * closedDays;
      const prospPct = hasCota && prospAlvoMes > 0 ? Math.round((prospMes / prospAlvoMes) * 100) : null;
      const asas = { metaPct, metaHits: ritmo.monthHits, closedDays, prospMes, prospAlvoMes, prospPct };

      // ── HOJE: a carteira completa existe.
      if (sel.isToday) {
        const processed = computeDailyGoalSlots(myLeads, byLead, u.id, renewalCheckpoints);
        const { totalSlots, doneSlots, progress } = slotTotals(processed);
        let pendCount = 0, critCount = 0;
        processed.forEach((l) => l.categorySlugs.forEach((slug) => {
          if (l.categoryStatus?.[slug]) return;
          pendCount++;
          if (slug === DAILY_GOAL_CATEGORIES.ATRASADO && overdueDaysOf(l, ref) >= slaOverdueDays) critCount++;
        }));
        const prospVol = hasCota ? computeDailyVolume(myLeads, myInteractions, u.id, u.authUid, ref) : null;
        const prospDone = prospVol?.total || 0;
        const prospAcoes = hasCota
          ? listVolumeActionsInRange(myLeads, myInteractions, u.id, u.authUid, sel.from, sel.to)
          : [];
        const prospHit = hasCota && prospDone >= cota;
        // metaOk = sem pendência (quem não tem tarefa hoje está em dia).
        // dailyHit = bateu de fato, o que exige ter tido tarefa.
        const metaOk = progress === 100;
        const dailyHit = totalSlots > 0 && progress === 100;
        return {
          user: u, isPast: false, hasCota, cota, ritmo, ...asas,
          processed, totalSlots, doneSlots, progress, pendCount, critCount,
          prospDone, prospVol, prospAcoes, prospHit, metaOk, dailyHit,
          // Regra mantida do sistema atual: sem cota, sem dia perfeito.
          perfect: dailyHit && prospHit,
        };
      }

      // ── Dia PASSADO: a CARTEIRA não é reconstruível (o histórico guarda só
      // "bateu", não quais tarefas existiam). A PROSPECÇÃO é: sai das
      // interações com volumeKind e dos leads criados no dia, que têm data e
      // hora — então o extrato nominal do dia 22 existe igual ao de hoje.
      const hitMeta = history.some((h) => h.date === sel.dateKey);
      const prospVol = hasCota
        ? computeVolumeInRange(myLeads, myInteractions, u.id, u.authUid, sel.from, sel.to)
        : null;
      const prospDone = prospVol?.total || 0;
      const prospAcoes = hasCota
        ? listVolumeActionsInRange(myLeads, myInteractions, u.id, u.authUid, sel.from, sel.to)
        : [];
      const prospHit = hasCota && prospDone >= cota;
      return {
        user: u, isPast: true, hasCota, cota, ritmo, ...asas,
        hitMeta, prospDone, prospVol, prospAcoes, prospHit,
        metaOk: hitMeta, dailyHit: hitMeta, perfect: hitMeta && prospHit,
      };
    });

    const teamSize = rows.length;
    const rail = scheduled.map((d) => {
      const key = dgDateKey(new Date(year, month, d));
      const isTodayCell = d === todayNum;
      const n = isTodayCell ? rows.filter((r) => r.metaOk).length : (hitsByDate.get(key) || 0);
      return {
        day: d, key, n, isToday: isTodayCell,
        selected: d === sel.dayNum,
        title: isTodayCell ? `Hoje · ${n} de ${teamSize} em dia` : `Dia ${d} · ${n} de ${teamSize} bateram`,
      };
    });

    const sorted = [...rows].sort((a, b) => {
      if (sel.isToday) {
        const aEmpty = a.totalSlots === 0, bEmpty = b.totalSlots === 0;
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
        return a.progress - b.progress; // quem precisa de atenção primeiro
      }
      return (Number(b.hitMeta) - Number(a.hitMeta)) || (b.prospDone - a.prospDone) ||
        (a.user.name || '').localeCompare(b.user.name || '');
    });

    return {
      sel, rail, rows: sorted, teamSize, closedDays,
      okNow: rows.filter((r) => r.metaOk).length,
      critTotal: rows.reduce((acc, r) => acc + (r.critCount || 0), 0),
      perfectCount: rows.filter((r) => r.perfect).length,
    };
  }, [leads, interactions, usersList, teamHistory, metaWeekdays, slaOverdueDays, renewalCheckpoints, selectedDay, now]);
}
