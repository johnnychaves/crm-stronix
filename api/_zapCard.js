// Monta o cartão de contexto que o Stronizap exibe. A lista de campos é
// FECHADA de propósito: nada entra por espalhamento do documento do lead, pra
// não vazar CPF, endereço, valor de contrato ou situação de pagamento numa
// tela de chat.
import { deriveLeadContractStatus } from '../src/lib/contracts.js';
import { getLeadAppointmentType, getLeadAppointmentDate } from '../src/lib/leads.js';
import { getSafeDateOrNull } from '../src/lib/dates.js';
import { buildZapStrip } from './_zapStrip.js';
import { DEFAULT_RENEWAL_CHECKPOINTS } from '../src/lib/renewalGoal.js';

const DAY_MS = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const iso = (d) => (d ? d.toISOString() : null);

// `checkpoints` são os marcos de renovação da ACADEMIA (Configurações → Metas
// & ritmo → Marcos de renovação, gravados em stronix_config/general). Quem lê
// o doc e repassa é api/zap.js; aqui só propaga pra buildZapStrip, que já
// cai no padrão 90/60/30 sozinho quando o valor está ausente ou malformado —
// então um caller que não passa nada (ex.: os testes) continua funcionando.
export function buildZapCard(lead, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS) {
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
    strip: buildZapStrip(lead, now, checkpoints)
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
