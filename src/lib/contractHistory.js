// Leitura do histórico de contratos de UMA pessoa, para a aba Contratos da
// ficha. Puro: recebe os docs do lead como chegam do Firestore (Timestamp ou
// Date) e não grava nada.
//
// A origem de cada contrato segue a mesma ordem do Gerencial (saleTypeOf, em
// gerencial/scope.js): renovação, upgrade, retorno e primeira matrícula.
// Renovação é só o contrato ligado ao anterior (renewedFromId). Contrato sem
// ligação é retorno, inclusive o paralelo, como no Gerencial. O
// contractHistory.test.js compara as duas regras.

import { CONTRACT_STATUS } from './contracts.js';
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

// Contrato cancelado antes de começar: nunca valeu, então não cobriu ninguém.
const neverStarted = (c) => {
  const s = getSafeDateOrNull(c?.startsAt);
  const x = getSafeDateOrNull(c?.cancelledAt);
  return Boolean(s && x && x.getTime() <= s.getTime());
};

// Até quando a pessoa teve contrato antes deste: o fim efetivo mais distante
// entre os anteriores que chegaram a valer. Com contrato paralelo, o mais
// recente pela venda nem sempre é o que cobria a pessoa.
function coverageEndOf(list) {
  let best = null;
  list.forEach((o) => {
    if (neverStarted(o)) return;
    const end = contractEndOf(o);
    if (end && (!best || end.getTime() > best.getTime())) best = end;
  });
  return best;
}

// De onde veio o contrato: { kind, previous, ordinal, gapDays }.
// previous: o contrato ligado (renovação) ou o anterior mais recente pela data
// da venda (retorno e upgrade). gapDays: dias do calendário sem contrato entre
// o fim da cobertura anterior (o fim efetivo mais distante entre o contrato
// ligado e os vendidos antes, só dos que chegaram a valer) e o início deste, ou
// null quando não houve intervalo.
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

  let kind;
  let previous;
  if (contract?.renewedFromId) {
    kind = CONTRACT_ORIGIN.RENOVACAO;
    previous = byId.get(contract.renewedFromId) || null;
  } else {
    previous = earlier[0] || null;
    kind = contract?.closedFromUpgrade
      ? CONTRACT_ORIGIN.UPGRADE
      : previous ? CONTRACT_ORIGIN.RETORNO : CONTRACT_ORIGIN.PRIMEIRA;
  }

  // Intervalo sem contrato: do fim da cobertura anterior (o contrato ligado e
  // todos os vendidos antes) até o início deste, em dias do calendário. Emendar
  // (início no dia seguinte ao fim) é zero dia sem contrato.
  const coverageEnd = coverageEndOf(previous ? [previous, ...earlier] : earlier);
  const start = getSafeDateOrNull(contract?.startsAt);
  const diff = coverageEnd && start ? calendarDaysBetween(coverageEnd, start) : null;
  const gapDays = diff != null && diff > 1 ? diff - 1 : null;

  return {
    kind,
    previous,
    ordinal: kind === CONTRACT_ORIGIN.RENOVACAO ? renewalOrdinalOf(contract, byId) : 0,
    gapDays
  };
}
