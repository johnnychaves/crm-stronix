// Leitura do histórico de contratos de UMA pessoa, para a aba Contratos da
// ficha. Puro: recebe os docs do lead como chegam do Firestore (Timestamp ou
// Date) e não grava nada.
//
// A origem de cada contrato segue a mesma ordem do Gerencial (saleTypeOf, em
// gerencial/scope.js): renovação, upgrade, retorno e primeira matrícula.
// Renovação é só o contrato ligado ao anterior (renewedFromId). Contrato sem
// ligação é retorno, inclusive o paralelo, como no Gerencial. O
// contractHistory.test.js compara as duas regras.

import { CONTRACT_STATUS, deriveContractStatus, neverTookEffect, pauseSuccessorStartOf } from './contracts.js';
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

// O contrato que veio depois deste de verdade, de onde sai a linha de intervalo
// acima dele no Histórico: o mais próximo com início depois do dele (início
// mais recente primeiro, empate na ordem da lista), entre o contrato atual e os
// que chegaram a valer. O vizinho de cima da lista pode ser uma renovação
// desfeita, que começaria depois do atual. Ela continua na lista, mas não é
// sucessora de ninguém, e ela mesma não tem sucessor: nunca valeu, então não
// houve intervalo depois dela. O atual entra sempre, como na célula de origem
// do card. Null quando nenhum contrato veio depois.
export function historySuccessorOf(contract, leadContracts, currentContractId) {
  if (!contract || neverTookEffect(contract)) return null;
  const startOf = (c) => getSafeDateOrNull(c.startsAt)?.getTime() || 0;
  const list = (Array.isArray(leadContracts) ? leadContracts.filter(Boolean) : [])
    .sort((x, y) => startOf(y) - startOf(x));
  const at = list.findIndex((c) => c.id === contract.id);
  for (let i = at - 1; i >= 0; i -= 1) {
    if (list[i].id === currentContractId || !neverTookEffect(list[i])) return list[i];
  }
  return null;
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
// ele nunca está em uso nem renovado. O trancado segue "Trancado" até a
// renovação ligada começar, e "Renovado" depois: a mesma leitura do
// Operacional, que encerra a pausa no início do sucessor (closeOpenPause).
export function historyStatusOf(contract, leadContracts, now = new Date(), thresholdDays) {
  const base = deriveContractStatus(contract, now, thresholdDays) || CONTRACT_STATUS.VENCIDO;
  if (base === CONTRACT_STATUS.CANCELADO || base === CONTRACT_STATUS.AGENDADO) return base;
  const ref = getSafeDateOrNull(now) || new Date();
  const list = Array.isArray(leadContracts) ? leadContracts : [];
  const renewals = list.filter((o) => o?.renewedFromId && o.renewedFromId === contract?.id && !neverTookEffect(o));
  const renewalStarted = renewals.some((r) => {
    const s = getSafeDateOrNull(r.startsAt);
    return Boolean(s && s.getTime() <= ref.getTime());
  });
  if (base === CONTRACT_STATUS.TRANCADO) return renewalStarted ? HISTORY_STATUS.RENOVADO : base;
  const start = getSafeDateOrNull(contract?.startsAt);
  if (start && start.getTime() > ref.getTime()) return CONTRACT_STATUS.AGENDADO;
  if (!renewals.length) return base;
  const end = contractEndOf(contract);
  const ended = Boolean(end && calendarDaysBetween(ref, end) < 0);
  return renewalStarted || ended ? HISTORY_STATUS.RENOVADO : HISTORY_STATUS.EM_USO;
}

// O contrato está em uso em `now`: já começou (importado sem início vale pela
// criação), não foi cancelado e ainda vale, com o fim efetivo hoje ou depois
// por dia do calendário, ou está trancado, que congela o fim, enquanto nenhum
// sucessor começou (pauseSuccessorStartOf, a regra do Operacional). O trancado
// que a renovação ou outro contrato da pessoa já alcançou voltou a correr
// junto com ele e vive no Histórico, nunca no destaque (decisão do Johnny,
// 30/09/2026). `leadContracts` são os contratos da pessoa, para achar esse
// sucessor. É a regra do destaque da aba Contratos (contractsTab.js) e do
// contrato em uso da renovação (runningPredecessorOf).
export function isInUseAt(contract, now = new Date(), leadContracts = []) {
  if (!contract || contract.status === CONTRACT_STATUS.CANCELADO) return false;
  const ref = getSafeDateOrNull(now) || new Date();
  const start = getSafeDateOrNull(contract.startsAt) || getSafeDateOrNull(contract.createdAt);
  if (start && start.getTime() > ref.getTime()) return false;
  if (contract.status === CONTRACT_STATUS.TRANCADO) {
    // A pausa aberta começa no trancamento; sem a data (legado), no início.
    const successor = pauseSuccessorStartOf(contract, getSafeDateOrNull(contract.pausedAt) || start, leadContracts);
    return !(successor && successor.getTime() <= ref.getTime());
  }
  const end = contractEndOf(contract);
  return Boolean(end && calendarDaysBetween(ref, end) >= 0);
}

// O contrato que esta renovação continua, enquanto ele está em uso
// (isInUseAt). Null quando ela já começou, ou sem o contrato ligado na lista.
export function runningPredecessorOf(contract, leadContracts, now = new Date()) {
  if (!contract?.renewedFromId) return null;
  const ref = getSafeDateOrNull(now) || new Date();
  const start = getSafeDateOrNull(contract.startsAt);
  if (start && start.getTime() <= ref.getTime()) return null;
  const list = Array.isArray(leadContracts) ? leadContracts : [];
  const prev = list.find((c) => c?.id === contract.renewedFromId);
  return prev && isInUseAt(prev, ref, list) ? prev : null;
}

// A linha da faixa do card quando o contrato atual ainda não começou e o
// anterior está em uso. A emendada continua o contrato em uso; a agendada diz
// qual contrato vale agora e quantos dias ficam sem contrato. Contrato
// importado pode vir sem nome de plano, e aí a frase sai sem ele (antes dizia
// "Contrato em uso: Plano, até ...").
export function inUseNoteOf({ planName, end, seamless, gapDays = 0 } = {}) {
  const fim = getSafeDateOrNull(end);
  if (!fim) return null;
  const ate = `até ${fim.toLocaleDateString('pt-BR')}`;
  const plano = String(planName || '').trim();
  if (seamless) return `Continua o contrato em uso (${plano ? `${plano}, ` : ''}${ate})`;
  const intervalo = gapDays > 0 ? ` · ${gapDays} ${gapDays === 1 ? 'dia' : 'dias'} sem contrato entre os dois` : '';
  return `Contrato em uso${plano ? `: ${plano},` : ''} ${ate}${intervalo}`;
}
