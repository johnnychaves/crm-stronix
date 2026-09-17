import { describe, it, expect } from 'vitest';
import { salesOf } from '../gerencial/sales.js';
import { SALE_TYPES } from '../gerencial/scope.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const start = D(2026, 9, 1);
const end = D(2026, 10, 1);
const c = (over) => ({ id: 'c', personKey: 'p', value: 1200, listValue: 1200, durationMonths: 12, createdAt: D(2026, 9, 10), startsAt: D(2026, 9, 10), ...over });

describe('salesOf', () => {
  it('soma o que foi fechado dentro da janela', () => {
    const r = salesOf([c({ id: 'a' }), c({ id: 'b', personKey: 'p2', value: 600, durationMonths: 6 })], { start, end });
    expect(r.sold).toBe(1800);
    expect(r.count).toBe(2);
  });

  it('a renovação assinada antes conta no mês em que foi fechada', () => {
    const fora = c({ id: 'x', createdAt: D(2026, 8, 28), startsAt: D(2026, 9, 15) });
    expect(salesOf([fora], { start, end }).count).toBe(0);
  });

  it('o ticket é a média dos tickets mensais, não o total dividido pelos meses', () => {
    const r = salesOf([c({ id: 'a', value: 1200, durationMonths: 12 }), c({ id: 'b', personKey: 'p2', value: 300, durationMonths: 1 })], { start, end });
    expect(r.ticket).toBe(200); // (100 + 300) / 2
  });

  it('desconto é a tabela menos o fechado', () => {
    const r = salesOf([c({ value: 1100, listValue: 1200 })], { start, end });
    expect(r.discAbs).toBe(100);
    expect(r.discPct).toBe(8);
  });

  it('cada contrato entra num tipo só e o mix fecha com o total', () => {
    const list = [
      c({ id: 'a' }),
      c({ id: 'b', personKey: 'p2', renewedFromId: 'z' }),
      c({ id: 'c', personKey: 'p3', closedFromUpgrade: true })
    ];
    const r = salesOf(list, { start, end });
    expect(r.mix.reduce((s, m) => s + m.count, 0)).toBe(3);
    expect(r.mix.reduce((s, m) => s + m.value, 0)).toBe(r.sold);
    expect(r.mix.find((m) => m.type === SALE_TYPES.RENOVACAO).count).toBe(1);
  });

  it('venda cancelada depois continua no total, com a marca', () => {
    const r = salesOf([c({ id: 'a' }), c({ id: 'b', personKey: 'p2', cancelledAt: D(2026, 9, 20) })], { start, end });
    expect(r.count).toBe(2);
    expect(r.sold).toBe(2400);
    expect(r.clawCount).toBe(1);
    expect(r.clawValue).toBe(1200);
  });

  it('contrato importado não é venda', () => {
    expect(salesOf([c({ imported: true })], { start, end }).count).toBe(0);
  });

  it('mês sem venda devolve zeros, não null', () => {
    const r = salesOf([], { start, end });
    expect(r).toMatchObject({ sold: 0, count: 0, ticket: 0, discAbs: 0, discPct: 0, clawCount: 0 });
    expect(r.mix).toEqual([]);
  });
});
