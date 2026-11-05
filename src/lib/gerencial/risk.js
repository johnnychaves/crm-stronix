// O que sai da carteira: o que vence nos próximos 90 dias, o que já venceu sem
// sucessor e o que saiu neste mês.

import { neverTookEffect } from '../contracts.js';
import { contractStateAt, hasOpenPause, indexContracts } from '../operacional/base.js';
import { hasValue, monthlyTicket, inWindow } from './scope.js';

const DAY = 24 * 60 * 60 * 1000;
export const HORIZON_DAYS = [30, 60, 90];

// Sucessor: a renovação ligada ou outro contrato da pessoa que começa depois
// deste. Mesma ideia de src/lib/operacional/renewal.js, simplificada porque
// aqui só importa existir ou não. O que nunca valeu (neverTookEffect) não é
// sucessor: a renovação desfeita devolve o contrato renovado ao risco.
function hasSuccessor(c, index) {
  if ((index.byRenewedFrom.get(c.id) || []).some((o) => !neverTookEffect(o))) return true;
  return (index.byPerson.get(c.personKey) || []).some((o) => o !== c && !neverTookEffect(o) && o.startsAt && c.startsAt && o.startsAt > c.startsAt);
}

// Só contrato vigente vence. Trancado não: o fim dele anda quando reativar.
export function expiryHorizons(contracts, t) {
  const edges = HORIZON_DAYS.map((d) => new Date(t.getTime() + d * DAY));
  const rows = HORIZON_DAYS.map((days) => ({ days, label: `Em ${days} dias`, count: 0, v: 0, blind: 0 }));
  const index = indexContracts(contracts || []);
  (contracts || []).forEach((c) => {
    if (contractStateAt(c, t) !== 'vigente' || !c.endsAt) return;
    // Quem já tem sucessor não vai sair da carteira: renovação assinada antes
    // do fim tira o contrato do risco, senão o cartão cobraria um contato que
    // já foi feito.
    if (hasSuccessor(c, index)) return;
    const i = edges.findIndex((edge) => c.endsAt < edge);
    if (i < 0) return;
    if (hasValue(c)) {
      rows[i].count += 1;
      rows[i].v += monthlyTicket(c);
    } else {
      rows[i].blind += 1;
    }
  });
  return rows;
}


// Trancado não vence: o fim anda na reativação, e ele segue na carteira
// (walletAt). Sem a trava, o trancado com o fim antigo vencido contava nos dois.
// Vencido é quem passou da tolerância (graceDays, a renewalGraceDays da
// academia), a mesma regra do "venceu sem renovar" do Operacional e do churn:
// dentro dela a pessoa ainda pode renovar. Só os que passaram dela nos últimos
// LAPSED_DAYS dias, o mesmo horizonte do "vence em 90 dias".
export const LAPSED_DAYS = HORIZON_DAYS[HORIZON_DAYS.length - 1];
export function expiredWithoutSuccessor(contracts, t, { graceDays = 0 } = {}) {
  const index = indexContracts(contracts || []);
  const graceMs = (Number(graceDays) || 0) * DAY;
  const from = t.getTime() - LAPSED_DAYS * DAY;
  const rows = (contracts || []).filter((c) => {
    if (!c.endsAt || c.cancelledAt || hasOpenPause(c) || hasSuccessor(c, index)) return false;
    const out = c.endsAt.getTime() + graceMs;
    return out <= t.getTime() && out > from;
  });
  return { count: rows.length, v: rows.filter(hasValue).reduce((s, c) => s + monthlyTicket(c), 0) };
}

export function exitsInWindow(contracts, { start, end }) {
  const cancels = [];
  const locks = [];
  (contracts || []).forEach((c) => {
    // O que nunca valeu não esteve na carteira, então não sai dela: nem o
    // cancelamento nem o trancamento dele contam.
    if (neverTookEffect(c)) return;
    const cancelled = c.cancelledAt && !c.cancelFromImport && !c.cancelUndated && inWindow(c.cancelledAt, start, end);
    if (cancelled) cancels.push(c);
    // Trancado e cancelado no mesmo mês saiu pelo cancelamento: contar nos
    // dois somava o contrato duas vezes no total do cartão.
    else if ((c.pauses || []).some((p) => !p.fromImport && inWindow(p.from, start, end))) locks.push(c);
  });
  const money = (list) => list.filter(hasValue).reduce((s, c) => s + monthlyTicket(c), 0);
  const items = [
    { kind: 'cancelamento', label: 'Cancelamentos', count: cancels.length, v: money(cancels) },
    { kind: 'trancamento', label: 'Trancamentos', count: locks.length, v: money(locks) }
  ];
  return { items, total: items.reduce((s, i) => s + i.v, 0) };
}
