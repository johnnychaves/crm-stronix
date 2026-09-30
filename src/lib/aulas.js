// Helpers do histórico de aulas experimentais (coleção stronix_aulas). Puros
// aqui; a escrita no Firestore fica em aulasWrites.js.
import { getSafeDateOrNull } from './dates.js';

export const AULA_STATUS = { AGENDADA: 'agendada', ATTENDED: 'attended', NO_SHOW: 'no_show', CANCELLED: 'cancelled' };

// Tipo do registro de agendamento. `stronix_aulas` guardava só aulas; desde a
// separação entre agendamento e próximo contato ela guarda visitas também.
// AUSENTE SIGNIFICA 'aula': todo documento anterior à mudança continua valendo
// sem ser tocado. Por isso o filtro é sempre client-side (isAulaRecord) e nunca
// um where('type','==','aula'), que no Firestore EXCLUI doc sem o campo — uma
// query dessas antes do backfill sumiria com todo o histórico de aulas.
export const APPOINTMENT_RECORD_TYPES = { AULA: 'aula', VISITA: 'visita' };

export const isAulaRecord = (rec) =>
  (rec?.type ?? APPOINTMENT_RECORD_TYPES.AULA) !== APPOINTMENT_RECORD_TYPES.VISITA;

// Desfecho do agendamento (appointmentOutcome) -> status da aula. 'rescheduled'
// não resolve a aula (o reagendamento move a aula, não a fecha).
export function outcomeToAulaStatus(outcome) {
  if (outcome === 'attended') return AULA_STATUS.ATTENDED;
  if (outcome === 'no_show') return AULA_STATUS.NO_SHOW;
  if (outcome === 'cancelled') return AULA_STATUS.CANCELLED;
  return null;
}

// Tipo do agendamento do lead ('visita' | 'aula_experimental') -> tipo do
// registro em stronix_aulas. Outro valor não tem registro.
const recordTypeOf = (appointmentType) => {
  if (appointmentType === 'visita') return APPOINTMENT_RECORD_TYPES.VISITA;
  if (appointmentType === 'aula_experimental') return APPOINTMENT_RECORD_TYPES.AULA;
  return null;
};

// O que o Remarcar da Meta Diária faz em stronix_aulas para o registro seguir
// o agendamento do lead, como o assistente da ficha já faz. Até 2026-09-29 só
// a aula acompanhava, e a visita remarcada ficava com a data velha no
// registro: o Dashboard CRM a contava no dia antigo e perdia o comparecimento.
//   close: o registro em aberto do tipo anterior a fechar, ou null.
//     - depois do "Não veio", fecha como falta: o desfecho da visita não é
//       gravado no registro, e mover o registro apagaria a falta do painel;
//     - na troca de tipo, fecha como cancelado: aquele agendamento não
//       acontece mais.
//   upsertVisita: a visita do tipo novo move o registro aberto ou cria um.
//     A aula continua com o upsertScheduledAula de sempre.
export function rescheduleRecordPlan({ previousType, finalType, afterNoShow }) {
  const previous = recordTypeOf(previousType);
  let close = null;
  if (previous && afterNoShow) close = { type: previous, status: AULA_STATUS.NO_SHOW };
  else if (previous && previousType !== finalType) close = { type: previous, status: AULA_STATUS.CANCELLED };
  return { close, upsertVisita: finalType === 'visita' };
}

// A aula que leva o crédito da conversão: a atendida de maior scheduledFor.
// null se nenhuma foi atendida.
export function pickConvertingAula(aulas) {
  // isAulaRecord: visita mora na mesma coleção desde a separação de agendamentos
  // e NÃO pode levar o crédito da conversão nem carimbar carteira de professor.
  const attended = (aulas || []).filter((a) => a && isAulaRecord(a) && a.status === AULA_STATUS.ATTENDED);
  if (!attended.length) return null;
  return attended.reduce((best, a) => {
    const ad = getSafeDateOrNull(a.scheduledFor);
    const bd = getSafeDateOrNull(best.scheduledFor);
    if (!ad) return best;
    if (!bd) return a;
    return ad > bd ? a : best;
  });
}

// Espelho do lead: qual dos registros de agendamento representa o compromisso
// "atual" do lead. O documento do lead guarda uma cópia desses campos
// (appointmentType, appointmentScheduledFor...) porque as telas e os relatórios
// leem o lead, não a coleção — mas quem manda são os registros, e o espelho é
// SEMPRE derivado daqui. É isso que torna o espelho reconstruível: escrita
// errada não apaga compromisso para sempre, basta recalcular.
//
// Três regras, nesta ordem:
//   1. Em aberto de hoje em diante → o MAIS PRÓXIMO (o próximo compromisso).
//   2. Só em aberto atrasado → o MAIS RECENTE (o que espera desfecho). Sem
//      isto, uma visita esquecida de três semanas atrás seguraria o espelho e
//      esconderia a aula marcada para amanhã.
//   3. Nada em aberto → o último resolvido como 'attended' ou 'no_show'.
//      CANCELADO nunca entra: comparecimento preserva o compromisso na tela de
//      Aulas/Visitas e cancelamento remove (regra do Johnny, ver o comentário
//      em appointmentOutcome.js).
//
// Registro sem data é ignorado: não dá para posicionar no tempo, e virar
// espelho sem data quebraria as telas que fazem range por data.
export function pickMirrorAppointment(records, now = new Date()) {
  const dated = (records || [])
    .map((r) => ({ rec: r, at: getSafeDateOrNull(r?.scheduledFor) }))
    .filter((x) => x.rec && x.at);
  if (!dated.length) return null;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const open = dated.filter((x) => x.rec.status === AULA_STATUS.AGENDADA);

  // 1. Próximo compromisso de hoje em diante.
  const upcoming = open.filter((x) => x.at.getTime() >= todayStart);
  if (upcoming.length) {
    return upcoming.reduce((best, x) => (x.at < best.at ? x : best)).rec;
  }

  // 2. Atrasado em aberto mais recente.
  if (open.length) {
    return open.reduce((best, x) => (x.at > best.at ? x : best)).rec;
  }

  // 3. Último desfecho que mantém a pessoa na tela.
  const resolved = dated.filter(
    (x) => x.rec.status === AULA_STATUS.ATTENDED || x.rec.status === AULA_STATUS.NO_SHOW
  );
  if (!resolved.length) return null;
  return resolved.reduce((best, x) => (x.at > best.at ? x : best)).rec;
}

// Monta os campos de um registro de aula. Puro: recebe valores já resolvidos,
// devolve objeto plano (o caller adiciona createdAt/serverTimestamp e grava).
export function aulaRecordFields({
  leadId, leadName = null, professorId = null, professorName = null, soloTraining = false,
  modality = null, scheduledFor = null, status = AULA_STATUS.AGENDADA, outcomeAt = null,
  converted = false, convertedAt = null,
  consultantId = null, consultantAuthUid = null, consultantName = null,
  type = APPOINTMENT_RECORD_TYPES.AULA, unit = null,
} = {}) {
  return {
    // Qualquer valor fora de 'visita' vira 'aula': registro nasce aula por
    // padrão e tipo desconhecido não pode criar uma terceira categoria muda.
    type: type === APPOINTMENT_RECORD_TYPES.VISITA
      ? APPOINTMENT_RECORD_TYPES.VISITA
      : APPOINTMENT_RECORD_TYPES.AULA,
    unit: unit || null,
    leadId: leadId || null,
    leadName: leadName || null,
    professorId: professorId || null,
    professorName: professorName || null,
    soloTraining: Boolean(soloTraining),
    modality: modality || null,
    scheduledFor: scheduledFor || null,
    status: status || AULA_STATUS.AGENDADA,
    outcomeAt: outcomeAt || null,
    converted: Boolean(converted),
    convertedAt: convertedAt || null,
    consultantId: consultantId || null,
    consultantAuthUid: consultantAuthUid || null,
    consultantName: consultantName || null,
  };
}
