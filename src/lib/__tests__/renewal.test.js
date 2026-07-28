// Testes da aritmética da renovação (renewal.js): emenda/lacuna/sobreposição,
// desconto por %, R$ ou valor final, ranking de planos por vendas e os marcos
// de renovação na régua de vigência. Datas sempre em horário LOCAL.

import { describe, it, expect } from 'vitest';
import {
  SEAM_KIND,
  DISCOUNT_MODES,
  DISCOUNT_REASONS,
  daysBetween,
  seamStart,
  computeSeam,
  seamLabel,
  seamWarning,
  computeDiscount,
  plansWithSales,
  topSellingPlans,
  searchPlans,
  contractVigencia,
  missedCheckpointsLabel
} from '../renewal.js';

const D = (y, m, d) => new Date(y, m - 1, d);

describe('daysBetween', () => {
  it('conta os dias entre duas datas', () => {
    expect(daysBetween(D(2026, 8, 21), D(2026, 8, 22))).toBe(1);
    expect(daysBetween(D(2026, 8, 21), D(2026, 7, 27))).toBe(-25);
  });

  it('atravessa o horário de verão sem perder o dia', () => {
    expect(daysBetween(D(2026, 1, 1), D(2026, 12, 31))).toBe(364);
  });
});

describe('seamStart', () => {
  it('é o dia seguinte ao fim do contrato atual', () => {
    expect(seamStart(D(2026, 8, 21))).toEqual(D(2026, 8, 22));
  });

  it('vira o mês corretamente', () => {
    expect(seamStart(D(2026, 8, 31))).toEqual(D(2026, 9, 1));
  });

  it('null sem vigência atual', () => {
    expect(seamStart(null)).toBeNull();
  });
});

describe('computeSeam', () => {
  const end = D(2026, 8, 21);

  it('emendar no dia seguinte não deixa lacuna', () => {
    const seam = computeSeam(end, D(2026, 8, 22));
    expect(seam.kind).toBe(SEAM_KIND.EMENDA);
    expect(seam.gapDays).toBe(0);
    expect(seam.overlapDays).toBe(0);
  });

  it('começar depois abre lacuna — e o dia da emenda não conta', () => {
    expect(computeSeam(end, D(2026, 8, 23)).gapDays).toBe(1);
    expect(computeSeam(end, D(2026, 9, 1)).gapDays).toBe(10);
    expect(computeSeam(end, D(2026, 9, 1)).kind).toBe(SEAM_KIND.LACUNA);
  });

  it('começar hoje, 25 dias antes do vencimento, sobrepõe 25 dias', () => {
    const seam = computeSeam(end, D(2026, 7, 27));
    expect(seam.kind).toBe(SEAM_KIND.SOBREPOSICAO);
    expect(seam.gapDays).toBe(-25);
    expect(seam.overlapDays).toBe(25);
  });

  it('null quando falta uma das datas', () => {
    expect(computeSeam(null, D(2026, 8, 22))).toBeNull();
    expect(computeSeam(end, null)).toBeNull();
  });
});

describe('seamLabel', () => {
  const end = D(2026, 8, 21);

  it('lê a emenda, a lacuna e a sobreposição', () => {
    expect(seamLabel(computeSeam(end, D(2026, 8, 22)))).toMatch(/Emenda perfeita/);
    expect(seamLabel(computeSeam(end, D(2026, 8, 23)))).toBe('1 dia sem contrato entre os dois.');
    expect(seamLabel(computeSeam(end, D(2026, 9, 1)))).toBe('10 dias sem contrato entre os dois.');
    expect(seamLabel(computeSeam(end, D(2026, 7, 27)))).toBe('Sobreposição de 25 dias com o contrato atual.');
  });
});

describe('seamWarning', () => {
  const end = D(2026, 8, 21);

  it('não avisa nada quando a vigência emenda', () => {
    expect(seamWarning(computeSeam(end, D(2026, 8, 22)), D(2026, 8, 22))).toBeNull();
  });

  it('na sobreposição diz a data em que o contrato atual seria encerrado', () => {
    const warn = seamWarning(computeSeam(end, D(2026, 7, 27)), D(2026, 7, 27));
    expect(warn).toMatch(/26\/07\/2026/);
    expect(warn).toMatch(/25 dias antes/);
  });

  it('na lacuna diz quantos dias o cliente fica fora dos relatórios', () => {
    const warn = seamWarning(computeSeam(end, D(2026, 9, 1)), D(2026, 9, 1));
    expect(warn).toMatch(/10 dias sem contrato ativo/);
    expect(warn).toMatch(/relatórios de clientes ativos/);
  });
});

describe('computeDiscount', () => {
  it('sem desconto devolve o valor de tabela', () => {
    const r = computeDiscount({ listValue: 1390, mode: DISCOUNT_MODES.NENHUM, input: '25' });
    expect(r.finalValue).toBe(1390);
    expect(r.hasDiscount).toBe(false);
  });

  it('percentual', () => {
    const r = computeDiscount({ listValue: 1390, mode: DISCOUNT_MODES.PERCENT, input: '10' });
    expect(r.finalValue).toBe(1251);
    expect(r.discountValue).toBe(139);
    expect(r.discountPct).toBe(10);
    expect(r.hasDiscount).toBe(true);
  });

  it('percentual acima de 100 não vira valor negativo', () => {
    expect(computeDiscount({ listValue: 1390, mode: DISCOUNT_MODES.PERCENT, input: '150' }).finalValue).toBe(0);
  });

  it('em reais, aceitando vírgula e ponto de milhar', () => {
    const r = computeDiscount({ listValue: 1390, mode: DISCOUNT_MODES.REAIS, input: '139,50' });
    expect(r.finalValue).toBe(1250.5);
    expect(computeDiscount({ listValue: 1390, mode: DISCOUNT_MODES.REAIS, input: '1.000,00' }).finalValue).toBe(390);
  });

  it('valor final digitado direto', () => {
    const r = computeDiscount({ listValue: 1390, mode: DISCOUNT_MODES.FINAL, input: '1.240,00' });
    expect(r.finalValue).toBe(1240);
    expect(r.discountValue).toBe(150);
  });

  it('valor final vazio mantém a tabela', () => {
    expect(computeDiscount({ listValue: 1390, mode: DISCOUNT_MODES.FINAL, input: '' }).finalValue).toBe(1390);
  });

  it('valor final acima da tabela não vira desconto negativo', () => {
    const r = computeDiscount({ listValue: 1390, mode: DISCOUNT_MODES.FINAL, input: '1500' });
    expect(r.finalValue).toBe(1500);
    expect(r.discountValue).toBe(0);
    expect(r.hasDiscount).toBe(false);
  });

  it('lista de motivos tem os cinco do handoff', () => {
    expect(DISCOUNT_REASONS).toEqual(['Fidelidade', 'Indicação', 'Campanha', 'Retorno', 'Outro']);
  });
});

describe('plansWithSales / topSellingPlans', () => {
  const planos = [
    { id: 'anual', name: 'Anual', order: 1, value: 1390, durationMonths: 12 },
    { id: 'mensal', name: 'Mensal', order: 2, value: 149, durationMonths: 1 },
    { id: 'semestral', name: 'Semestral', order: 3, value: 749, durationMonths: 6 },
    { id: 'trimestral', name: 'Trimestral', order: 4, value: 399, durationMonths: 3 }
  ];
  const contratos = [
    ...Array.from({ length: 5 }, () => ({ planId: 'anual' })),
    ...Array.from({ length: 3 }, () => ({ planId: 'trimestral' })),
    { planId: 'semestral' },
    { planId: 'plano-apagado' }
  ];

  it('conta contratos por plano', () => {
    const withSales = plansWithSales(planos, contratos);
    expect(withSales.find(p => p.id === 'anual').sold).toBe(5);
    expect(withSales.find(p => p.id === 'mensal').sold).toBe(0);
  });

  it('os três mais vendidos, empate resolvido pela ordem do catálogo', () => {
    const top = topSellingPlans(plansWithSales(planos, contratos), 3);
    expect(top.map(p => p.id)).toEqual(['anual', 'trimestral', 'semestral']);
  });

  it('sem contratos, mantém a ordem do catálogo', () => {
    const top = topSellingPlans(plansWithSales(planos, []), 3);
    expect(top.map(p => p.id)).toEqual(['anual', 'mensal', 'semestral']);
  });
});

describe('searchPlans', () => {
  const planos = plansWithSales(
    [
      { id: 'anual', name: 'Anual' },
      { id: 'anual-func', name: 'Anual + Funcional' },
      { id: 'estudante', name: 'Anual Estudante' },
      { id: 'mensal', name: 'Mensal' }
    ],
    []
  );

  it('acha por trecho do nome, ignorando acento e caixa', () => {
    expect(searchPlans(planos, 'FUNC').map(p => p.id)).toEqual(['anual-func']);
    expect(searchPlans(planos, 'anual').length).toBe(3);
  });

  it('busca vazia não devolve nada (os cartões continuam à vista)', () => {
    expect(searchPlans(planos, '   ')).toEqual([]);
  });
});

describe('contractVigencia', () => {
  const startsAt = D(2025, 8, 21);
  const endsAt = D(2026, 8, 21);

  it('mede o percentual decorrido e os dias restantes', () => {
    const v = contractVigencia({ startsAt, endsAt, now: D(2026, 7, 27) });
    expect(v.totalDays).toBe(365);
    expect(v.daysLeft).toBe(25);
    expect(v.elapsedPct).toBe(93);
  });

  it('coloca cada marco na posição real da régua', () => {
    const v = contractVigencia({ startsAt, endsAt, checkpoints: [90, 60, 30], now: D(2026, 7, 27) });
    expect(v.marks.map(m => m.days)).toEqual([90, 60, 30]);
    expect(Math.round(v.marks[0].pos)).toBe(75); // (365-90)/365
    expect(v.marks[2].date).toEqual(D(2026, 7, 22));
  });

  it('marca como perdido o marco que passou sem contato', () => {
    const v = contractVigencia({
      startsAt, endsAt, checkpoints: [90, 60, 30], handled: [60], now: D(2026, 7, 27)
    });
    expect(v.marks.map(m => m.passed)).toEqual([true, true, true]);
    expect(v.missedCount).toBe(2);
    expect(v.marks.find(m => m.days === 60).handled).toBe(true);
  });

  it('o marco ativo é o menor que ainda cobre o prazo restante', () => {
    const v = contractVigencia({ startsAt, endsAt, checkpoints: [90, 60, 30], now: D(2026, 7, 27) });
    expect(v.marks.find(m => m.active).days).toBe(30);
  });

  it('descarta marco maior que a própria vigência', () => {
    const v = contractVigencia({
      startsAt: D(2026, 7, 1), endsAt: D(2026, 8, 1), checkpoints: [90, 60, 30], now: D(2026, 7, 10)
    });
    expect(v.marks.map(m => m.days)).toEqual([30]);
  });

  it('contrato vencido fica em 100% com dias negativos', () => {
    const v = contractVigencia({ startsAt, endsAt, now: D(2026, 9, 1) });
    expect(v.elapsedPct).toBe(100);
    expect(v.daysLeft).toBeLessThan(0);
  });

  it('null sem vigência gravada', () => {
    expect(contractVigencia({ startsAt: null, endsAt })).toBeNull();
  });
});

describe('missedCheckpointsLabel', () => {
  it('concorda em número', () => {
    expect(missedCheckpointsLabel(0)).toBeNull();
    expect(missedCheckpointsLabel(1)).toBe('1 marco de renovação passou sem contato');
    expect(missedCheckpointsLabel(2)).toBe('2 marcos de renovação passaram sem contato');
  });
});
