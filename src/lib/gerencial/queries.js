// Ids de lead das vendas fechadas nos meses abertos na tela, para buscar a
// origem por id. Espelha leadIdsForRenewal (src/lib/operacional/queries.js),
// mas sem a folga de dias: a venda entra pela data do fechamento, dentro do
// próprio intervalo dos meses, sem olhar vencimento nem prazo de renovação.

import { monthRange } from '../operacional/month.js';
import { saleMoment } from './scope.js';

export function leadIdsForSales(contracts, { monthKeys, known = new Set() }) {
  if (!monthKeys?.length) return [];
  const sorted = [...monthKeys].sort();
  const from = monthRange(sorted[0]).start.getTime();
  const to = monthRange(sorted[sorted.length - 1]).end.getTime();
  const ids = new Set();
  (contracts || []).forEach((c) => {
    if (c.imported || !c.leadId || known.has(c.leadId)) return;
    const t = saleMoment(c);
    if (t && t.getTime() >= from && t.getTime() < to) ids.add(c.leadId);
  });
  return [...ids];
}
