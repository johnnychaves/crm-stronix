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
