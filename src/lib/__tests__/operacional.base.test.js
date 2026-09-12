import { describe, it, expect } from 'vitest';
import { buildContractPause, buildContractResume } from '../contracts.js';
import {
  normalizeContract, normalizeContracts, hasOpenPause, contractStateAt, countActiveAt, countLockedAt,
  computeBaseMovement, computeChurn, cancellationsByReason, salesInWindow, indexContracts
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

  // Formatos reais: trancar grava status 'trancado' + pausedAt; reativar
  // grava pausedAt null, resumedAt, pausedDaysTotal acumulado e empurra o fim.
  it('pausa aberta: trancado desde pausedAt e, trancado, não vence', () => {
    const c = C('a', { status: 'trancado', pausedAt: D(2026, 9, 3), endsAt: D(2026, 9, 20) });
    expect(contractStateAt(c, D(2026, 9, 2))).toBe('vigente');
    expect(contractStateAt(c, D(2026, 9, 10))).toBe('trancado');
    expect(contractStateAt(c, D(2026, 10, 15))).toBe('trancado');
  });

  it('pausa encerrada sem histórico: um intervalo que acaba na reativação e dura pausedDaysTotal', () => {
    const c = C('a', { pausedAt: null, resumedAt: D(2026, 9, 20), pausedDaysTotal: 17 });
    expect(contractStateAt(c, D(2026, 9, 2))).toBe('vigente');
    expect(contractStateAt(c, D(2026, 9, 10))).toBe('trancado');
    expect(contractStateAt(c, D(2026, 9, 21))).toBe('vigente');
  });

  it('pausa atual depois de uma reativação antiga: as duas pausas valem', () => {
    const c = C('a', { status: 'trancado', resumedAt: D(2026, 5, 1), pausedDaysTotal: 10, pausedAt: D(2026, 9, 3) });
    expect(contractStateAt(c, D(2026, 4, 25))).toBe('trancado');
    expect(contractStateAt(c, D(2026, 6, 1))).toBe('vigente');
    expect(contractStateAt(c, D(2026, 9, 10))).toBe('trancado');
  });

  it('histórico de pausas: cada item vira um intervalo, inclusive Timestamp do Firestore', () => {
    const ts = (date) => ({ toDate: () => date });
    const c = C('a', {
      resumedAt: D(2026, 9, 20), pausedDaysTotal: 27,
      pauseHistory: [
        { pausedAt: ts(D(2026, 3, 1)), resumedAt: ts(D(2026, 3, 11)) },
        { pausedAt: D(2026, 9, 3), resumedAt: D(2026, 9, 20) }
      ]
    });
    expect(contractStateAt(c, D(2026, 3, 5))).toBe('trancado');
    expect(contractStateAt(c, D(2026, 8, 28))).toBe('vigente'); // a reconstrução pelo total diria trancado
    expect(contractStateAt(c, D(2026, 9, 10))).toBe('trancado');
    expect(contractStateAt(c, D(2026, 9, 21))).toBe('vigente');
  });

  it('cancelado deixa de valer no cancelamento', () => {
    const c = C('a', { status: 'cancelado', cancelledAt: D(2026, 9, 10) });
    expect(contractStateAt(c, D(2026, 9, 9))).toBe('vigente');
    expect(contractStateAt(c, D(2026, 9, 11))).toBe(null);
  });

  it('cancelado enquanto trancado: trancado até o cancelamento', () => {
    const c = C('a', { status: 'cancelado', pausedAt: D(2026, 8, 1), pauseReason: 'Viagem', cancelledAt: D(2026, 9, 15) });
    expect(contractStateAt(c, D(2026, 8, 10))).toBe('trancado');
    expect(contractStateAt(c, D(2026, 9, 16))).toBe(null);
  });
});

describe('contratos importados', () => {
  it('trancado na planilha: a pausa começa no início, sem inventar trancamento no mês da importação', () => {
    const c = C('imp', {
      status: 'trancado', importBatchId: 'lote', startsAt: D(2026, 3, 1),
      createdAt: D(2026, 9, 4), importedAt: D(2026, 9, 4), pausedAt: D(2026, 9, 4)
    });
    expect(contractStateAt(c, D(2026, 3, 5))).toBe('trancado');
    expect(computeBaseMovement([c], SEP)).toMatchObject({ startCount: 0, endCount: 0, trancaram: 0 });
  });

  it('trancado pela ficha depois da importação usa a data real da pausa', () => {
    const c = C('imp', { status: 'trancado', importBatchId: 'lote', pausedAt: D(2026, 9, 12), pauseReason: 'Viagem' });
    expect(contractStateAt(c, D(2026, 9, 5))).toBe('vigente');
    expect(contractStateAt(c, D(2026, 9, 15))).toBe('trancado');
  });

  it('reativar o trancado da planilha não muda o passado', () => {
    const raw = {
      id: 'imp', leadId: 'imp', status: 'trancado', importBatchId: 'lote',
      startsAt: D(2026, 3, 1), endsAt: D(2026, 12, 1), createdAt: D(2026, 9, 4), pausedAt: D(2026, 9, 4)
    };
    const { contractPatch } = buildContractResume({ contract: raw, resumedAt: D(2026, 10, 5) });
    const c = normalizeContract({ ...raw, ...contractPatch });
    expect(contractStateAt(c, D(2026, 5, 1))).toBe('trancado');
    expect(contractStateAt(c, D(2026, 10, 6))).toBe('vigente');
    expect(computeBaseMovement([c], SEP).trancaram).toBe(0);
  });

  // Caso da revisão. A importação grava a pausa às 15h de 10/05, com início real
  // em 01/03. A ficha reativou em 10/06 com o código de antes do histórico,
  // trancou com motivo em 05/07 e reativou em 04/08.
  it('importado trancado, reativado sem histórico, trancado pela ficha e reativado: o passado não muda', () => {
    const MAR = { start: new Date(2026, 2, 1), end: new Date(2026, 3, 1) };
    const MAY = { start: new Date(2026, 4, 1), end: new Date(2026, 5, 1) };
    const importado = {
      id: 'imp', leadId: 'imp', status: 'trancado', importBatchId: 'lote',
      startsAt: D(2026, 3, 1), endsAt: D(2026, 12, 1),
      createdAt: D(2026, 5, 10, 15), importedAt: D(2026, 5, 10, 15), pausedAt: D(2026, 5, 10, 15)
    };
    const semHistorico = {
      ...importado, status: 'ativo', pausedAt: null, resumedAt: new Date(2026, 5, 10), pausedDaysTotal: 30, endsAt: D(2026, 12, 31)
    };
    const pelaFicha = { ...semHistorico, ...buildContractPause({ pausedAt: new Date(2026, 6, 5), reason: 'Viagem' }).contractPatch };
    const reativado = { ...pelaFicha, ...buildContractResume({ contract: pelaFicha, resumedAt: new Date(2026, 7, 4) }).contractPatch };

    [pelaFicha, reativado].forEach((raw) => {
      const c = normalizeContract(raw);
      expect(computeBaseMovement([c], MAR).steps.importados).toBe(0);
      expect(contractStateAt(c, D(2026, 5, 1))).toBe('trancado');
      expect(computeBaseMovement([c], MAY)).toMatchObject({ startCount: 0, endCount: 0, trancaram: 0 });
      expect(contractStateAt(c, D(2026, 6, 20))).toBe('vigente');
      expect(contractStateAt(c, D(2026, 7, 10))).toBe('trancado');
    });
  });

  it('sem início na planilha, começa na criação', () => {
    const c = C('imp', { startsAt: null, createdAt: D(2026, 9, 12), importSource: 'NextFit' });
    expect(c.startsAt).toEqual(D(2026, 9, 12));
    expect(contractStateAt(c, D(2026, 9, 11))).toBe(null);
    expect(contractStateAt(c, D(2026, 9, 13))).toBe('vigente');
  });
});

describe('contagem por pessoa', () => {
  it('dois contratos do mesmo lead contam uma pessoa', () => {
    const list = [C('c1', { leadId: 'L' }), C('c2', { leadId: 'L', startsAt: D(2026, 2, 1) })];
    expect(countActiveAt(list, D(2026, 9, 1))).toBe(1);
  });

  it('trancado conta à parte', () => {
    const list = [C('a'), C('b', { status: 'trancado', pausedAt: D(2026, 8, 1) })];
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
    C('tranca', { status: 'trancado', pausedAt: D(2026, 9, 12) }),
    C('destranca', { pausedAt: null, resumedAt: D(2026, 9, 8), pausedDaysTotal: 38 }) // parado desde 01/08
  ];

  it('classifica cada pessoa que mudou de lado', () => {
    const r = computeBaseMovement(contracts, SEP);
    expect(r.steps).toEqual({ entraram: 1, voltaram: 1, importados: 0, cancelaram: 1, venceram: 1, trancamentos: 0 });
    expect(r.trancaram).toBe(1);
    expect(r.destrancaram).toBe(1);
  });

  const closes = (r) => {
    const s = r.steps;
    return r.startCount + s.entraram + s.voltaram + s.importados - s.cancelaram - s.venceram + s.trancamentos;
  };

  it('a conta fecha: início + passos = fim', () => {
    const r = computeBaseMovement(contracts, SEP);
    expect(closes(r)).toBe(r.endCount);
    expect(r.endCount).toBe(countActiveAt(contracts, new Date(SEP.end.getTime() - 1)));
  });

  it('traz os trancados do fim, o mesmo retrato de countLockedAt', () => {
    const r = computeBaseMovement(contracts, SEP);
    expect(r.locked).toBe(1);
    expect(r.locked).toBe(countLockedAt(contracts, new Date(SEP.end.getTime() - 1)));
  });

  it('importado que começa no mês entra como importado, nunca como matrícula ou retorno', () => {
    const list = [
      ...contracts,
      C('imp-novo', { startsAt: D(2026, 9, 10), createdAt: D(2026, 9, 10), importBatchId: 'lote' }),
      C('imp-sem-inicio', { startsAt: null, createdAt: D(2026, 9, 12), importSource: 'NextFit' }),
      C('imp-volta-antigo', { leadId: 'IV', endsAt: D(2026, 5, 1) }),
      C('imp-volta-novo', { leadId: 'IV', startsAt: D(2026, 9, 14), createdAt: D(2026, 9, 14), importedBy: 'u1' })
    ];
    const r = computeBaseMovement(list, SEP);
    expect(r.steps).toMatchObject({ entraram: 1, voltaram: 1, importados: 3 });
    expect(closes(r)).toBe(r.endCount);
    expect(r.endCount).toBe(countActiveAt(list, new Date(SEP.end.getTime() - 1)));
  });

  // A importação grava o cancelado da planilha com cancelledAt = endsAt e sem motivo.
  it('cancelamento gravado pela importação sai como vencido, nunca como cancelamento', () => {
    const list = [C('imp', { status: 'cancelado', endsAt: D(2026, 9, 15), cancelledAt: D(2026, 9, 15), importBatchId: 'lote-1' })];
    expect(computeBaseMovement(list, SEP).steps).toMatchObject({ cancelaram: 0, venceram: 1 });
  });

  it('contrato importado cancelado depois pelo app conta em Cancelaram, com ou sem motivo', () => {
    [{ cancelReason: 'Financeiro' }, {}].forEach((extra) => {
      const list = [C('imp', { status: 'cancelado', cancelledAt: D(2026, 9, 15), importBatchId: 'lote-1', ...extra })];
      expect(computeBaseMovement(list, SEP).steps).toMatchObject({ cancelaram: 1, venceram: 0 });
    });
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
    // Quem já contou os vigentes do início (a ponte) passa o número e poupa uma passada.
    expect(computeChurn(list, { ...SEP, activeAtStart: r.base })).toEqual(r);
    expect(computeChurn(list, { ...SEP, activeAtStart: 40 })).toMatchObject({ base: 40, pct: 5 });
  });

  it('importado trancado e cancelado depois pelo app sai no cancelamento', () => {
    const c = C('imp', {
      status: 'cancelado', importBatchId: 'lote', createdAt: D(2026, 5, 10), importedAt: D(2026, 5, 10),
      pausedAt: D(2026, 5, 10), cancelledAt: D(2026, 9, 15), cancelReason: 'Financeiro'
    });
    expect(computeChurn([c], SEP).exits).toBe(1);
  });
});

describe('cancellationsByReason', () => {
  it('agrupa por motivo, sem o cancelamento da importação, "Outro" quando falta motivo', () => {
    const list = [
      C('a', { status: 'cancelado', cancelledAt: D(2026, 9, 3), cancelReason: 'Financeiro' }),
      C('b', { status: 'cancelado', cancelledAt: D(2026, 9, 4), cancelReason: 'Financeiro' }),
      C('c', { status: 'cancelado', cancelledAt: D(2026, 9, 5) }),
      C('d', { status: 'cancelado', endsAt: D(2026, 9, 6), cancelledAt: D(2026, 9, 6), importSource: 'NextFit' }),
      C('e', { status: 'cancelado', cancelledAt: D(2026, 8, 6), cancelReason: 'Financeiro' })
    ];
    expect(cancellationsByReason(list, SEP)).toEqual({
      total: 3,
      items: [{ name: 'Financeiro', count: 2 }, { name: 'Outro', count: 1 }]
    });
  });

  it('contrato importado cancelado depois pelo app entra no motivo', () => {
    const list = [C('d', { status: 'cancelado', cancelledAt: D(2026, 9, 6), cancelReason: 'Financeiro', importSource: 'NextFit' })];
    expect(cancellationsByReason(list, SEP)).toEqual({ total: 1, items: [{ name: 'Financeiro', count: 1 }] });
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

describe('indexContracts', () => {
  it('agrupa por pessoa em ordem de início, liga renovações e monta uma vez por lista', () => {
    const list = [
      C('b2', { leadId: 'B', startsAt: D(2026, 6, 1) }),
      C('b1', { leadId: 'B', startsAt: D(2026, 1, 1) }),
      C('r', { leadId: 'B', renewedFromId: 'b1', startsAt: D(2026, 9, 1) }),
      C('solo')
    ];
    const idx = indexContracts(list);
    expect(idx.byPerson.get('B').map((c) => c.id)).toEqual(['b1', 'b2', 'r']);
    expect(idx.byPerson.get('solo').map((c) => c.id)).toEqual(['solo']);
    expect(idx.byRenewedFrom.get('b1').map((c) => c.id)).toEqual(['r']);
    expect(indexContracts(list)).toBe(idx);
    expect(indexContracts([...list])).not.toBe(idx);
  });
});

describe('normalizeContracts', () => {
  const raw = (id, over = {}) => ({
    id, leadId: 'P', consultantId: 'ana', status: 'ativo',
    startsAt: D(2026, 1, 1), endsAt: D(2026, 12, 1), createdAt: D(2026, 1, 1), ...over
  });
  const trancado = raw('t', { status: 'trancado', pauseReason: 'Viagem', pausedAt: D(2026, 9, 10) });
  const tOf = (list) => list.find((c) => c.id === 't');

  it('fecha a pausa aberta no início do sucessor mais cedo, sem mutar a lista', () => {
    const input = [
      trancado,
      raw('ligado', { renewedFromId: 't', startsAt: D(2026, 11, 1), createdAt: D(2026, 10, 20) }),
      raw('depois', { startsAt: D(2026, 10, 15), createdAt: D(2026, 10, 15) })
    ];
    const before = structuredClone(input);
    const c = tOf(normalizeContracts(input));
    expect(c.pauses).toEqual([{ from: D(2026, 9, 10), to: D(2026, 10, 15) }]);
    expect(c.endsAt).toEqual(D(2027, 1, 5)); // 35 dias parados
    expect(input).toEqual(before);
    expect(tOf(normalizeContracts([trancado])).pauses).toEqual([{ from: D(2026, 9, 10), to: null }]);
  });

  it('não fecha com contrato da pessoa que já corria quando trancou, nem com um que nunca valeu', () => {
    const list = normalizeContracts([
      trancado,
      raw('paralelo', { startsAt: D(2026, 3, 1), endsAt: D(2026, 10, 1), createdAt: D(2026, 3, 1) }),
      raw('desfeito', {
        renewedFromId: 't', status: 'cancelado', startsAt: D(2026, 12, 2), createdAt: D(2026, 9, 20),
        cancelledAt: D(2026, 9, 21), cancelReason: 'Outro'
      })
    ]);
    expect(hasOpenPause(tOf(list))).toBe(true);
  });

  it('cancelado ainda parado antes de o sucessor começar: quem encerra a pausa é o cancelamento', () => {
    const cancelado = { ...trancado, status: 'cancelado', cancelledAt: D(2026, 10, 1), cancelReason: 'Financeiro' };
    const c = tOf(normalizeContracts([cancelado, raw('novo', { startsAt: D(2026, 11, 1), createdAt: D(2026, 11, 1) })]));
    expect(hasOpenPause(c)).toBe(true);
    expect(c.endsAt).toEqual(D(2026, 12, 1));
  });
});
