// Helpers do histórico de aulas experimentais (coleção stronix_aulas). Puros
// aqui; a escrita no Firestore fica em aulasWrites.js.
import { getSafeDateOrNull } from './dates.js';

export const AULA_STATUS = { AGENDADA: 'agendada', ATTENDED: 'attended', NO_SHOW: 'no_show', CANCELLED: 'cancelled' };

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
  const attended = (aulas || []).filter((a) => a && a.status === AULA_STATUS.ATTENDED);
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
} = {}) {
  return {
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
