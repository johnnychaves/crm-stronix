// AGENDA DO DIA — todas as visitas e aulas experimentais marcadas para HOJE na
// academia, de qualquer consultor, para o painel compartilhado da Meta Diária.
//
// SUBSTITUI a presença cruzada por turno, que só delegava quando o dono do lead
// tinha turno cadastrado E estava fora dele no horário. Na prática isso deixava
// de fora o que o gestor marca (gestor não tem turno), o lead sem dono e o
// agendamento feito em cliente. Aqui não existe regra de horário: quem abre a
// Meta vê o dia inteiro e pode registrar presença de qualquer linha.
//
// Nada disto conta na meta de quem confirma. O crédito vai para o DONO do lead,
// via writeAppointmentOutcome (src/lib/appointmentOutcome.js).

import {
  DAILY_GOAL_CATEGORIES,
  getLeadAppointmentDate,
  getLeadAppointmentType,
  isClientLead,
} from './leads.js';

// Mesmo dia em horário LOCAL (nunca UTC — o dia tem que bater com o fuso de quem
// está na recepção).
const isSameLocalDay = (a, b) =>
  a instanceof Date && b instanceof Date &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

// `usersById` aceita Map ou objeto simples. Quem monta o índice deve indexar
// pelo id do doc do usuário E pelo authUid, porque appointmentOutcomeBy grava
// authUid (ver src/lib/appointmentOutcome.js) e consultantId grava o id do doc.
const lookupUser = (usersById, key) => {
  if (!key) return null;
  return (usersById instanceof Map ? usersById.get(key) : (usersById || {})[key]) || null;
};

export function computeDayAgenda({
  liveLeads,
  agendaLeads,
  usersById,
  viewerId,
  now = new Date(),
}) {
  // União por id. A fonte VIVA vence: é a mesma coleção, mas chega por snapshot
  // e reflete a última escrita antes da consulta.
  const byId = new Map();
  (agendaLeads || []).forEach((l) => { if (l?.id) byId.set(l.id, l); });
  (liveLeads || []).forEach((l) => { if (l?.id) byId.set(l.id, l); });

  const rows = [];
  byId.forEach((lead) => {
    if (lead.status === 'Perda') return;

    const type = getLeadAppointmentType(lead);
    if (type !== 'visita' && type !== 'aula_experimental') return;

    const scheduledAt = getLeadAppointmentDate(lead);
    if (!isSameLocalDay(scheduledAt, now)) return;

    const owner = lookupUser(usersById, lead.consultantId);

    // O desfecho SÓ vale se foi registrado hoje. Comparecimento preserva o
    // agendamento e o wizard não limpa appointmentOutcome ao remarcar, então sem
    // esta trava um lead que veio semana passada e tem aula nova hoje apareceria
    // já resolvido e ninguém confirmaria a presença dele.
    const outcome = isSameLocalDay(lead.appointmentOutcomeAt, now)
      ? (lead.appointmentOutcome || null)
      : null;
    const outcomeBy = outcome ? lookupUser(usersById, lead.appointmentOutcomeBy) : null;

    rows.push({
      ...lead,
      scheduledAt,
      categorySlug: type === 'visita'
        ? DAILY_GOAL_CATEGORIES.VISITA_HOJE
        : DAILY_GOAL_CATEGORIES.AULA_HOJE,
      ownerName: owner?.name || lead.consultantName || 'sem consultor',
      isMine: Boolean(viewerId) && lead.consultantId === viewerId,
      // Mesmo critério do resto do app (isClientLead): pega também quem foi
      // matriculado por etapa customizada do funil ("Matriculado", "Convertido"),
      // não só o status literal 'Venda'. É o que decide se a linha é upsell de
      // aluno — e o que impede a escrita de mexer no funil dele.
      isClient: isClientLead(lead),
      outcome,
      outcomeByName: outcomeBy?.name || null,
    });
  });

  rows.sort((a, b) => a.scheduledAt - b.scheduledAt);

  const pending = rows.filter((r) => !r.outcome).length;
  const nextIndex = rows.findIndex((r) => r.scheduledAt >= now);

  return { rows, pending, nextIndex };
}
