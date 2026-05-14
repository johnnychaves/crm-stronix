// Lead-centric helpers: appointment introspection, conversion detection,
// permission checks, security field builders. Pure functions — no React,
// no Firestore SDK imports needed at this layer.

import { getSafeDateOrNull, normalizeAppointmentType } from './dates.js';

export const getLeadAppointmentType = (lead) => {
  return lead?.appointmentType || normalizeAppointmentType(lead?.nextFollowUpType);
};

export const getLeadAppointmentDate = (lead) => {
  return (
    getSafeDateOrNull(lead?.appointmentScheduledFor) ||
    (getLeadAppointmentType(lead) ? getSafeDateOrNull(lead?.nextFollowUp) : null)
  );
};

export const isLeadConverted = (lead) => {
  return Boolean(
    lead?.isConverted ||
    lead?.status === 'Venda' ||
    String(lead?.status || '').toLowerCase().includes('convertid') ||
    String(lead?.status || '').toLowerCase().includes('matricul')
  );
};

export const getLeadConversionDate = (lead) => {
  return getSafeDateOrNull(lead?.convertedAt) || getSafeDateOrNull(lead?.createdAt);
};

export const getLeadSatisfactionDate = (lead) => {
  return getSafeDateOrNull(lead?.satisfactionAt);
};

// --- Appointment outcome (comparecimento) ---
// Outcome marca o desfecho de um agendamento de visita/aula experimental:
//   - 'attended'    → o lead compareceu
//   - 'no_show'     → o lead não veio (sem aviso)
//   - 'rescheduled' → o lead pediu para remarcar
//   - 'cancelled'   → o lead desistiu do agendamento
//   - null/undefined → ainda pendente de confirmação
// O outcome NÃO substitui o status do funil. Ele é informação ortogonal:
// um lead pode comparecer e ainda estar em negociação, ou cancelar mas
// virar Venda por outra via.
export const APPOINTMENT_OUTCOMES = ['attended', 'no_show', 'rescheduled', 'cancelled'];

const APPOINTMENT_OUTCOME_META = {
  attended: {
    label: 'Compareceu',
    icon: '✅',
    badgeClass: 'bg-green-500/10 text-green-600 dark:text-green-400'
  },
  no_show: {
    label: 'Não veio',
    icon: '❌',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400'
  },
  rescheduled: {
    label: 'Remarcou',
    icon: '🔄',
    badgeClass: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
  },
  cancelled: {
    label: 'Cancelou',
    icon: '🚫',
    badgeClass: 'bg-gray-500/10 text-gray-600 dark:text-neutral-300'
  }
};

export const getAppointmentOutcomeMeta = (outcome) => APPOINTMENT_OUTCOME_META[outcome] || null;

// isLeadAttended consolida múltiplas fontes para "este lead compareceu?":
//   1) outcome explícito 'attended'
//   2) Venda (matriculou-se → claramente compareceu por algum canal)
//   3) hasAttended legado (campo do trabalho local) para retrocompatibilidade
export const isLeadAttended = (lead) => {
  if (!lead) return false;
  if (lead.appointmentOutcome === 'attended') return true;
  if (isLeadConverted(lead)) return true;
  if (lead.hasAttended === true) return true;
  return false;
};

export const getLeadAttendanceDate = (lead) => {
  return (
    getSafeDateOrNull(lead?.appointmentOutcomeAt) ||
    getSafeDateOrNull(lead?.attendedAt) ||  // legado
    (isLeadConverted(lead) ? getLeadConversionDate(lead) : null)
  );
};

// --- Permissions ---

export const isAdminUser = (user) => user?.role === 'admin';

export const canEditLead = (user, lead) =>
  isAdminUser(user) || (Boolean(lead?.consultantAuthUid) && lead.consultantAuthUid === user?.authUid);

// --- Security fields written alongside leads/interactions ---

export const getLeadOwnershipFields = (user) => ({
  consultantId: user?.id || null,
  consultantName: user?.name || null,
  consultantAuthUid: user?.authUid || null
});

export const getInteractionSecurityFields = (lead, user) => ({
  leadConsultantId: lead?.consultantId || user?.id || null,
  leadConsultantAuthUid: lead?.consultantAuthUid || user?.authUid || null
});
