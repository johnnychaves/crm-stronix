// A carteira num instante: quantos contratos estão de pé e quanto valem por
// mês. Soma contrato e não pessoa, porque contrato paralelo é permitido.

import { contractStateAt } from '../operacional/base.js';
import { hasValue, monthlyTicket } from './scope.js';

export function walletAt(contracts, t) {
  const inside = [];
  (contracts || []).forEach((c) => {
    const state = contractStateAt(c, t);
    if (state) inside.push({ c, state });
  });
  const withValue = inside.filter(({ c }) => hasValue(c));
  const monthly = withValue.reduce((s, { c }) => s + monthlyTicket(c), 0);
  const locked = inside.filter(({ state }) => state === 'trancado');
  const people = new Map();
  inside.forEach(({ c }) => people.set(c.personKey, (people.get(c.personKey) || 0) + 1));
  return {
    count: inside.length,
    monthly,
    // Contrato sem valor não pode entrar no denominador (§8 do handoff).
    ticket: withValue.length ? monthly / withValue.length : 0,
    lockedCount: locked.length,
    lockedMonthly: locked.filter(({ c }) => hasValue(c)).reduce((s, { c }) => s + monthlyTicket(c), 0),
    blind: inside.length - withValue.length,
    overlap: [...people.values()].filter((n) => n > 1).length
  };
}
