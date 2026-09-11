import { describe, it, expect } from 'vitest';
import {
  normalizeContract, contractStateAt, countActiveAt, countLockedAt,
  computeBaseMovement, computeChurn, cancellationsByReason, salesInWindow
} from '../operacional/base.js';

const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const C = (id, over = {}) => normalizeContract({
  id, leadId: id, consultantId: 'ana', status: 'ativo',
  startsAt: D(2026, 1, 1), endsAt: D(2027, 1, 1), createdAt: over.startsAt || D(2026, 1, 1),
  ...over
});
const SEP = { start: new Date(2026, 8, 1), end: new Date(2026, 9, 1), graceDays: 15 };

describe('contractStateAt', () => {
  it('vigente dentro da vigência, nada fora dela', () => {
    const c = C('a', { startsAt: D(2026, 8, 1), endsAt: D(2026, 11, 1) });
    expect(contractStateAt(c, D(2026, 9, 5))).toBe('vigente');
    expect(contractStateAt(c, D(2026, 7, 31))).toBe(null);
    expect(contractStateAt(c, D(2026, 11, 2))).toBe(null);
  });

  it('trancado entre a pausa e a reativação', () => {
    const c = C('a', { pausedAt: D(2026, 9, 3), resumedAt: D(2026, 9, 20) });
    expect(contractStateAt(c, D(2026, 9, 10))).toBe('trancado');
    expect(contractStateAt(c, D(2026, 9, 21))).toBe('vigente');
  });

  it('pausa atual depois de uma reativação antiga continua trancada', () => {
    const c = C('a', { resumedAt: D(2026, 5, 1), pausedAt: D(2026, 9, 3) });
    expect(contractStateAt(c, D(2026, 9, 10))).toBe('trancado');
  });

  it('cancelado deixa de valer no cancelamento', () => {
    const c = C('a', { status: 'cancelado', cancelledAt: D(2026, 9, 10) });
    expect(contractStateAt(c, D(2026, 9, 9))).toBe('vigente');
    expect(contractStateAt(c, D(2026, 9, 11))).toBe(null);
  });
});

describe('contagem por pessoa', () => {
  it('dois contratos do mesmo lead contam uma pessoa', () => {
    const list = [C('c1', { leadId: 'L' }), C('c2', { leadId: 'L', startsAt: D(2026, 2, 1) })];
    expect(countActiveAt(list, D(2026, 9, 1))).toBe(1);
  });

  it('trancado conta à parte', () => {
    const list = [C('a'), C('b', { pausedAt: D(2026, 8, 1) })];
    expect(countActiveAt(list, D(2026, 9, 1))).toBe(1);
    expect(countLockedAt(list, D(2026, 9, 1))).toBe(1);
  });
});

describe('computeBaseMovement (ponte do mês)', () => {
  const contracts = [
    C('fica'),                                                                              // vigente o mês todo
    C('novo', { startsAt: D(2026, 9, 5), createdAt: D(2026, 9, 5), endsAt: D(2026, 12, 5) }), // primeira matrícula
    C('volta-antigo', { leadId: 'V', startsAt: D(2026, 1, 1), endsAt: D(2026, 6, 1) }),
    C('volta-novo', { leadId: 'V', startsAt: D(2026, 9, 10), createdAt: D(2026, 9, 10), endsAt: D(2026, 12, 10) }),
    C('cancela', { status: 'cancelado', cancelledAt: D(2026, 9, 15), cancelReason: 'Financeiro' }),
    C('vence', { endsAt: D(2026, 9, 20) }),
    C('tranca', { pausedAt: D(2026, 9, 12) }),
    C('destranca', { pausedAt: D(2026, 8, 1), resumedAt: D(2026, 9, 8) })
  ];

  it('classifica cada pessoa que mudou de lado', () => {
    const r = computeBaseMovement(contracts, SEP);
    expect(r.steps).toEqual({ entraram: 1, voltaram: 1, cancelaram: 1, venceram: 1, trancamentos: 0 });
    expect(r.trancaram).toBe(1);
    expect(r.destrancaram).toBe(1);
  });

  it('a conta fecha: início + passos = fim', () => {
    const r = computeBaseMovement(contracts, SEP);
    const s = r.steps;
    expect(r.startCount + s.entraram + s.voltaram - s.cancelaram - s.venceram + s.trancamentos).toBe(r.endCount);
    expect(r.endCount).toBe(countActiveAt(contracts, new Date(SEP.end.getTime() - 1)));
  });

  it('cancelamento de contrato importado sai como vencido, nunca como cancelamento', () => {
    const list = [C('imp', { status: 'cancelado', cancelledAt: D(2026, 9, 15), importBatchId: 'lote-1' })];
    expect(computeBaseMovement(list, SEP).steps).toMatchObject({ cancelaram: 0, venceram: 1 });
  });
});

describe('computeChurn', () => {
  it('conta cancelamento no mês e vencido que passou da tolerância no mês', () => {
    const list = [
      C('base1'), C('base2'), C('base3'), C('base4'),
      C('cancela', { status: 'cancelado', cancelledAt: D(2026, 9, 15) }),
      C('vence-agosto', { endsAt: D(2026, 8, 25) }),                    // tolerância acaba em 09/09
      C('vence-setembro', { endsAt: D(2026, 9, 25) }),                  // tolerância acaba em outubro
      C('voltou-antigo', { leadId: 'R', endsAt: D(2026, 8, 20) }),
      C('voltou-novo', { leadId: 'R', startsAt: D(2026, 8, 28), createdAt: D(2026, 8, 28), endsAt: D(2026, 11, 28) })
    ];
    const r = computeChurn(list, SEP);
    expect(r.exits).toBe(2);
    expect(r.base).toBe(countActiveAt(list, SEP.start));
    expect(r.pct).toBe(Math.round((2 / r.base) * 1000) / 10);
  });
});

describe('cancellationsByReason', () => {
  it('agrupa por motivo, sem importados, "Outro" quando falta motivo', () => {
    const list = [
      C('a', { status: 'cancelado', cancelledAt: D(2026, 9, 3), cancelReason: 'Financeiro' }),
      C('b', { status: 'cancelado', cancelledAt: D(2026, 9, 4), cancelReason: 'Financeiro' }),
      C('c', { status: 'cancelado', cancelledAt: D(2026, 9, 5) }),
      C('d', { status: 'cancelado', cancelledAt: D(2026, 9, 6), cancelReason: 'Financeiro', importSource: 'NextFit' }),
      C('e', { status: 'cancelado', cancelledAt: D(2026, 8, 6), cancelReason: 'Financeiro' })
    ];
    expect(cancellationsByReason(list, SEP)).toEqual({
      total: 3,
      items: [{ name: 'Financeiro', count: 2 }, { name: 'Outro', count: 1 }]
    });
  });
});

describe('salesInWindow', () => {
  it('matrícula só na primeira vez da pessoa; upgrade por vendedor; importado nunca', () => {
    const list = [
      C('primeira', { consultantId: 'ana', startsAt: D(2026, 9, 2), createdAt: D(2026, 9, 2) }),
      C('antiga', { leadId: 'X', consultantId: 'diego', createdAt: D(2026, 2, 1) }),
      C('rematricula', { leadId: 'X', consultantId: 'diego', startsAt: D(2026, 9, 3), createdAt: D(2026, 9, 3) }),
      C('renova', { consultantId: 'diego', renewedFromId: 'antiga', createdAt: D(2026, 9, 4) }),
      C('upgrade', { consultantId: 'ana', renewedFromId: 'y', closedFromUpgrade: true, createdAt: D(2026, 9, 5) }),
      C('importado', { consultantId: 'ana', createdAt: D(2026, 9, 6), importBatchId: 'lote' })
    ];
    const r = salesInWindow(list, SEP);
    expect(Object.fromEntries(r.entered)).toEqual({ ana: 1 });
    expect(Object.fromEntries(r.upgrades)).toEqual({ ana: 1 });
  });
});
