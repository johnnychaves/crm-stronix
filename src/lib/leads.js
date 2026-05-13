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
