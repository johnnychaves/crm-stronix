import { describe, it, expect, vi } from 'vitest';
import {
  monthWindowSpec, interactionsInMonthSpec, leadsCreatedInMonthSpec, goalHistorySinceSpec, goalHistoryInMonthSpec,
  chunk, loadWithCountCheck, retryWithBackoff, monthEntryFits, shouldStoreMonthEntry, failedMonthEntry, leadIdsForRenewal
} from '../operacional/queries.js';
import { normalizeContract } from '../operacional/base.js';

describe('specs de consulta', () => {
  it('toda consulta por mês é de campo único: range e orderBy no mesmo campo', () => {
    const specs = [
      interactionsInMonthSpec(0, 10),
      leadsCreatedInMonthSpec(0, 10),
      goalHistorySinceSpec('2026-04-01'),
      goalHistoryInMonthSpec('2026-08-01', '2026-09-01'),
      monthWindowSpec('createdAt', 0, 10)
    ];
    specs.forEach((s) => {
      expect(new Set(s.wheres.map((w) => w.field))).toEqual(new Set([s.orderBy.field]));
      expect(s.wheres.every((w) => w.op !== '==')).toBe(true);
    });
  });

  it('janela do mês é [início, fim)', () => {
    const s = interactionsInMonthSpec(Date.UTC(2026, 8, 1), Date.UTC(2026, 9, 1));
    expect(s.wheres.map((w) => w.op)).toEqual(['>=', '<']);
  });

  it('histórico de mês fechado: do primeiro dia até antes do primeiro dia do mês seguinte', () => {
    expect(goalHistoryInMonthSpec('2026-08-01', '2026-09-01')).toEqual({
      wheres: [
        { field: 'date', op: '>=', value: '2026-08-01' },
        { field: 'date', op: '<', value: '2026-09-01' }
      ],
      orderBy: { field: 'date', dir: 'asc' }
    });
  });

  it('lotes de 30 ids', () => {
    const ids = Array.from({ length: 65 }, (_, i) => `id${i}`);
    expect(chunk(ids).map((c) => c.length)).toEqual([30, 30, 5]);
  });
});

describe('loadWithCountCheck', () => {
  it('usa o cache quando a contagem do servidor bate', async () => {
    const fromServer = vi.fn();
    const r = await loadWithCountCheck({ fromCache: async () => [1, 2], countOnServer: async () => 2, fromServer });
    expect(r).toEqual({ docs: [1, 2], source: 'cache' });
    expect(fromServer).not.toHaveBeenCalled();
  });

  it('busca do servidor quando a contagem difere, o cache está vazio ou falha', async () => {
    const fromServer = async () => [1, 2, 3];
    expect((await loadWithCountCheck({ fromCache: async () => [1, 2], countOnServer: async () => 3, fromServer })).source).toBe('server');
    expect((await loadWithCountCheck({ fromCache: async () => [], countOnServer: async () => 0, fromServer })).source).toBe('server');
    expect((await loadWithCountCheck({ fromCache: async () => { throw new Error('x'); }, countOnServer: async () => 3, fromServer })).docs).toEqual([1, 2, 3]);
  });
});

describe('retryWithBackoff', () => {
  const sleeper = () => vi.fn(async () => {});
  const waits = (sleep) => sleep.mock.calls.map(([ms]) => ms);

  it('deu certo de primeira: não espera', async () => {
    const sleep = sleeper();
    const fn = vi.fn(async () => 'ok');
    await expect(retryWithBackoff(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('tenta de novo com espera crescente até dar certo', async () => {
    const sleep = sleeper();
    let n = 0;
    const fn = vi.fn(async () => { n += 1; if (n < 3) throw new Error('rede'); return 'ok'; });
    await expect(retryWithBackoff(fn, { sleep, baseDelayMs: 100 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(waits(sleep)).toEqual([100, 200]);
  });

  it('depois de 3 novas tentativas, desiste com o último erro', async () => {
    const sleep = sleeper();
    let n = 0;
    const fn = vi.fn(async () => { n += 1; throw new Error(`falha ${n}`); });
    await expect(retryWithBackoff(fn, { sleep, baseDelayMs: 100 })).rejects.toThrow('falha 4');
    expect(fn).toHaveBeenCalledTimes(4);
    expect(waits(sleep)).toEqual([100, 200, 400]);
  });
});

describe('entradas de mês', () => {
  const aberta = { closed: false, interactions: null, leadsCreated: [], history: null };
  const fechada = { closed: true, interactions: [], leadsCreated: [], history: [] };

  it('a entrada vale enquanto o mês segue no estado em que foi carregada', () => {
    expect(monthEntryFits(aberta, '2026-09', '2026-09')).toBe(true);
    expect(monthEntryFits(fechada, '2026-08', '2026-09')).toBe(true);
    expect(monthEntryFits(undefined, '2026-09', '2026-09')).toBe(false);
  });

  it('na virada com a tela aberta, a entrada do mês que fechou deixa de valer', () => {
    expect(monthEntryFits(aberta, '2026-09', '2026-10')).toBe(false);
  });

  it('a busca do mês aberto que termina depois da virada não apaga o mês já recarregado como fechado', () => {
    expect(shouldStoreMonthEntry(undefined, aberta)).toBe(true);
    expect(shouldStoreMonthEntry(aberta, fechada)).toBe(true);
    expect(shouldStoreMonthEntry(fechada, fechada)).toBe(true);
    expect(shouldStoreMonthEntry(fechada, aberta)).toBe(false);
  });

  it('mês que falhou entra carregado, vazio e marcado', () => {
    const f = failedMonthEntry(true);
    expect(f).toEqual({ closed: true, interactions: [], leadsCreated: [], history: [], failed: true });
    expect(monthEntryFits(f, '2026-08', '2026-09')).toBe(true);
  });

  it('no mês corrente que falhou, interações e histórico seguem ao vivo', () => {
    expect(failedMonthEntry(false)).toEqual({ closed: false, interactions: null, leadsCreated: [], history: null, failed: true });
  });
});

describe('leadIdsForRenewal', () => {
  it('pega leads de contratos que vencem entre o início do mês mais antigo e 91 dias depois do mais novo, sem os já carregados', () => {
    const D = (y, m, d) => new Date(y, m - 1, d);
    const contracts = [
      normalizeContract({ id: 'a', leadId: 'A', startsAt: D(2026, 1, 1), endsAt: D(2026, 4, 10) }),
      normalizeContract({ id: 'b', leadId: 'B', startsAt: D(2026, 1, 1), endsAt: D(2026, 12, 10) }),
      normalizeContract({ id: 'c', leadId: 'C', startsAt: D(2026, 1, 1), endsAt: D(2027, 6, 1) }),
      normalizeContract({ id: 'd', leadId: 'D', startsAt: D(2026, 1, 1), endsAt: D(2026, 9, 15) })
    ];
    const ids = leadIdsForRenewal(contracts, { monthKeys: ['2026-04', '2026-09'], known: new Set(['D']) });
    expect(ids.sort()).toEqual(['A', 'B']);
  });
});
