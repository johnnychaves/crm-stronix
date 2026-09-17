// O que sai da carteira: o que vence nos próximos 90 dias, o que já venceu sem
// sucessor e o que saiu neste mês.

import { contractStateAt, indexContracts } from '../operacional/base.js';
import { hasValue, monthlyTicket, inWindow } from './scope.js';

const DAY = 24 * 60 * 60 * 1000;
export const HORIZON_DAYS = [30, 60, 90];

// Sucessor: a renovação ligada ou outro contrato da pessoa que começa depois
// deste. Mesma ideia de src/lib/operacional/renewal.js, simplificada porque
// aqui só importa existir ou não.
function hasSuccessor(c, index) {
  if ((index.byRenewedFrom.get(c.id) || []).length) return true;
  return (index.byPerson.get(c.personKey) || []).some((o) => o !== c && o.startsAt && c.startsAt && o.startsAt > c.startsAt);
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


export function expiredWithoutSuccessor(contracts, t) {
  const index = indexContracts(contracts || []);
  const rows = (contracts || []).filter((c) => (
    c.endsAt && c.endsAt <= t && !c.cancelledAt && !hasSuccessor(c, index)
  ));
  return { count: rows.length, v: rows.filter(hasValue).reduce((s, c) => s + monthlyTicket(c), 0) };
}

export function exitsInWindow(contracts, { start, end }) {
  const cancels = [];
  const locks = [];
  (contracts || []).forEach((c) => {
    if (c.cancelledAt && !c.cancelFromImport && inWindow(c.cancelledAt, start, end)) cancels.push(c);
    if ((c.pauses || []).some((p) => !p.fromImport && inWindow(p.from, start, end))) locks.push(c);
  });
  const money = (list) => list.filter(hasValue).reduce((s, c) => s + monthlyTicket(c), 0);
  const items = [
    { kind: 'cancelamento', label: 'Cancelamentos', count: cancels.length, v: money(cancels) },
    { kind: 'trancamento', label: 'Trancamentos', count: locks.length, v: money(locks) }
  ];
  return { items, total: items.reduce((s, i) => s + i.v, 0) };
}
