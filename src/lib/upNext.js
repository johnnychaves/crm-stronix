// O que vem a seguir na ficha, lido dos campos do lead, que são a fonte de
// verdade da Meta Diária. Não vem das interações: a lista de interações guarda
// também os agendamentos que já foram trocados por outro.
//
// No máximo dois itens: o compromisso (visita ou aula experimental, enquanto
// não tem desfecho) e o próximo contato (mensagem ou ligação). Mensagem e
// ligação mexem só no próximo contato (buildSchedulePatch), então os dois
// podem existir ao mesmo tempo. Puro: só importa módulo puro.
//
// O tipo e a data do compromisso saem de getLeadAppointmentType e
// getLeadAppointmentDate, a leitura que a Meta Diária e a Agenda de hoje usam:
// lead antigo, que só tem o tipo de contato "Visita" ou "Aula Experimental",
// continua aparecendo. Lead perdido não tem a seguir (a Meta e a Agenda também
// o ignoram). O cliente mostra o compromisso só de hoje em diante, como a Agenda
// de hoje (src/lib/dayAgenda.js), que mostra a aula marcada para aluno: a visita
// vencida de quando ele ainda era lead ficou sem desfecho e não é mais tarefa.
import { getSafeDateOrNull, normalizeAppointmentType } from './dates.js';
import { getLeadAppointmentDate, getLeadAppointmentType, isClientLead } from './leads.js';

const join = (parts) => parts.filter(Boolean).join(' · ');
const taskOf = (name) => (name ? `Tarefa de ${name}` : '');
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function appointmentItem(lead, type, when, now) {
  const isAula = type === 'aula_experimental';
  // A anotação do agendamento mora em nextFollowUpNote, mas um contato marcado
  // depois a sobrescreve. Só vale enquanto o próximo contato ainda é o compromisso.
  const note = normalizeAppointmentType(lead.nextFollowUpType) ? lead.nextFollowUpNote : '';
  const quantity = Number(lead.trialClassesPlanned) || 0;
  const aula = [
    lead.appointmentModality,
    lead.appointmentProfessorName || (lead.appointmentSoloTraining ? 'Treina sozinho' : ''),
    quantity ? `${quantity} ${quantity === 1 ? 'aula' : 'aulas'}` : ''
  ];
  const visita = [lead.appointmentUnit ? `Unidade ${lead.appointmentUnit}` : ''];
  return {
    id: 'appointment',
    type,
    kind: isAula ? 'class' : 'visit',
    title: isAula ? 'Aula experimental' : 'Visita',
    detail: join([...(isAula ? aula : visita), taskOf(lead.appointmentOwnerName), note]),
    when,
    overdue: when.getTime() < now.getTime(),
    canOutcome: true
  };
}

function contactItem(lead, when, now) {
  const call = /liga/i.test(String(lead.nextFollowUpType || ''));
  return {
    id: 'contact',
    type: call ? 'ligacao' : 'mensagem',
    kind: call ? 'call' : 'msg',
    title: call ? 'Ligação' : 'Mensagem',
    detail: join([taskOf(lead.nextFollowUpOwnerName), lead.nextFollowUpNote]),
    when,
    overdue: when.getTime() < now.getTime(),
    canOutcome: false
  };
}

export function upNextOf(lead, now = new Date()) {
  if (!lead || lead.status === 'Perda') return [];
  const items = [];

  const type = getLeadAppointmentType(lead);
  const apptType = type === 'visita' || type === 'aula_experimental' ? type : null;
  const apptWhen = getLeadAppointmentDate(lead);
  // Com desfecho marcado (compareceu, não veio), o compromisso já aconteceu: a
  // ficha continua com os campos, mas ele deixa de ser "a seguir".
  const stale = isClientLead(lead) && apptWhen && apptWhen < startOfDay(now);
  if (apptType && apptWhen && !lead.appointmentOutcome && !stale) {
    items.push(appointmentItem(lead, apptType, apptWhen, now));
  }

  const nextWhen = getSafeDateOrNull(lead.nextFollowUp);
  // Quando o próximo contato é a visita ou a aula, ele já entrou acima.
  if (nextWhen && !normalizeAppointmentType(lead.nextFollowUpType)) items.push(contactItem(lead, nextWhen, now));

  return items.sort((a, b) => a.when.getTime() - b.when.getTime());
}
