import { describe, it, expect } from 'vitest';
import { leadIdsForSales } from '../queries.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const c = (over) => ({ id: 'c', leadId: 'l1', createdAt: D(2026, 9, 10), startsAt: D(2026, 9, 10), ...over });

describe('leadIdsForSales', () => {
  it('pega os leads dos contratos fechados nos meses abertos', () => {
    expect(leadIdsForSales([c({})], { monthKeys: ['2026-09'] })).toEqual(['l1']);
  });
  it('ignora contrato de fora dos meses', () => {
    expect(leadIdsForSales([c({ createdAt: D(2026, 7, 1) })], { monthKeys: ['2026-09'] })).toEqual([]);
  });
  it('ignora importado, repetido e o que já está em mãos', () => {
    const list = [c({}), c({ id: 'b' }), c({ id: 'i', imported: true, leadId: 'l9' })];
    expect(leadIdsForSales(list, { monthKeys: ['2026-09'], known: new Set(['l1']) })).toEqual([]);
  });
  it('sem meses, não busca nada', () => {
    expect(leadIdsForSales([c({})], { monthKeys: [] })).toEqual([]);
  });
});
