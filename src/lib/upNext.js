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
// o ignoram).
//
// O que passou segue a Meta, que é quem cobra. O compromisso de um dia que já
// passou só continua enquanto é o eco do próximo contato (isAppointmentEcho):
// é por ele que a Meta põe o lead em Atrasados. Concluído pelo "Contato feito"
// ou trocado por outro contato, ele sai. Com desfecho marcado ("Não veio"), o
// eco que ficou é o contato atrasado. O cliente não entra em Atrasados, então
// mostra o compromisso e o contato só de hoje em diante, como a Agenda de hoje
// (src/lib/dayAgenda.js), que mostra a aula marcada para aluno, e o Contato
// hoje da Meta. No Vencidos a Meta cobra o cliente, e não a ligação que passou.
//
// O "Tarefa de X" diz quem tem a tarefa na Meta. O que venceu antes de hoje é
// Atrasado, e o Atrasado é do dono do lead, mesmo com o contato delegado ou a
// visita agendada por outra pessoa: aí o "Tarefa de" sai.
//
// Ele mostra o que está marcado, e não tudo que a Meta cobra: o lead novo sem
// próximo passo, que a Meta põe em Atrasados, não tem nada marcado.
import { getSafeDateOrNull, normalizeAppointmentType } from './dates.js';
import { getLeadAppointmentDate, getLeadAppointmentType, isClientLead } from './leads.js';
import { isAppointmentEcho } from './outcomeCorrection.js';

const join = (parts) => parts.filter(Boolean).join(' · ');
const taskOf = (name, when, today) => (name && when >= today ? `Tarefa de ${name}` : '');
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function appointmentItem(lead, type, when, now, today) {
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
    detail: join([...(isAula ? aula : visita), taskOf(lead.appointmentOwnerName, when, today), note]),
    when,
    overdue: when.getTime() < now.getTime(),
    canOutcome: true
  };
}

function contactItem(lead, when, now, today, detail = join([taskOf(lead.nextFollowUpOwnerName, when, today), lead.nextFollowUpNote])) {
  const call = /liga/i.test(String(lead.nextFollowUpType || ''));
  return {
    id: 'contact',
    type: call ? 'ligacao' : 'mensagem',
    kind: call ? 'call' : 'msg',
    title: call ? 'Ligação' : 'Mensagem',
    detail,
    when,
    overdue: when.getTime() < now.getTime(),
    canOutcome: false
  };
}

export function upNextOf(lead, now = new Date()) {
  if (!lead || lead.status === 'Perda') return [];
  const items = [];

  const today = startOfDay(now);
  // Na Meta, Atrasados é só de lead (isMetaOverdue ignora Venda e Perda).
  const chased = !isClientLead(lead);
  const type = getLeadAppointmentType(lead);
  const apptType = type === 'visita' || type === 'aula_experimental' ? type : null;
  const apptWhen = getLeadAppointmentDate(lead);
  // Com desfecho marcado (compareceu, não veio), o compromisso já aconteceu: a
  // ficha continua com os campos, mas ele deixa de ser "a seguir".
  const live = apptWhen && (apptWhen >= today || (chased && isAppointmentEcho(lead)));
  const showAppt = Boolean(apptType && live && !lead.appointmentOutcome);
  if (showAppt) items.push(appointmentItem(lead, apptType, apptWhen, now, today));

  const nextWhen = getSafeDateOrNull(lead.nextFollowUp);
  if (nextWhen && !normalizeAppointmentType(lead.nextFollowUpType)) {
    if (chased || nextWhen >= today) items.push(contactItem(lead, nextWhen, now, today));
  } else if (nextWhen && !showAppt && chased && nextWhen < today) {
    // O eco que ficou depois do desfecho: a Meta o cobra como Atrasado, do dono
    // do lead. O dono do contato que ficou no lead é de um contato antigo.
    const what = apptType === 'aula_experimental' ? 'aula experimental' : 'visita';
    const outcome = lead.appointmentOutcome === 'no_show' ? `Não veio à ${what}`
      : lead.appointmentOutcome === 'attended' ? `Veio à ${what}` : '';
    items.push(contactItem(lead, nextWhen, now, today, outcome));
  }

  return items.sort((a, b) => a.when.getTime() - b.when.getTime());
}
