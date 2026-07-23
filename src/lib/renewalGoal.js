// Regra pura da RENOVAÇÃO por marcos (checkpoints) configuráveis — a
// categoria RENOVACAO da Meta Diária. Substitui o antigo gatilho de
// threshold único (deriveLeadContractStatus === 'a_vencer') como condição de
// ENTRADA na Meta: o cliente aparece UMA vez em cada marco (ex.: 90/60/30
// dias antes de vencer), não todo dia.
//
// O status "A vencer" do SISTEMA (badge/anel em ClientsView, ficha, etc.)
// continua no `contractThresholdDays` (deriveLeadContractStatus, em
// contracts.js) — separado dos marcos daqui, não muda.
//
// Ver spec: docs/superpowers/specs/2026-07-23-meta-renovacao-checkpoints-design.md
//
// Campos do lead (resetam quando um novo contrato é criado — buildMatriculaWrites):
//   renewalHandledCheckpoints: number[] — marcos já tratados no ciclo atual.
//   renewalDeclined: boolean — "não renova neste ciclo".

import { getSafeDateOrNull, fromDateInputValue } from './dates.js';
import { CONTRACT_STATUS } from './contracts.js';

// Default da academia (Regras gerais → Renovação de contrato → marcos).
export const DEFAULT_RENEWAL_CHECKPOINTS = [90, 60, 30];

// Tipo de follow-up gravado ao REAGENDAR um contato de renovação. O contato
// passa a viver na categoria Contatos da Meta Diária (dirigida por
// nextFollowUp), como um follow-up comum. 'Mensagem' é o canal-padrão que o
// app usa pra follow-up simples (mesmo default de commitNextContact em
// DailyGoalView) — normaliza pra categoria Contato (não vira visita/aula).
export const RENEWAL_RESCHEDULE_FOLLOWUP_TYPE = 'Mensagem';

const DAY_MS = 24 * 60 * 60 * 1000;

// Dias até o vencimento do contrato vigente (pode ser negativo se já venceu).
// null quando não há vigência gravada (currentContractEndsAt ausente/inválido).
export function daysToExpiryOf(endsAt, now = new Date()) {
  const end = getSafeDateOrNull(endsAt);
  if (!end) return null;
  const ref = getSafeDateOrNull(now) || new Date();
  return Math.ceil((end.getTime() - ref.getTime()) / DAY_MS);
}

// Marco ATIVO = o menor marco configurado que ainda cobre o prazo restante:
// min{ C ∈ checkpoints : C >= daysToExpiry }. null quando daysToExpiry não é
// finito, quando não há marcos válidos (>0), ou quando o prazo restante é
// maior que o MAIOR marco (o cliente ainda não entrou na janela de nenhum).
export function activeRenewalCheckpoint(daysToExpiry, checkpoints) {
  if (!Number.isFinite(daysToExpiry)) return null;
  const valid = (Array.isArray(checkpoints) ? checkpoints : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const candidates = valid.filter((c) => c >= daysToExpiry);
  if (!candidates.length) return null;
  return Math.min(...candidates);
}

// Decide se o CLIENTE entra na categoria Renovação da Meta Diária hoje.
//   1. renewalDeclined → nunca mais entra neste ciclo (reseta só numa nova
//      matrícula/renovação — buildMatriculaWrites).
//   2. Contrato cancelado (currentContractStatus === 'cancelado') → mesmo
//      efeito do declined: nada a renovar. Guarda extra (não estava no texto
//      literal da spec) para o cliente não voltar pedindo renovação de um
//      contrato que o próprio consultor já cancelou pela ficha.
//   3. Entra se existir um marco ATIVO (ver activeRenewalCheckpoint) e ele
//      ainda não estiver em renewalHandledCheckpoints.
// Reagendar NÃO é mais tratado aqui: reagendar marca o marco atual como
// tratado (handled) e joga o contato pra categoria Contatos (via nextFollowUp)
// — ver renewalReschedule. Assim o cliente sai de Renovações no marco atual e
// só volta no PRÓXIMO marco (que ainda não está em handled).
export function shouldPromptRenewal(lead, now, checkpoints) {
  if (!lead) return false;
  if (lead.renewalDeclined) return false;
  if (lead.currentContractStatus === CONTRACT_STATUS.CANCELADO) return false;

  const ref = getSafeDateOrNull(now) || new Date();

  const daysToExpiry = daysToExpiryOf(lead.currentContractEndsAt, ref);
  const activeCheckpoint = activeRenewalCheckpoint(daysToExpiry, checkpoints);
  if (activeCheckpoint == null) return false;

  const handled = Array.isArray(lead.renewalHandledCheckpoints) ? lead.renewalHandledCheckpoints : [];
  return !handled.includes(activeCheckpoint);
}

// Patch do desfecho "Não vai renovar": marca o ciclo como declinado e some o
// marco atual dos próximos marcos (idempotente — não duplica se já estiver
// lá). NÃO mexe em status/lifecycleStage: perda de venda != perda de funil.
export function renewalDecline(lead, activeCheckpoint) {
  const handled = Array.isArray(lead?.renewalHandledCheckpoints) ? lead.renewalHandledCheckpoints : [];
  const next = (activeCheckpoint != null && !handled.includes(activeCheckpoint))
    ? [...handled, activeCheckpoint]
    : handled;
  return {
    renewalDeclined: true,
    renewalHandledCheckpoints: next
  };
}

// Patch do desfecho "Reagendar": o contato deixa de ser tarefa de Renovação e
// vira um follow-up comum na categoria Contatos, na data escolhida. Grava:
//   • nextFollowUp = data escolhida (dirige a categoria Contatos da Meta) +
//     nextFollowUpType genérico de contato (Mensagem).
//   • renewalHandledCheckpoints += activeCheckpoint (idempotente) → o MARCO
//     atual conta como RESOLVIDO, some de Renovações. Volta a Renovações só no
//     PRÓXIMO marco (ex.: 90 → 60), que ainda não está em handled.
// NÃO toca status/lifecycleStage: continua cliente (perda de venda != funil).
// Aceita Date ou string 'yyyy-mm-dd' (formato de <input type="date">).
//
// Nota: "Renovou" não tem builder aqui — fecha o RenewalOutcomeModal e abre
// o MatriculaModal (mode='renovacao') existente, que já reseta os campos
// de renovação ao gravar o novo contrato (buildMatriculaWrites).
export function renewalReschedule(lead, dateStr, activeCheckpoint, followUpType = RENEWAL_RESCHEDULE_FOLLOWUP_TYPE) {
  const date = dateStr instanceof Date ? dateStr : fromDateInputValue(dateStr);
  const handled = Array.isArray(lead?.renewalHandledCheckpoints) ? lead.renewalHandledCheckpoints : [];
  const next = (activeCheckpoint != null && !handled.includes(activeCheckpoint))
    ? [...handled, activeCheckpoint]
    : handled;
  return {
    nextFollowUp: date,
    nextFollowUpType: followUpType,
    renewalHandledCheckpoints: next
  };
}
