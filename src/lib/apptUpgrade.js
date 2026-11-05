// Aulas e Visitas: o compromisso de quem já era cliente na hora dele é de
// upgrade, não de matrícula. Mesma régua do CRM (appointmentRowsOf, em
// crm/appointments.js): data do compromisso a partir da primeira matrícula.

import { firstEnrolledAtOf } from './crm/cohort.js';
import { saleMomentOf } from './contractHistory.js';
import { isImportedContract, neverTookEffect } from './contracts.js';
import { getLeadAppointmentDate } from './leads.js';

// Cliente sem data de matrícula (legado) não tem como ser julgado e segue como
// matrícula, que é o que a tela sempre disse.
export function isUpgradeAppointment(lead) {
  const at = getLeadAppointmentDate(lead);
  const since = firstEnrolledAtOf(lead);
  return Boolean(at && since && at >= since);
}

// O upgrade fechou: a pessoa tem contrato vendido depois do horário do
// compromisso. Cancelado depois de valer continua sendo venda feita, como no
// Gerencial. O que nunca valeu (renovação desfeita) e o importado ficam fora.
export function upgradeClosed(lead, contracts) {
  const at = getLeadAppointmentDate(lead);
  if (!at) return false;
  return (contracts || []).some((c) => {
    if (c?.leadId !== lead?.id || neverTookEffect(c) || isImportedContract(c)) return false;
    const sold = saleMomentOf(c);
    return Boolean(sold && sold >= at);
  });
}
