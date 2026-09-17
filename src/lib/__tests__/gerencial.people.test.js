import { describe, it, expect } from 'vitest';
import { sellersOf, plansOf, sourcesOf } from '../gerencial/people.js';

const c = (over) => ({ id: 'c', value: 1200, durationMonths: 12, consultantId: 'u1', consultantName: 'Ana Ribeiro', planId: 'anual', planName: 'Anual Musculação', leadId: 'l1', ...over });

describe('sellersOf', () => {
  it('agrupa por consultor com as duas colunas de ticket', () => {
    const rows = [c({ id: 'a' }), c({ id: 'b', value: 600, durationMonths: 6 })];
    const [ana] = sellersOf(rows, 1800);
    expect(ana).toMatchObject({ id: 'u1', name: 'Ana Ribeiro', count: 2, value: 1800, perSale: 900, monthly: 100, share: 100 });
  });

  it('ordena por valor e guarda o lugar', () => {
    const rows = [c({ id: 'a', value: 600 }), c({ id: 'b', consultantId: 'u2', consultantName: 'Diego Santos', value: 1200 })];
    expect(sellersOf(rows, 1800).map((r) => r.name)).toEqual(['Diego Santos', 'Ana Ribeiro']);
  });

  it('venda sem consultor vira "Sem consultor"', () => {
    expect(sellersOf([c({ consultantId: null, consultantName: null })], 1200)[0].name).toBe('Sem consultor');
  });
});

describe('plansOf', () => {
  it('a combinação de modalidades é um grupo próprio', () => {
    const rows = [
      c({ id: 'a', planId: 'musc', planName: 'Anual Musculação' }),
      c({ id: 'b', planId: 'mp', planName: 'Musculação + Pilates', value: 1800 })
    ];
    const out = plansOf(rows, 3000);
    expect(out.map((p) => p.name)).toEqual(['Musculação + Pilates', 'Anual Musculação']);
    expect(out[0].count).toBe(1);
  });

  it('plano apagado ainda soma pelo nome gravado no contrato', () => {
    expect(plansOf([c({ planId: null, planName: 'Plano antigo' })], 1200)[0].name).toBe('Plano antigo');
  });
});

describe('sourcesOf', () => {
  it('usa a origem do lead que fechou', () => {
    const leadsById = new Map([['l1', { source: 'Instagram' }], ['l2', { source: 'Indicação' }]]);
    const rows = [c({ id: 'a' }), c({ id: 'b', leadId: 'l2', value: 600 })];
    const out = sourcesOf(rows, 1800, leadsById);
    expect(out.map((s) => s.name)).toEqual(['Instagram', 'Indicação']);
  });

  it('lead que ainda não chegou fica em "Sem origem"', () => {
    expect(sourcesOf([c({})], 1200, new Map())[0].name).toBe('Sem origem');
  });
});
