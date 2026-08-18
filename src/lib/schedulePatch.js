// Patch do lead ao confirmar um agendamento no ScheduleWizard.
//
// Existe como função pura por um motivo específico: este trecho vivia solto
// dentro do JSX da LeadProfileView, sem teste possível, e foi ali que nasceu o
// bug de 18/08/2026 — agendar uma mensagem de confirmação gravava
// `appointmentType: null` e apagava a aula que o lead tinha marcada (a escrita
// é set(merge:true), então null sobrescreve).
//
// A REGRA, em uma frase: mensagem e ligação mexem SÓ no próximo contato;
// visita e aula mexem no próximo contato E no compromisso.

import { normalizeAppointmentType } from './dates.js';

export function buildSchedulePatch({
  typeLabel,
  date,
  modalidade = null,
  professorId = null,
  professorName = null,
  soloTraining = false,
  quantidade = null,
  unidade = null,
  note = null,
  currentAulaId = null,
  contactOwnerId = null,
  contactOwnerName = null,
} = {}) {
  const appointmentType = normalizeAppointmentType(typeLabel); // 'visita' | 'aula_experimental' | null
  const isAula = appointmentType === 'aula_experimental';
  const isVisita = appointmentType === 'visita';

  const patch = {
    nextFollowUp: date,
    nextFollowUpType: typeLabel,
    // Observação do agendamento, exibida no card da Meta Diária.
    nextFollowUpNote: note || null,
  };

  // Mensagem/ligação param aqui: nenhum campo de compromisso é mencionado, e o
  // que o patch não menciona sobrevive ao merge.
  if (!appointmentType) {
    // Dono da TAREFA na Meta Diária. Ausente significa o dono do lead, e o null
    // é EXPLÍCITO de propósito: agendamento novo não pode herdar o delegado do
    // agendamento anterior. Só contato tem dono de tarefa — visita e aula
    // seguem o dono do lead.
    patch.nextFollowUpOwnerId = contactOwnerId || null;
    patch.nextFollowUpOwnerName = contactOwnerId ? (contactOwnerName || null) : null;
    return patch;
  }

  // Os extras do tipo antigo são limpos de propósito: trocar uma aula por uma
  // visita não pode deixar professor e modalidade para trás.
  return {
    ...patch,
    appointmentModality: isAula ? (modalidade || null) : null,
    appointmentProfessorId: isAula ? (professorId || null) : null,
    appointmentProfessorName: isAula ? (professorName || null) : null,
    appointmentSoloTraining: isAula ? Boolean(soloTraining) : false,
    trialClassesPlanned: isAula ? (quantidade || null) : null,
    appointmentUnit: isVisita ? (unidade || null) : null,
    appointmentType,
    appointmentScheduledFor: date,
    // Compromisso NOVO nasce sem desfecho. Sem isto, o "não veio" do
    // agendamento anterior ficava colado no lead e a tela de Aulas/Visitas
    // mostrava o compromisso novo como já resolvido antes da data chegar.
    appointmentOutcome: null,
    appointmentOutcomeAt: null,
    appointmentOutcomeBy: null,
    currentAulaId,
  };
}
