// Leitura do histórico de contratos de UMA pessoa, para a aba Contratos da
// ficha. Puro: recebe os docs do lead como chegam do Firestore (Timestamp ou
// Date) e não grava nada.
//
// A origem de cada contrato segue a mesma ordem do Gerencial (saleTypeOf, em
// gerencial/scope.js): renovação, upgrade, retorno e primeira matrícula.
// Renovação é só o contrato ligado ao anterior (renewedFromId). Contrato sem
// ligação é retorno, inclusive o paralelo, como no Gerencial. O
// contractHistory.test.js compara as duas regras.

import { CONTRACT_STATUS, deriveContractStatus, neverTookEffect } from './contracts.js';
import { calendarDaysBetween, getSafeDateOrNull } from './dates.js';

export const CONTRACT_ORIGIN = {
  RENOVACAO: 'renovacao',
  UPGRADE: 'upgrade',
  RETORNO: 'retorno',
  PRIMEIRA: 'primeira'
};

// O instante da venda, com a mesma troca do Gerencial (saleMoment): sem
// createdAt, vale o início.
const saleMomentOf = (c) => getSafeDateOrNull(c?.createdAt) || getSafeDateOrNull(c?.startsAt);

// Fim efetivo: a data do cancelamento quando ele veio antes do fim, ou quando o
// contrato foi cancelado ainda trancado (o fim de um trancado não corre, e o
// Operacional encerra esse contrato no cancelamento).
export function contractEndOf(contract) {
  if (!contract) return null;
  const end = getSafeDateOrNull(contract.endsAt);
  const cancelled = getSafeDateOrNull(contract.cancelledAt);
  const cancelledWhilePaused = Boolean(cancelled && contract.status === CONTRACT_STATUS.CANCELADO && getSafeDateOrNull(contract.pausedAt));
  if (cancelled && (cancelledWhilePaused || !end || cancelled.getTime() < end.getTime())) return cancelled;
  return end;
}

// Quantas renovações em sequência levam até este contrato: 1 na primeira
// renovação. Para no contrato sem ligação, então recomeça depois de um
// retorno. O limite protege contra ligação circular num doc corrompido.
function renewalOrdinalOf(contract, byId) {
  let n = 0;
  let cur = contract;
  const seen = new Set();
  while (cur?.renewedFromId && !seen.has(cur.id) && n < 100) {
    seen.add(cur.id);
    n += 1;
    cur = byId.get(cur.renewedFromId);
  }
  return n;
}

// Até quando a pessoa teve contrato antes deste, e qual contrato cobria esse
// fim: o fim efetivo mais distante entre os anteriores que chegaram a valer.
// Com contrato paralelo, o vendido por último nem sempre é o que cobria. O
// cancelado antes de começar (neverTookEffect) nunca valeu, então não cobriu
// ninguém.
function coverageOf(list) {
  let end = null;
  let contract = null;
  list.forEach((o) => {
    if (neverTookEffect(o)) return;
    const e = contractEndOf(o);
    if (e && (!end || e.getTime() > end.getTime())) { end = e; contract = o; }
  });
  return { end, contract };
}

// De onde veio o contrato: { kind, previous, ordinal, gapDays, coverageEnd }.
// previous: o contrato ligado (renovação) ou, no retorno e no upgrade, o
// contrato que cobria a pessoa por último (o de fim efetivo mais distante entre
// os vendidos antes que chegaram a valer), para o plano e a data da célula
// saírem do mesmo contrato; sem nenhum que tenha valido, o vendido por último.
// gapDays: dias do calendário sem contrato entre o fim da cobertura anterior
// (o fim efetivo mais distante entre o contrato ligado e os vendidos antes, só
// dos que chegaram a valer) e o início deste, ou null quando não houve
// intervalo. coverageEnd: o fim da cobertura anterior, de onde o intervalo é
// medido, ou null.
export function contractOriginOf(contract, leadContracts) {
  const list = Array.isArray(leadContracts) ? leadContracts.filter(Boolean) : [];
  const byId = new Map(list.map((c) => [c.id, c]));
  const moment = saleMomentOf(contract);
  const earlier = list
    .filter((o) => o.id !== contract?.id)
    .filter((o) => {
      const m = saleMomentOf(o);
      return Boolean(m && moment && m.getTime() < moment.getTime());
    })
    .sort((x, y) => saleMomentOf(y).getTime() - saleMomentOf(x).getTime());

  // A cobertura anterior: o contrato ligado (só na renovação) e todos os
  // vendidos antes, com o contrato que chegou mais longe.
  const linked = contract?.renewedFromId ? byId.get(contract.renewedFromId) || null : null;
  const coverage = coverageOf(linked ? [linked, ...earlier] : earlier);

  let kind;
  let previous;
  if (contract?.renewedFromId) {
    kind = CONTRACT_ORIGIN.RENOVACAO;
    previous = linked;
  } else {
    // O tipo segue o Gerencial: retorno quando há qualquer venda anterior.
    kind = contract?.closedFromUpgrade
      ? CONTRACT_ORIGIN.UPGRADE
      : earlier.length ? CONTRACT_ORIGIN.RETORNO : CONTRACT_ORIGIN.PRIMEIRA;
    // O contrato que cobria o aluno por último, para o plano e a data da célula
    // saírem do mesmo contrato; sem nenhum que tenha valido, o vendido por último.
    previous = coverage.contract || earlier[0] || null;
  }

  // Intervalo sem contrato: do fim da cobertura anterior até o início deste,
  // em dias do calendário. Emendar (início no dia seguinte ao fim) é zero dia
  // sem contrato.
  const start = getSafeDateOrNull(contract?.startsAt);
  const diff = coverage.end && start ? calendarDaysBetween(coverage.end, start) : null;
  const gapDays = diff != null && diff > 1 ? diff - 1 : null;

  return {
    kind,
    previous,
    ordinal: kind === CONTRACT_ORIGIN.RENOVACAO ? renewalOrdinalOf(contract, byId) : 0,
    gapDays,
    coverageEnd: coverage.end
  };
}

// Selos do Histórico que não são status do contrato: dizem que ele já tem
// renovação ligada.
export const HISTORY_STATUS = { EM_USO: 'em_uso', RENOVADO: 'renovado' };
export const HISTORY_STATUS_LABEL = { em_uso: 'Em uso', renovado: 'Renovado' };

// Status do contrato na lista do Histórico. Com renovação ligada, "Em uso"
// enquanto ele vale e "Renovado" depois do fim dele ou quando a renovação
// começa. Antes, o contrato em uso aparecia "A vencer" com o aluno já
// renovado. A renovação que nunca valeu (neverTookEffect) não conta. O
// contrato que ainda não começou é "Agendado", mesmo o emendado: no Histórico
// ele nunca está em uso nem renovado. O trancado segue "Trancado" mesmo com
// renovação ligada, que só existe em dado antigo: hoje renovar contrato
// trancado é barrado (renewalStartProblem).
export function historyStatusOf(contract, leadContracts, now = new Date(), thresholdDays) {
  const base = deriveContractStatus(contract, now, thresholdDays) || CONTRACT_STATUS.VENCIDO;
  if (base === CONTRACT_STATUS.CANCELADO || base === CONTRACT_STATUS.TRANCADO || base === CONTRACT_STATUS.AGENDADO) return base;
  const ref = getSafeDateOrNull(now) || new Date();
  const start = getSafeDateOrNull(contract?.startsAt);
  if (start && start.getTime() > ref.getTime()) return CONTRACT_STATUS.AGENDADO;
  const list = Array.isArray(leadContracts) ? leadContracts : [];
  const renewals = list.filter((o) => o?.renewedFromId && o.renewedFromId === contract?.id && !neverTookEffect(o));
  if (!renewals.length) return base;
  const renewalStarted = renewals.some((r) => {
    const s = getSafeDateOrNull(r.startsAt);
    return Boolean(s && s.getTime() <= ref.getTime());
  });
  const end = contractEndOf(contract);
  const ended = Boolean(end && calendarDaysBetween(ref, end) < 0);
  return renewalStarted || ended ? HISTORY_STATUS.RENOVADO : HISTORY_STATUS.EM_USO;
}

// O contrato que esta renovação continua, enquanto ele ainda vale: já começou,
// não foi cancelado nem está trancado, e o fim dele não passou. É o que o card
// mostra como "em uso" enquanto a renovação não começa. Null quando ela já
// começou. Contrato parado não está em uso.
export function runningPredecessorOf(contract, leadContracts, now = new Date()) {
  if (!contract?.renewedFromId) return null;
  const list = Array.isArray(leadContracts) ? leadContracts : [];
  const prev = list.find((c) => c?.id === contract.renewedFromId);
  if (!prev || prev.status === CONTRACT_STATUS.CANCELADO || prev.status === CONTRACT_STATUS.TRANCADO) return null;
  const ref = getSafeDateOrNull(now) || new Date();
  const prevStart = getSafeDateOrNull(prev.startsAt);
  if (prevStart && prevStart.getTime() > ref.getTime()) return null;
  const start = getSafeDateOrNull(contract.startsAt);
  if (start && start.getTime() <= ref.getTime()) return null;
  const end = contractEndOf(prev);
  if (!end || calendarDaysBetween(ref, end) < 0) return null;
  return prev;
}
