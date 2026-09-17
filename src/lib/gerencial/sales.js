// A venda do mês: o que foi fechado entre start e end. Nada aqui olha vigência,
// só o instante do fechamento.

import { indexContracts } from '../operacional/base.js';
import { SALE_TYPES, saleMoment, monthlyTicket, saleTypeOf, inWindow } from './scope.js';

const ORDER = [SALE_TYPES.NOVA, SALE_TYPES.RENOVACAO, SALE_TYPES.UPGRADE, SALE_TYPES.RETORNO];

export function soldContracts(contracts, { start, end }) {
  return (contracts || []).filter((c) => !c.imported && inWindow(saleMoment(c), start, end));
}

export function salesOf(contracts, { start, end }) {
  const rows = soldContracts(contracts, { start, end });
  const { byPerson } = indexContracts(contracts || []);
  const sold = rows.reduce((s, c) => s + (Number(c.value) || 0), 0);
  const count = rows.length;
  const list = rows.reduce((s, c) => s + (Number(c.listValue) || Number(c.value) || 0), 0);
  const discAbs = Math.max(0, list - sold);
  const byType = new Map();
  rows.forEach((c) => {
    const type = saleTypeOf(c, byPerson);
    const cur = byType.get(type) || { type, count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(c.value) || 0;
    byType.set(type, cur);
  });
  const claw = rows.filter((c) => c.cancelledAt);
  return {
    rows,
    sold,
    count,
    // Média dos tickets mensais das vendas: um anual e um mensal pesam igual.
    ticket: count ? rows.reduce((s, c) => s + monthlyTicket(c), 0) / count : 0,
    discAbs,
    discPct: list > 0 ? Math.round((discAbs / list) * 100) : 0,
    mix: ORDER.map((type) => byType.get(type)).filter(Boolean).map((m) => ({
      ...m,
      pct: sold > 0 ? (m.value / sold) * 100 : 0
    })),
    clawCount: claw.length,
    clawValue: claw.reduce((s, c) => s + (Number(c.value) || 0), 0)
  };
}
