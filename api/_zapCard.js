// Monta o cartão de contexto que o Stronizap exibe. A lista de campos é
// FECHADA de propósito: nada entra por espalhamento do documento do lead, pra
// não vazar CPF, endereço, valor de contrato ou situação de pagamento numa
// tela de chat.
import { deriveLeadContractStatus } from '../src/lib/contracts.js';
import { getLeadAppointmentType, getLeadAppointmentDate } from '../src/lib/leads.js';
import { getSafeDateOrNull } from '../src/lib/dates.js';
import { buildZapStrip } from './_zapStrip.js';

const DAY_MS = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const iso = (d) => (d ? d.toISOString() : null);

export function buildZapCard(lead, now = new Date()) {
  if (!lead) return { found: false };

  const eCliente = lead.lifecycleStage === 'cliente';
  const fim = getSafeDateOrNull(lead.currentContractEndsAt);
  const tipo = getLeadAppointmentType(lead);
  const quando = getLeadAppointmentDate(lead);

  const card = {
    found: true,
    leadId: lead.id ?? null,
    kind: eCliente ? 'cliente' : 'lead',
    name: lead.name ?? null,
    consultantName: lead.consultantName ?? null,
    lastInteractionAt: iso(getSafeDateOrNull(lead.lastInteractionAt)),
    appointment: tipo && quando ? { type: tipo, at: iso(quando) } : null,
    strip: buildZapStrip(lead, now)
  };

  if (eCliente) {
    card.planName = lead.currentPlanName ?? null;
    card.contractStatus = deriveLeadContractStatus(lead, now);
    card.contractEndsAt = iso(fim);
    card.daysLeft = fim
      ? Math.round((startOfDay(fim).getTime() - startOfDay(now).getTime()) / DAY_MS)
      : null;
  } else {
    card.stage = lead.status ?? null;
    card.source = lead.source ?? null;
  }

  return card;
}
