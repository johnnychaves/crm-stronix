// Escrita do desfecho de um agendamento (visita/aula) — fonte ÚNICA para os
// lugares que confirmam presença na Meta Diária: a Agenda de hoje e a correção
// do "Feitos hoje". O card "A fazer" grava pelo handleOutcome do DailyGoalView,
// que usa a mesma regra de promoção (planPromotion).
//
// A rule de leads permite qualquer membro do tenant dar UPDATE desde que o
// DONO (consultantAuthUid) fique inalterado — este helper nunca o toca, então
// funciona mesmo quando quem marca não é o dono (agenda compartilhada). O
// crédito da Meta vem da interaction daily_goal_done, que é lida por
// leadId+categoria (o autor não importa), então cai na Meta do DONO do lead.
//
// Flags:
//   consumeAppointment — tira o lead de "Atrasado"/"Contato Hoje" limpando o
//     nextFollowUp. Comparecimento PRESERVA appointmentScheduledFor+appointmentType
//     (a pessoa nunca some da tela Visitas/Aulas — o desfecho reflete lá e na
//     Meta); só o cancelamento zera o agendamento de vez.
//   promote — em comparecimento de visita/aula, empurra o lead para a etapa
//     "Negociação" do funil e guarda de onde ele saiu (appointmentPromotedFrom).
//   writeGoalDone — grava a interaction daily_goal_done (crédito da Meta).
//     A agenda passa false quando a categoria já foi concluída hoje, p/ não
//     duplicar a marca no feed a cada clique.
//   correction — a marca do dia é de correção: texto "↩️ Desfecho corrigido" e
//     outcomeCorrection: true.
//   extraPatch — campos a mais no mesmo updateDoc do lead (a correção manda a
//     volta da etapa e do próximo contato).
//
// Correção (correctAppointmentOutcome): regras puras em outcomeCorrection.js.

import { doc, collection, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { stageChangeFields } from './stageMove.js';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from './firebase.js';
import {
  APPOINTMENT_OUTCOMES,
  getAppointmentOutcomeMeta,
  getInteractionSecurityFields,
  DAILY_GOAL_CATEGORY_LABEL,
  outcomeAppliesToAula
} from './leads.js';
import { applyOutcomeToAula, clearAulaOutcome } from './aulasWrites.js';
import { logInteraction } from './interactions.js';
import { withBucket } from './leadDerived.js';
import { planPromotion, planAttendedUndo, correctionText, revertStageText } from './outcomeCorrection.js';

const leadRef = (db, id) => doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, id);

// Desmarca o desfecho (volta para "aguardando"). Só zera os campos de
// desfecho no lead, mais o que vier em extraPatch (a correção manda a volta
// da etapa e do próximo contato). A marca daily_goal_done do dia (se houver)
// não é apagada aqui (delete de interaction é restrito ao dono/admin pela
// rule); some sozinha na virada do dia. Preserva o DONO, então funciona para
// qualquer membro do tenant.
export async function clearAppointmentOutcome({ db, lead, categorySlug = null, extraPatch = null }) {
  await updateDoc(leadRef(db, lead.id), {
    ...(extraPatch || {}),
    appointmentOutcome: null,
    appointmentOutcomeAt: null,
    appointmentOutcomeBy: null
  });
  // Dual-write best-effort: só desfecho de aula toca o histórico (guarda #1).
  if (outcomeAppliesToAula(categorySlug)) {
    try { await clearAulaOutcome({ db, lead }); } catch (e) { console.error('clearAulaOutcome falhou', e); }
  }
}

export async function writeAppointmentOutcome({
  db,
  lead,
  outcome,
  categorySlug,
  appUser,
  statuses = null,
  consumeAppointment = true,
  promote = true,
  writeGoalDone = true,
  sourceLabel = 'Meta Diária',
  correction = false,
  extraPatch = null
}) {
  if (!APPOINTMENT_OUTCOMES.includes(outcome)) {
    throw new Error(`Desfecho inválido: ${outcome}`);
  }
  const meta = getAppointmentOutcomeMeta(outcome);
  const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug;
  const { toStatus, promotedFrom } = planPromotion({ lead, outcome, categorySlug, statuses, promote });

  const leadUpdate = {
    ...(extraPatch || {}),
    appointmentOutcome: outcome,
    appointmentOutcomeAt: serverTimestamp(),
    appointmentOutcomeBy: appUser.authUid || appUser.id || null,
    appointmentPromotedFrom: promotedFrom
  };
  if (toStatus) {
    leadUpdate.status = toStatus;
    leadUpdate.statusEnteredAt = serverTimestamp();
  }
  // Comparecimento PRESERVA o agendamento (appointmentScheduledFor+appointmentType)
  // para a pessoa NUNCA sumir da tela Visitas/Aulas e o desfecho refletir lá e na
  // Meta (regra do Johnny). Limpa só o nextFollowUp — o que já tira de "Atrasado"/
  // "Contato Hoje". Cancelamento remove o compromisso de vez.
  if (consumeAppointment && (outcome === 'attended' || outcome === 'cancelled')) {
    leadUpdate.nextFollowUp = null;
    if (outcome === 'cancelled') {
      leadUpdate.appointmentScheduledFor = null;
      leadUpdate.appointmentType = null;
    }
  }
  await updateDoc(leadRef(db, lead.id), leadUpdate);
  // Dual-write best-effort: SÓ desfecho de aula toca o histórico de aulas
  // (guarda #1 — desfecho de visita não pode mexer numa aula antiga do lead).
  if (outcomeAppliesToAula(categorySlug)) {
    try { await applyOutcomeToAula({ db, lead, outcome }); } catch (e) { console.error('applyOutcomeToAula falhou', e); }
  }

  if (writeGoalDone) {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
      leadId: lead.id,
      consultantName: appUser.name,
      ...getInteractionSecurityFields(lead, appUser),
      text: correction
        ? correctionText({ outcome, sourceLabel, categoryLabel })
        : `${meta.icon} ${meta.label} — ${sourceLabel} (${categoryLabel})`,
      type: 'daily_goal_done',
      dailyGoalCategory: categorySlug,
      appointmentOutcome: outcome,
      ...(correction ? { outcomeCorrection: true } : {}),
      createdAt: serverTimestamp()
    });
  }

  if (toStatus) {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
      leadId: lead.id,
      consultantName: appUser.name,
      ...getInteractionSecurityFields(lead, appUser),
      text: `Fase alterada para [${toStatus}] após comparecimento em ${categoryLabel}.`,
      type: 'status_change',
      ...stageChangeFields(lead, toStatus),
      createdAt: serverTimestamp()
    });
  }

  return { promoted: Boolean(toStatus), negStatusName: toStatus };
}

// Corrige o desfecho de hoje, pela Agenda de hoje ou pelo "Feitos hoje".
//   from: o desfecho gravado ('attended' ou 'no_show')
//   to  : 'attended', 'no_show', ou null para desfazer
// Trocar para Compareceu é um Compareceu comum, com a marca de correção.
// Trocar para Não compareceu e desfazer tiram o que o Compareceu fez: a etapa
// e a limpeza do próximo contato (planAttendedUndo). A marca de correção é
// uma daily_goal_done: o relatório de visitas fica com o último desfecho do
// dia (visitOutcomesByLead) e o Operacional não conta de novo a tarefa da
// mesma pessoa no mesmo dia (tasksByType). Desfazer não grava marca, como antes.
// A marca de correção passa pelo writeAppointmentOutcome, como a primeira
// marcação da agenda, para o crédito da tarefa ficar com o DONO do lead e não
// com quem clicou. Só o status_change da volta da etapa vai por logInteraction,
// que registra quem corrigiu (e status_change não conta como tarefa).
export async function correctAppointmentOutcome({
  db,
  lead,
  from,
  to,
  categorySlug,
  appUser,
  statuses = null,
  isClient = false,
  sourceLabel = 'Meta Diária'
}) {
  if (from === to) return { revertedTo: null, promotedTo: null };
  if (to === 'attended') {
    const { negStatusName } = await writeAppointmentOutcome({
      db, lead, outcome: 'attended', categorySlug, appUser, statuses,
      promote: !isClient, consumeAppointment: !isClient, writeGoalDone: true, sourceLabel, correction: true
    });
    return { revertedTo: null, promotedTo: negStatusName };
  }
  if (to !== 'no_show' && to !== null) throw new Error(`Correção inválida: ${to}`);

  const { patch, revertedTo } = planAttendedUndo({ lead, fromOutcome: from, isClient });
  // lifecycleBucket só recalcula quando a etapa muda.
  const bucketed = (p) => (p.status ? withBucket(p, lead) : p);

  if (to === 'no_show') {
    await writeAppointmentOutcome({
      db, lead, outcome: 'no_show', categorySlug, appUser, statuses,
      promote: false, consumeAppointment: false, writeGoalDone: true, sourceLabel, correction: true,
      extraPatch: bucketed(patch)
    });
  } else {
    await clearAppointmentOutcome({ db, lead, categorySlug, extraPatch: bucketed(patch) });
  }

  if (revertedTo) {
    await logInteraction(db, lead, appUser, {
      text: revertStageText(revertedTo),
      type: 'status_change',
      ...stageChangeFields(lead, revertedTo)
    });
  }
  return { revertedTo, promotedTo: null };
}
