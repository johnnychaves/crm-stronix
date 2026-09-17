// Quem trouxe a venda do mês: consultor, plano e origem do lead. Sempre sobre
// as vendas do mês (as rows de salesOf), nunca sobre a carteira.

import { monthlyTicket } from './scope.js';

// Ordem padrão dos três rankings: maior valor primeiro e, no empate, o nome
// em ordem alfabética.
function sortByValue(list) {
  return list.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'pt-BR'));
}

function shareOf(value, total) {
  return total > 0 ? (value / total) * 100 : 0;
}

// Agrupador comum de plano e origem: cada linha sai com { id, name, count,
// value, share }. `keyOf` decide o grupo e `nameOf` tira o rótulo do
// contrato que está sendo somado.
function groupBy(rows, keyOf, nameOf, total) {
  const groups = new Map();
  (rows || []).forEach((c) => {
    const id = keyOf(c);
    const g = groups.get(id) || { id, name: nameOf(c), count: 0, value: 0 };
    g.count += 1;
    g.value += Number(c.value) || 0;
    groups.set(id, g);
  });
  return sortByValue([...groups.values()]).map((g) => ({ ...g, share: shareOf(g.value, total) }));
}

// Ranking de consultor. Além das colunas comuns, perSale é o valor dividido
// pelas vendas e monthly é a soma dos tickets mensais das vendas da pessoa
// dividida pelo número de vendas (decisão 3 do plano: nunca duração média).
export function sellersOf(rows, total) {
  const groups = new Map();
  (rows || []).forEach((c) => {
    const id = c.consultantId || 'sem-consultor';
    const g = groups.get(id) || { id, name: c.consultantName || 'Sem consultor', count: 0, value: 0, ticketSum: 0 };
    g.count += 1;
    g.value += Number(c.value) || 0;
    g.ticketSum += monthlyTicket(c);
    groups.set(id, g);
  });
  return sortByValue([...groups.values()]).map((g) => ({
    id: g.id,
    name: g.name,
    count: g.count,
    value: g.value,
    perSale: g.count ? g.value / g.count : 0,
    monthly: g.count ? g.ticketSum / g.count : 0,
    share: shareOf(g.value, total)
  }));
}

// Ranking de plano. O grupo é o planId; sem ele (plano apagado, contrato
// antigo), o nome gravado no contrato segura o grupo, para a combinação de
// modalidades não se misturar com outro plano de mesmo nome perdido.
export function plansOf(rows, total) {
  return groupBy(
    rows,
    (c) => c.planId || `nome:${c.planName || ''}`,
    (c) => c.planName || 'Sem plano',
    total
  );
}

// Ranking de origem. A origem vem do lead que fechou (leadsById), nunca do
// contrato. Lead ainda não buscado, ou sem leadId, cai em "Sem origem".
export function sourcesOf(rows, total, leadsById) {
  const sourceOf = (c) => leadsById?.get(c.leadId)?.source || 'Sem origem';
  return groupBy(rows, sourceOf, sourceOf, total);
}
