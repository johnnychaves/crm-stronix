// Regra pura do desfecho da tarefa CONTATO (categoria "Contato Hoje" da Meta
// Diária). Espelha o comportamento do fluxo atual do DailyGoalView
// (commitNextContact / commitNoNextContact), agora embrulhado pelo
// ContactOutcomeModal:
//   • "Contato feito"  = tarefa concluída SEM próximo contato → limpa o
//     nextFollowUp (senão o lead volta como Atrasado amanhã) — é o caminho
//     "Sem próximo contato" de hoje.
//   • "Reagendar"      = agenda o próximo toque (nextFollowUp futuro),
//     preservando o CANAL (Ligação/Mensagem) do lead — é o caminho "Escolher
//     data" de hoje, que conta como reaquecimento (volumeKind).

import { fromDateInputValue } from './dates.js';

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
// seguinte. Não toca status/funil.
export function contactDone() {
  return { nextFollowUp: null, nextFollowUpType: null };
}

// Patch do desfecho "Reagendar": agenda o próximo contato na data escolhida,
// preservando o canal do lead. Limpa qualquer agendamento FORMAL antigo
// (visita/aula) para não conflitar com getLeadAppointmentType/a categoria de
// Contato, e zera o desfecho de agendamento anterior — igual ao fluxo
// 'complete' do commitNextContact. Não toca status/funil. Aceita Date ou
// string 'yyyy-mm-dd' (formato de <input type="date">).
export function contactReschedule(lead, dateStr) {
  const date = dateStr instanceof Date ? dateStr : fromDateInputValue(dateStr);
  const { type } = followUpChannelOf(lead);
  return {
    nextFollowUp: date,
    nextFollowUpType: type,
    appointmentScheduledFor: null,
    appointmentType: null,
    appointmentOutcome: null,
    appointmentOutcomeAt: null,
    appointmentOutcomeBy: null
  };
}
