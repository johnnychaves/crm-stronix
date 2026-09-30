// Correção do desfecho de visita e aula na Meta Diária. Puro: sem React e sem
// SDK, testado em node. Quem grava é src/lib/appointmentOutcome.js.
//
// O Compareceu de um lead leva ele para Negociação. Para a correção conseguir
// desfazer isso, o lead guarda de onde saiu em `appointmentPromotedFrom`
// ({ status, statusEnteredAt, funnelId, toStatus }). Toda gravação de desfecho
// escreve o campo, com null quando não houve promoção. Assim ele sempre fala do
// desfecho atual, e nunca de um agendamento antigo.

import { DAILY_GOAL_CATEGORIES, getAppointmentOutcomeMeta, getLeadAppointmentDate } from './leads.js';
import { getSafeDateOrNull } from './dates.js';

const isApptCategory = (slug) =>
  slug === DAILY_GOAL_CATEGORIES.VISITA_HOJE || slug === DAILY_GOAL_CATEGORIES.AULA_HOJE;

const sameLocalDay = (a, b) =>
  a instanceof Date && b instanceof Date &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// Promoção do Compareceu: a etapa Negociação do funil do lead, quando ela
// existe e o lead ainda não está nela, em Venda ou em Perda. Com `promote`
// desligado (cliente na agenda), nunca promove.
export function planPromotion({ lead, outcome, categorySlug, statuses, promote = true }) {
  const none = { toStatus: null, promotedFrom: null };
  if (!promote || outcome !== 'attended' || !isApptCategory(categorySlug)) return none;
  const neg = (statuses || []).find(
    (s) => s.funnelId === lead?.funnelId && (s.name || '').trim().toLowerCase() === 'negociação'
  );
  if (!neg || lead.status === neg.name || lead.status === 'Venda' || lead.status === 'Perda') return none;
  return {
    toStatus: neg.name,
    promotedFrom: {
      status: lead.status ?? null,
      statusEnteredAt: lead.statusEnteredAt ?? null,
      funnelId: lead.funnelId ?? null,
      toStatus: neg.name,
    },
  };
}

// Etapa para onde a correção devolve o lead, ou null. Só devolve quando o lead
// continua onde o Compareceu o deixou: mesma etapa e mesmo funil. Se alguém o
// moveu depois, a escolha dessa pessoa vale mais que a correção.
export function stageToRevert(lead) {
  const from = lead?.appointmentPromotedFrom;
  if (!from || typeof from.status !== 'string' || !from.status) return null;
  if (!from.toStatus || lead.status !== from.toStatus) return null;
  if ((lead.funnelId ?? null) !== (from.funnelId ?? null)) return null;
  return from;
}

// O que tirar do lead ao trocar para Não compareceu ou ao desfazer a marca.
// `patch` vai junto da gravação e `revertedTo` é a etapa devolvida, ou null.
// O próximo contato volta ao horário do agendamento quando o desfeito é um
// Compareceu de quem não é cliente e ninguém agendou outro contato depois,
// porque o Compareceu o tinha limpado.
export function planAttendedUndo({ lead, fromOutcome, isClient = false }) {
  const patch = { appointmentPromotedFrom: null };
  const from = isClient ? null : stageToRevert(lead);
  if (from) {
    patch.status = from.status;
    if (from.statusEnteredAt) patch.statusEnteredAt = from.statusEnteredAt;
  }
  if (fromOutcome === 'attended' && !isClient && !lead?.nextFollowUp && lead?.appointmentScheduledFor) {
    patch.nextFollowUp = lead.appointmentScheduledFor;
  }
  return { patch, revertedTo: from ? from.status : null };
}

// Desfecho que o balão de correção pode trocar: Compareceu ou Não compareceu
// registrado hoje, com o agendamento do lead ainda hoje. Depois de remarcar ou
// de cancelar não sobra o que corrigir.
export function correctableOutcome(lead, now) {
  const outcome = lead?.appointmentOutcome;
  if (outcome !== 'attended' && outcome !== 'no_show') return null;
  if (!sameLocalDay(getSafeDateOrNull(lead.appointmentOutcomeAt), now)) return null;
  if (!sameLocalDay(getLeadAppointmentDate(lead), now)) return null;
  return outcome;
}

export const correctionText = ({ outcome, sourceLabel, categoryLabel }) => {
  const meta = getAppointmentOutcomeMeta(outcome);
  return `↩️ Desfecho corrigido: ${meta.icon} ${meta.label} · ${sourceLabel} (${categoryLabel})`;
};

export const revertStageText = (status) => `Fase voltou para [${status}] após correção do desfecho.`;
