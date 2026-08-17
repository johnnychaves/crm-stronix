// Regra pura do funil VENCIDOS da Meta Diária: o CLIENTE cujo contrato venceu e
// que ainda não renovou. Complementa src/lib/renewalGoal.js — lá é a cobrança
// ANTES do vencimento (marcos 90/60/30, uma vez por marco), aqui é a cobrança
// DEPOIS, todo dia programado, enquanto durar o período configurado.
//
// Corte limpo: a partir do dia do vencimento o cliente sai de Renovações e
// entra aqui. Ninguém aparece nos dois.
//
// Ver spec: docs/superpowers/specs/2026-08-17-funil-vencidos-design.md
//
// Campos do lead que a regra lê (todos já existem):
//   currentContractEndsAt / currentContractStatus / currentContractStartsAt
//   renewalDeclined — "não vai renovar/voltar" (reseta em buildMatriculaWrites)
//   nextFollowUp — contato marcado; enquanto for hoje ou futuro, o cliente é
//     cobrado na categoria Contatos, não aqui (evita tarefa dobrada).

import { getSafeDateOrNull, daysBetween } from './dates.js';
import { deriveLeadContractStatus, CONTRACT_STATUS } from './contracts.js';
import {
  daysToExpiryOf,
  normalizeRenewalGraceDays,
  DEFAULT_RENEWAL_GRACE_DAYS
} from './renewalGoal.js';

// O período do funil é o MESMO campo que a academia já configurava como
// "tolerância depois do vencimento" (renewalGraceDays em stronix_config). Só o
// dono mudou: agora ele governa este funil. Trocar o nome exigiria migração.
export const DEFAULT_EXPIRED_WINDOW_DAYS = DEFAULT_RENEWAL_GRACE_DAYS;
export const normalizeExpiredWindowDays = normalizeRenewalGraceDays;

// `now` deve ser um horário REAL, não a meia-noite do dia: a vigência termina à
// meia-noite do dia gravado em endsAt, então às 00:00 desse dia o contrato já
// está vencido (é o que deriveContractStatus enxerga, e é o que a ficha mostra
// como INATIVO). Passar meia-noite aqui empataria a comparação e atrasaria a
// entrada do cliente em um dia.
export function shouldPromptExpired(lead, now, windowDays = DEFAULT_EXPIRED_WINDOW_DAYS) {
  if (!lead) return false;
  if (lead.lifecycleStage !== 'cliente') return false;
  if (lead.renewalDeclined) return false;

  const ref = getSafeDateOrNull(now) || new Date();

  // Fonte única do "venceu" — a mesma que pinta INATIVO na ficha. De graça
  // exclui cancelado, trancado, agendado, ativo, a vencer e o legado sem
  // vigência gravada (que devolve null).
  if (deriveLeadContractStatus(lead, ref) !== CONTRACT_STATUS.VENCIDO) return false;

  const daysToExpiry = daysToExpiryOf(lead.currentContractEndsAt, ref);
  if (!Number.isFinite(daysToExpiry)) return false;
  if (daysToExpiry < -normalizeExpiredWindowDays(windowDays)) return false;

  // Contato marcado para hoje ou para frente: a cobrança de hoje é da categoria
  // Contatos. Contato que já passou sem desfecho volta a ser cobrado aqui.
  const todayStart = new Date(ref);
  todayStart.setHours(0, 0, 0, 0);
  const nextFollowUp = getSafeDateOrNull(lead.nextFollowUp);
  if (nextFollowUp && nextFollowUp >= todayStart) return false;

  return true;
}

// Rótulo da pílula do card e do selo do popup. Conta por DIA de calendário com
// daysBetween (que arredonda o pulo de 1h do horário de verão).
export function expiredLabel(lead, now = new Date()) {
  const endsAt = getSafeDateOrNull(lead?.currentContractEndsAt);
  if (!endsAt) return null;
  const ref = getSafeDateOrNull(now) || new Date();
  const endDay = new Date(endsAt);
  endDay.setHours(0, 0, 0, 0);
  const today = new Date(ref);
  today.setHours(0, 0, 0, 0);
  const days = daysBetween(endDay, today);
  if (!Number.isFinite(days) || days <= 0) return 'Venceu hoje';
  return `Venceu há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

// Chave de ordenação da lista: o vencimento mais recente primeiro (ordenar
// DESC por esta chave). É o inverso dos Atrasados, de propósito — a chance de
// reativação cai a cada dia fora. Sem vigência gravada vai para o fim.
export const expiredSortKey = (lead) => {
  const d = getSafeDateOrNull(lead?.currentContractEndsAt);
  return d ? d.getTime() : 0;
};
