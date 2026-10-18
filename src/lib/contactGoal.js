// Regra pura do desfecho da tarefa CONTATO (categoria "Contato Hoje" da Meta
// Diária). Espelha o comportamento do fluxo atual do DailyGoalView
// (commitNextContact / commitNoNextContact), agora embrulhado pelo
// ContactOutcomeModal:
//   • "Contato feito"  = tarefa concluída SEM próximo contato → limpa o
//     nextFollowUp (senão o lead volta como Atrasado amanhã) e o dono do
//     contato — é o caminho "Sem próximo contato" de hoje.
//   • "Reagendar"      = agenda o próximo toque (nextFollowUp futuro),
//     preservando o CANAL (Ligação/Mensagem) do lead — é o caminho "Escolher
//     data" de hoje, que conta como reaquecimento (volumeKind).

import { fromDateInputValue } from './dates.js';
import { isAppointmentEcho } from './outcomeCorrection.js';

// Canal do follow-up derivado do lead (mesma leitura de commitNextContact):
// Ligação se o nextFollowUpType atual contém "liga", senão Mensagem. Retorna
// o rótulo (nextFollowUpType) e o volumeKind correspondente (prospecção).
export function followUpChannelOf(lead) {
  const isLigacao = String(lead?.nextFollowUpType || '').toLowerCase().includes('liga');
  return isLigacao
    ? { type: 'Ligação', volumeKind: 'ligacao' }
    : { type: 'Mensagem', volumeKind: 'mensagem' };
}

// Patch do desfecho "Contato feito": conclui sem próximo contato agendado.
// Limpa nextFollowUp/tipo para a tarefa não reabrir como Atrasado no dia
// seguinte, e o dono do contato (nextFollowUpOwnerId/Name), com null
// explícito: o contato acabou, e o próximo contato que nascer por um caminho
// que não escolhe dono (o "Próximo contato?" depois do Compareceu, o Adiar e o
// Reagendar da Renovação gravam só a data e o tipo) fica com o dono do lead, e
// não com quem recebeu este. Quem agenda pela ficha escolhe o dono no passo
// "Quem vai fazer esse contato?". A marca de feito guarda quem tinha o contato
// (goalOwnerId) antes de o patch limpar o dono. Não toca status/funil.
// newLeadHandledAt guarda que a Meta já tratou o lead: é o que tira o lead novo
// sem próximo contato de Atrasados (newLeadDueOf, em dailyGoal.js), já que o
// patch limpa o próximo contato e a marca do dia pode não estar carregada
// depois. Só essa regra lê o campo, e ele não é a data do último contato.
export function contactDone(at = new Date()) {
  return { nextFollowUp: null, nextFollowUpType: null, nextFollowUpOwnerId: null, nextFollowUpOwnerName: null, newLeadHandledAt: at };
}

// Patch do desfecho "Reagendar": agenda o próximo contato na data escolhida,
// preservando o canal do lead. Não toca status/funil. Aceita Date ou string
// 'yyyy-mm-dd' (formato de <input type="date">). Leva o MESMO contato para
// outro dia, então não menciona o dono do contato: ele continua com quem tem a
// tarefa, inclusive o colega que o recebeu. A exceção é o eco de um agendamento
// (isAppointmentEcho): o contato que nasce dele é novo e fica com o dono do
// lead, com null explícito. Isso também acerta o lead antigo que ficou com o
// dono de um contato delegado por baixo do eco.
//
// NÃO ENCOSTA no compromisso formal (visita/aula). Até 18/08/2026 este patch
// zerava appointmentType/appointmentScheduledFor "para não conflitar com a
// categoria de Contato" — e com isso apagava a aula que o lead tinha marcada.
// O conflito foi resolvido na origem: a categoria "Contato Hoje" passou a
// comparar a DATA do compromisso em vez do tipo (ver dailyGoal.js). Contato e
// compromisso são coisas separadas e cada um mexe só no que é seu.
export function contactReschedule(lead, dateStr) {
  const date = dateStr instanceof Date ? dateStr : fromDateInputValue(dateStr);
  const { type } = followUpChannelOf(lead);
  const patch = { nextFollowUp: date, nextFollowUpType: type };
  if (isAppointmentEcho(lead)) Object.assign(patch, { nextFollowUpOwnerId: null, nextFollowUpOwnerName: null });
  return patch;
}
