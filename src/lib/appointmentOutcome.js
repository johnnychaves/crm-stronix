// Escrita do desfecho de um agendamento (visita/aula) — fonte ÚNICA para os
// três lugares que confirmam presença: a Meta Diária, o atalho da tela de
// Aulas/Visitas e a presença cruzada (consultor de plantão marca a aula de
// outro). Mantê-los no mesmo helper evita que divirjam no shape gravado.
//
// A rule de leads permite qualquer membro do tenant dar UPDATE desde que o
// DONO (consultantAuthUid) fique inalterado — este helper nunca o toca, então
// funciona mesmo quando quem marca não é o dono (presença cruzada). O crédito
// da Meta vem da interaction daily_goal_done, que é lida por leadId+categoria
// (o autor não importa), então cai na Meta do DONO do lead automaticamente.
//
// Flags:
//   consumeAppointment — tira o lead de "Atrasado"/"Contato Hoje" limpando o
//     nextFollowUp. Comparecimento PRESERVA appointmentScheduledFor+appointmentType
//     (a pessoa nunca some da tela Visitas/Aulas — o desfecho reflete lá e na
//     Meta); só o cancelamento zera o agendamento de vez. Ligado no fluxo da
//     Meta; DESLIGADO no atalho das Aulas, marcador reversível puro.
//   promote — em comparecimento de visita/aula, empurra o lead para a etapa
//     "Negociação" do funil. Ligado na Meta; desligado no atalho leve.
//   writeGoalDone — grava a interaction daily_goal_done (crédito da Meta).
//     O atalho passa false quando a categoria já foi concluída hoje, p/ não
//     duplicar a marca no feed a cada clique.

import { doc, collection, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { appId, LEADS_PATH, INTERACTIONS_PATH } from './firebase.js';
import {
  APPOINTMENT_OUTCOMES,
  getAppointmentOutcomeMeta,
  getInteractionSecurityFields,
  DAILY_GOAL_CATEGORIES,
  DAILY_GOAL_CATEGORY_LABEL,
  outcomeAppliesToAula
} from './leads.js';
import { applyOutcomeToAula, clearAulaOutcome } from './aulasWrites.js';

// Desmarca o desfecho (volta para "aguardando"): usado pelo atalho das Aulas
// para reverter um Veio/Faltou clicado por engano. Só zera os campos de
// desfecho no lead — o professor/dashboard voltam a não contar a presença. A
// marca daily_goal_done do dia (se houver) não é apagada aqui (delete de
// interaction é restrito ao dono/admin pela rule); some sozinha na virada do
// dia. Preserva o DONO, então funciona para qualquer membro do tenant.
export async function clearAppointmentOutcome({ db, lead, categorySlug = null }) {
  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), {
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
  sourceLabel = 'Meta Diária'
}) {
  if (!APPOINTMENT_OUTCOMES.includes(outcome)) {
    throw new Error(`Desfecho inválido: ${outcome}`);
  }
  const meta = getAppointmentOutcomeMeta(outcome);
  const categoryLabel = DAILY_GOAL_CATEGORY_LABEL[categorySlug] || categorySlug;

  // Promoção p/ Negociação só em comparecimento de visita/aula e se a etapa
  // existir no funil do lead (a migration garante que existe).
  const isAttendedAppt =
    outcome === 'attended' &&
    (categorySlug === DAILY_GOAL_CATEGORIES.VISITA_HOJE || categorySlug === DAILY_GOAL_CATEGORIES.AULA_HOJE);
  const negStatus = promote && isAttendedAppt
    ? (statuses || []).find(s =>
        s.funnelId === lead.funnelId && (s.name || '').trim().toLowerCase() === 'negociação')
    : null;
  const shouldPromote =
    Boolean(negStatus) && lead.status !== negStatus.name && lead.status !== 'Venda' && lead.status !== 'Perda';

  const leadUpdate = {
    appointmentOutcome: outcome,
    appointmentOutcomeAt: serverTimestamp(),
    appointmentOutcomeBy: appUser.authUid || appUser.id || null
  };
  if (shouldPromote) leadUpdate.status = negStatus.name;
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
  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', LEADS_PATH, lead.id), leadUpdate);
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
      text: `${meta.icon} ${meta.label} — ${sourceLabel} (${categoryLabel})`,
      type: 'daily_goal_done',
      dailyGoalCategory: categorySlug,
      appointmentOutcome: outcome,
      createdAt: serverTimestamp()
    });
  }

  if (shouldPromote) {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', INTERACTIONS_PATH), {
      leadId: lead.id,
      consultantName: appUser.name,
      ...getInteractionSecurityFields(lead, appUser),
      text: `Fase alterada para [${negStatus.name}] após comparecimento em ${categoryLabel}.`,
      type: 'status_change',
      createdAt: serverTimestamp()
    });
  }

  return { promoted: shouldPromote, negStatusName: negStatus?.name || null };
}
