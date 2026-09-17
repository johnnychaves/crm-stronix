import { describe, it, expect } from 'vitest';
import { metricsOf, deltaOf } from '../gerencial/metrics.js';
import { comparisonCut } from '../operacional/month.js';

const D = (y, m, d) => new Date(y, m - 1, d);
const c = (over) => ({
  id: 'c', personKey: 'p', value: 1200, durationMonths: 12,
  startsAt: D(2026, 1, 1), endsAt: D(2027, 1, 1), createdAt: D(2026, 1, 1), pauses: [],
  ...over
});

describe('metricsOf', () => {
  it('mês em andamento contra a pró-rata do comparado', () => {
    const now = D(2026, 9, 17);
    const contracts = [
      c({ id: 'sep', personKey: 'p1', createdAt: D(2026, 9, 10), startsAt: D(2026, 9, 10) }),
      c({ id: 'aug-early', personKey: 'p2', createdAt: D(2026, 8, 5), startsAt: D(2026, 8, 5) }),
      c({ id: 'aug-late', personKey: 'p3', createdAt: D(2026, 8, 25), startsAt: D(2026, 8, 25) })
    ];
    const ctx = { now, contracts, leadsById: new Map() };
    const cur = metricsOf(ctx, { monthKey: '2026-09' });
    const cut = comparisonCut('2026-09', '2026-08', now);
    const prev = metricsOf(ctx, { monthKey: '2026-08', cutEnd: cut });
    expect(cur.sold.count).toBe(1);
    expect(prev.sold.count).toBe(1);
  });

  it('mês fechado contra o mês comparado inteiro', () => {
    const now = D(2026, 9, 17);
    const contracts = [
      c({ id: 'aug', personKey: 'p1', createdAt: D(2026, 8, 25), startsAt: D(2026, 8, 25) }),
      c({ id: 'jul', personKey: 'p2', createdAt: D(2026, 7, 10), startsAt: D(2026, 7, 10) })
    ];
    const ctx = { now, contracts, leadsById: new Map() };
    const shown = metricsOf(ctx, { monthKey: '2026-08' });
    expect(shown.sold.count).toBe(1);
    const cut = comparisonCut('2026-08', '2026-07', now);
    const prev = metricsOf(ctx, { monthKey: '2026-07', cutEnd: cut });
    expect(prev.sold.count).toBe(1);
  });

  it('academia sem contrato levanta gymEmpty', () => {
    const now = D(2026, 9, 17);
    const ctx = { now, contracts: [], leadsById: new Map() };
    const m = metricsOf(ctx, { monthKey: '2026-09' });
    expect(m.flags.gymEmpty).toBe(true);
    expect(m.flags.monthNoSales).toBe(true);
  });

  it('mês sem venda com carteira cheia levanta só monthNoSales', () => {
    const now = D(2026, 9, 17);
    const contracts = [c({ id: 'jan', personKey: 'p1', createdAt: D(2026, 1, 10), startsAt: D(2026, 1, 10), endsAt: D(2027, 1, 10) })];
    const ctx = { now, contracts, leadsById: new Map() };
    const m = metricsOf(ctx, { monthKey: '2026-05' });
    expect(m.flags.monthNoSales).toBe(true);
    expect(m.flags.gymEmpty).toBe(false);
    expect(m.wallet.count).toBe(1);
  });

  it('carteira e risco olham sempre ctx.now, nunca o mês escolhido', () => {
    const now = D(2026, 9, 17);
    const contracts = [
      c({ id: 'a', personKey: 'p1', createdAt: D(2026, 9, 5), startsAt: D(2026, 9, 5), endsAt: D(2027, 9, 5) }),
      c({ id: 'd', personKey: 'p3', createdAt: D(2026, 9, 8), startsAt: D(2026, 9, 8), endsAt: D(2027, 9, 8) }),
      c({ id: 'b', personKey: 'p2', createdAt: D(2026, 6, 1), startsAt: D(2026, 6, 1), endsAt: D(2027, 6, 1) })
    ];
    const ctx = { now, contracts, leadsById: new Map() };
    const sep = metricsOf(ctx, { monthKey: '2026-09' });
    const jun = metricsOf(ctx, { monthKey: '2026-06' });
    expect(sep.wallet).toEqual(jun.wallet);
    expect(sep.risk).toEqual(jun.risk);
    expect(sep.sold.count).not.toBe(jun.sold.count);
  });

  it('risk.share é a soma dos três horizontes dividida pelo valor por mês da carteira', () => {
    const now = D(2026, 9, 17);
    const contracts = [
      c({ id: 'h30', personKey: 'p1', value: 1200, durationMonths: 12, startsAt: D(2025, 10, 1), endsAt: D(2026, 10, 1) }),
      c({ id: 'h60', personKey: 'p2', value: 1200, durationMonths: 12, startsAt: D(2025, 10, 1), endsAt: D(2026, 11, 1) }),
      c({ id: 'other', personKey: 'p3', value: 2400, durationMonths: 12, startsAt: D(2025, 1, 1), endsAt: D(2027, 6, 1) })
    ];
    const ctx = { now, contracts, leadsById: new Map() };
    const m = metricsOf(ctx, { monthKey: '2026-09' });
    expect(m.wallet.monthly).toBe(400);
    expect(m.risk.share).toBeCloseTo(50, 5);
  });

  it('exits usa a janela do mês pedido, não sempre o mês corrente', () => {
    const now = D(2026, 9, 17);
    const contracts = [
      c({ id: 'a', personKey: 'p1', cancelledAt: D(2026, 9, 5) }),
      c({ id: 'b', personKey: 'p2', cancelledAt: D(2026, 8, 5) })
    ];
    const ctx = { now, contracts, leadsById: new Map() };
    const sep = metricsOf(ctx, { monthKey: '2026-09' });
    expect(sep.exits.items.find((i) => i.kind === 'cancelamento').count).toBe(1);
  });

  it('sellers, plans e sources saem das vendas do mês', () => {
    const now = D(2026, 9, 17);
    const contracts = [
      c({
        id: 'a', personKey: 'p1', value: 1200, durationMonths: 12, createdAt: D(2026, 9, 5), startsAt: D(2026, 9, 5),
        consultantId: 'u1', consultantName: 'Ana', planId: 'pl1', planName: 'Plano A', leadId: 'l1'
      }),
      c({
        id: 'b', personKey: 'p2', value: 600, durationMonths: 6, createdAt: D(2026, 9, 8), startsAt: D(2026, 9, 8),
        consultantId: 'u2', consultantName: 'Diego', planId: 'pl2', planName: 'Plano B', leadId: 'l2'
      })
    ];
    const leadsById = new Map([['l1', { source: 'Instagram' }], ['l2', { source: 'Indicação' }]]);
    const ctx = { now, contracts, leadsById };
    const m = metricsOf(ctx, { monthKey: '2026-09' });
    expect(m.sellers.reduce((s, x) => s + x.share, 0)).toBeCloseTo(100, 5);
    expect(m.plans.map((p) => p.name).sort()).toEqual(['Plano A', 'Plano B']);
    expect(m.sources.map((s) => s.name).sort()).toEqual(['Indicação', 'Instagram']);
  });

  it('cache por ctx: mesma chamada devolve o mesmo objeto', () => {
    const now = D(2026, 9, 17);
    const ctx = { now, contracts: [c({ id: 'a' })], leadsById: new Map() };
    const first = metricsOf(ctx, { monthKey: '2026-09' });
    const second = metricsOf(ctx, { monthKey: '2026-09' });
    expect(first).toBe(second);
  });
});

describe('deltaOf', () => {
  it('sem base de um dos lados', () => {
    expect(deltaOf(10, null)).toEqual({ none: true, text: 'sem base' });
  });
  it('diferença zero é igual', () => {
    expect(deltaOf(10, 10)).toMatchObject({ flat: true, value: 0, text: 'igual' });
  });
  it('sobe com o sinal de mais', () => {
    expect(deltaOf(12, 10)).toMatchObject({ up: true, value: 2, text: '+2' });
  });
  it('desce com o sinal de menos', () => {
    expect(deltaOf(8, 10)).toMatchObject({ up: false, value: -2, text: '−2' });
  });
  it('em pontos percentuais', () => {
    expect(deltaOf(12, 10, { kind: 'pp' })).toMatchObject({ text: '+2 p.p.' });
  });
});
