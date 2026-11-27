// O patch que faz o agendamento do lead apontar para um registro de
// stronix_aulas (aula ou visita), sem anotação. É a gravação da regra do
// leadSlotFor (visitante.js): a ficha, a Meta (Remarcar e Cancelou), o avanço
// do dia e a ponte do Stronizap usam esta função.
//
// Pura e só com import de módulo puro: a api/ também usa este arquivo.
import { calendarDaysBetween, getSafeDateOrNull } from './dates.js';
import { isAppointmentEcho } from './outcomeCorrection.js';
import { buildSchedulePatch } from './schedulePatch.js';

// As chaves do próximo contato que o buildSchedulePatch grava com o eco.
export const NEXT_CONTACT_KEYS = Object.freeze(['nextFollowUp', 'nextFollowUpType', 'nextFollowUpNote', 'nextFollowUpOwnerId', 'nextFollowUpOwnerName']);

// `lead` é o lead como fica depois da gravação de quem chama (o patch dela já
// aplicado): é dele que sai o contato que fica e, na visita, o currentAulaId.
// `taskOwner`: ausente (undefined) deixa o dono da tarefa como está; { id, name }
// ou null grava o dono, como no Agendar (appointmentTaskOwnerFor).
// Um contato de verdade (não o eco do agendamento) de hoje em diante fica.
export function slotPatchFor({ lead, record, taskOwner, now = new Date() }) {
  const isVisita = record?.type === 'visita';
  const { appointmentOwnerId, appointmentOwnerName, ...patch } = buildSchedulePatch({
    typeLabel: isVisita ? 'Visita' : 'Aula Experimental',
    date: getSafeDateOrNull(record.scheduledFor),
    modalidade: record.modality || null,
    professorId: record.professorId || null,
    professorName: record.professorName || null,
    soloTraining: Boolean(record.soloTraining),
    unidade: isVisita ? record.unit || null : null,
    currentAulaId: isVisita ? lead?.currentAulaId ?? null : record.id,
    appointmentOwnerId: taskOwner?.id || null,
    appointmentOwnerName: taskOwner?.name || null,
  });
  if (taskOwner !== undefined) Object.assign(patch, { appointmentOwnerId, appointmentOwnerName });
  const contact = getSafeDateOrNull(lead?.nextFollowUp);
  if (contact && !isAppointmentEcho(lead) && calendarDaysBetween(now, contact) >= 0) {
    for (const k of NEXT_CONTACT_KEYS) delete patch[k];
  }
  return patch;
}
