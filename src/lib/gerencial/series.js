// Venda acumulada dia a dia, para a curva do topo da tela Gerencial. Cada ponto
// é o vendido do mês até aquele dia, somando o valor do contrato inteiro (a
// mesma moeda do "Vendido no mês").
//
// O mês em andamento, ou o comparado com corte, só vai até o último dia
// coberto: os dias seguintes ficam null, para a curva parar onde o mês está.
import { saleMoment } from './scope.js';

export const daysInMonthOf = (start) => new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();

export function cumulativeByDay(rows, { start, end }) {
  const days = daysInMonthOf(start);
  const lastDay = Math.max(1, Math.min(days, new Date(end.getTime() - 1).getDate()));
  const perDay = new Array(days).fill(0);
  (rows || []).forEach((c) => {
    const t = saleMoment(c);
    if (t) perDay[t.getDate() - 1] += Number(c.value) || 0;
  });
  let acc = 0;
  return perDay.map((v, i) => (i < lastDay ? (acc += v) : null));
}
