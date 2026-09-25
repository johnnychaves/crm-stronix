// Monta o cartão de contexto que o Stronizap exibe. A lista de campos é
// FECHADA de propósito: nada entra por espalhamento do documento do lead, pra
// não vazar CPF, endereço, valor de contrato ou situação de pagamento numa
// tela de chat. O cartão do responsável (`buildGuardianCard`) é o único que
// leva um dado de outra pessoa: o nome de quem responde pelo menor, digitado
// no cadastro do menor.
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

const createdMs = (lead) => getSafeDateOrNull(lead?.createdAt)?.getTime() ?? 0;
const byName = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR');

// Menor dentro de `wards`: o cartão de sempre, sem `found` (quem está no
// cartão é o responsável) e com o parentesco de quem responde por ele.
export function buildZapWard(lead, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS) {
  const card = buildZapCard(lead, now, checkpoints);
  delete card.found;
  card.relationship = lead.guardian?.relationship ?? null;
  return card;
}

export function buildZapWards(minors, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS) {
  return minors.map((m) => buildZapWard(m, now, checkpoints)).sort(byName);
}

// Quem escreveu não tem cadastro próprio, mas responde por menores. O nome é o
// que foi digitado no menor cadastrado por último: irmãos podem ter o nome da
// mãe escrito de jeitos diferentes, e vale o mais recente.
export function buildGuardianCard(minors, now = new Date(), checkpoints = DEFAULT_RENEWAL_CHECKPOINTS) {
  const maisRecente = [...minors].sort((a, b) => createdMs(b) - createdMs(a))[0];
  return {
    found: true,
    kind: 'responsavel',
    name: maisRecente?.guardian?.name ?? null,
    wards: buildZapWards(minors, now, checkpoints),
  };
}
