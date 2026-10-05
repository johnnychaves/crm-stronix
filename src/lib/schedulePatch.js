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
//
// Puro e só com import de módulo puro: a api/ também usa este arquivo (o
// agendamento pelo Stronizap, api/_zapSchedule.js).

import { normalizeAppointmentType } from './dates.js';
import { isMetaParticipant } from './acesso.js';

// Quem fica com a TAREFA do dia de uma visita ou aula experimental que alguém
// agenda (decisão do dono, em 05/10/2026). Quem agenda no lead de outro
// consultor e participa da Meta Diária (isMetaParticipant: é consultor) fica
// com a tarefa, e a função devolve { id, name } dessa pessoa. O dono do lead,
// o gestor e o professor deixam a tarefa com o dono do lead, como sempre, e a
// função devolve null. Quem está desligado (active: false) não tem Meta, então
// também deixa com o dono. Lead sem dono fica com o consultor que agendou.
//
// Os dois caminhos que agendam usam esta função: o assistente da ficha
// (handleWizardConfirm, com quem está logado) e o agendamento pelo Stronizap
// (buildScheduleWrites, com o actor da ponte). O resultado vai para o
// buildSchedulePatch (appointmentOwnerId e appointmentOwnerName).
export function appointmentTaskOwnerFor({ scheduler = null, lead = null } = {}) {
  if (!scheduler?.id || scheduler.active === false || !isMetaParticipant(scheduler)) return null;
  if (scheduler.id === (lead?.consultantId || null)) return null;
  return { id: scheduler.id, name: scheduler.name || null };
}

// O aviso de que a tarefa ficou com outra pessoa, no fim do texto da interação
// do agendamento (" · tarefa de Ana"). É como o dono do lead fica sabendo, pela
// linha do tempo, que outra pessoa vai cuidar do contato ou do compromisso.
export const taskOwnerText = (name) => ` · tarefa de ${name || 'outro consultor'}`;

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
  appointmentOwnerId = null,
  appointmentOwnerName = null,
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
    // Dono da TAREFA de contato na Meta Diária, escolhido no passo
    // "Responsável" do assistente. Ausente significa o dono do lead, e o null é
    // EXPLÍCITO de propósito: agendamento novo não pode herdar o delegado do
    // agendamento anterior. A visita e a aula têm o próprio dono de tarefa
    // (appointmentOwnerId, abaixo), e o contato não mexe nele.
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
    // Dono da TAREFA da visita ou da aula na Meta Diária
    // (appointmentTaskOwnerFor, acima). Ausente significa o dono do lead, e o
    // null é EXPLÍCITO pelo mesmo motivo do contato: o agendamento novo que
    // fica com o dono do lead não herda quem recebeu a tarefa do anterior.
    appointmentOwnerId: appointmentOwnerId || null,
    appointmentOwnerName: appointmentOwnerId ? (appointmentOwnerName || null) : null,
  };
}
