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
//   renewalRescheduleAt: Timestamp|Date|null — data do próximo contato reagendado.
//   renewalDeclined: boolean — "não renova neste ciclo".

import { getSafeDateOrNull, fromDateInputValue } from './dates.js';
import { CONTRACT_STATUS } from './contracts.js';

// Default da academia (Regras gerais → Renovação de contrato → marcos).
export const DEFAULT_RENEWAL_CHECKPOINTS = [90, 60, 30];

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
//   3. renewalRescheduleAt no futuro → suprimido até a data; no passado/hoje
//      → entra (é a tarefa reagendada, devida). Não passa pelo checkpoint.
//   4. Sem reagendamento pendente: entra se existir um marco ATIVO (ver
//      activeRenewalCheckpoint) e ele ainda não estiver em
//      renewalHandledCheckpoints.
export function shouldPromptRenewal(lead, now, checkpoints) {
  if (!lead) return false;
  if (lead.renewalDeclined) return false;
  if (lead.currentContractStatus === CONTRACT_STATUS.CANCELADO) return false;

  const ref = getSafeDateOrNull(now) || new Date();

  const rescheduleAt = getSafeDateOrNull(lead.renewalRescheduleAt);
  if (rescheduleAt) {
    return rescheduleAt.getTime() <= ref.getTime();
  }

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

// Patch do desfecho "Reagendar": só move a data do próximo contato. NÃO
// adiciona o marco a renewalHandledCheckpoints — é o MESMO marco adiado, não
// um marco tratado (a tarefa some até a data e reaparece exatamente nela).
// Aceita Date ou string 'yyyy-mm-dd' (formato de <input type="date">).
//
// Nota: "Renovou" não tem builder aqui — fecha o RenewalOutcomeModal e abre
// o MatriculaModal (mode='renovacao') existente, que já reseta os 3 campos
// de renovação ao gravar o novo contrato (buildMatriculaWrites).
export function renewalReschedule(dateStr) {
  const date = dateStr instanceof Date ? dateStr : fromDateInputValue(dateStr);
  return { renewalRescheduleAt: date };
}
