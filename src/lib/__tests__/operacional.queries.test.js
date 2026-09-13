import { describe, it, expect, vi } from 'vitest';
import {
  monthWindowSpec, interactionsInMonthSpec, leadsCreatedInMonthSpec, goalHistorySinceSpec, goalHistoryInMonthSpec,
  chunk, loadWithCountCheck, retryWithBackoff, monthEntryFits, shouldStoreMonthEntry, failedMonthEntry, leadIdsForRenewal,
  shouldRememberMonthEntry, monthsFromSession, NEW_LEADS_SLACK_MS, currentMonthLeadsWindow, unionById, mergeNewLeads
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

describe('memória da sessão', () => {
  const aberta = { closed: false, interactions: null, leadsCreated: [], history: null, fetchedAt: 1 };
  const fechada = { closed: true, interactions: [], leadsCreated: [], history: [] };

  it('guarda entrada completa, aberta ou fechada', () => {
    expect(shouldRememberMonthEntry(undefined, aberta)).toBe(true);
    expect(shouldRememberMonthEntry(undefined, fechada)).toBe(true);
  });

  it('entrada que falhou nunca entra, para a volta tentar de novo', () => {
    expect(shouldRememberMonthEntry(undefined, failedMonthEntry(true))).toBe(false);
    expect(shouldRememberMonthEntry(aberta, failedMonthEntry(true))).toBe(false);
    expect(shouldRememberMonthEntry(undefined, failedMonthEntry(false))).toBe(false);
  });

  it('mês fechado sem histórico (consulta negada) também fica de fora', () => {
    expect(shouldRememberMonthEntry(undefined, { ...fechada, history: null })).toBe(false);
  });

  it('a busca atrasada do mês ainda aberto não troca o mês já guardado como fechado', () => {
    expect(shouldRememberMonthEntry(aberta, fechada)).toBe(true);
    expect(shouldRememberMonthEntry(fechada, aberta)).toBe(false);
  });

  it('estado inicial: só o que vale agora; a entrada do mês que fechou desde a última visita não volta', () => {
    const memoria = new Map([['2026-08', fechada], ['2026-09', aberta]]);
    expect(monthsFromSession(memoria, '2026-09')).toEqual({ '2026-08': fechada, '2026-09': aberta });
    // Virou o mês com a tela fechada: setembro guardado como aberto fica de fora e recarrega como fechado.
    expect(monthsFromSession(memoria, '2026-10')).toEqual({ '2026-08': fechada });
    expect(monthsFromSession(undefined, '2026-09')).toEqual({});
  });
});

describe('busca incremental dos leads do mês corrente', () => {
  const D = (d, h = 10, min = 0) => new Date(2026, 8, d, h, min).getTime();
  const SEP = { from: new Date(2026, 8, 1).getTime(), to: new Date(2026, 9, 1).getTime() };

  it('primeira busca: o mês inteiro', () => {
    expect(currentMonthLeadsWindow('2026-09')).toEqual(SEP);
  });

  it('depois: desde o instante da última busca menos 2 minutos, até o fim do mês', () => {
    expect(NEW_LEADS_SLACK_MS).toBe(120000);
    expect(currentMonthLeadsWindow('2026-09', D(12, 14))).toEqual({ from: D(12, 13, 58), to: SEP.to });
  });

  it('a folga não volta para antes do início do mês', () => {
    expect(currentMonthLeadsWindow('2026-09', D(1, 0, 1)).from).toBe(SEP.from);
  });

  it('união por id: a versão nova ganha e ninguém se repete', () => {
    const r = unionById([{ id: 'a', v: 1 }, { id: 'b', v: 1 }], [{ id: 'b', v: 2 }, { id: 'c', v: 1 }]);
    expect(r).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 1 }]);
  });

  it('leads novos entram na entrada do mês corrente com o instante da busca', () => {
    const entry = { closed: false, interactions: null, leadsCreated: [{ id: 'a', v: 1 }], history: null, fetchedAt: D(12, 9) };
    const r = mergeNewLeads(entry, [{ id: 'a', v: 2 }, { id: 'n', v: 1 }], D(12, 14));
    expect(r).toEqual({ ...entry, leadsCreated: [{ id: 'a', v: 2 }, { id: 'n', v: 1 }], fetchedAt: D(12, 14) });
    expect(entry.leadsCreated).toEqual([{ id: 'a', v: 1 }]);
  });

  it('busca mais antiga que chega depois só acrescenta quem faltava', () => {
    const entry = { closed: false, interactions: null, leadsCreated: [{ id: 'a', v: 2 }], history: null, fetchedAt: D(12, 14) };
    const r = mergeNewLeads(entry, [{ id: 'a', v: 1 }, { id: 'x', v: 1 }], D(12, 13));
    expect(r.leadsCreated).toEqual([{ id: 'a', v: 2 }, { id: 'x', v: 1 }]);
    expect(r.fetchedAt).toBe(D(12, 14));
  });

  it('entrada ausente, de mês fechado ou que falhou fica como está', () => {
    const fechada = { closed: true, interactions: [], leadsCreated: [], history: [] };
    const falhou = failedMonthEntry(false);
    expect(mergeNewLeads(undefined, [{ id: 'n' }], 1)).toBeUndefined();
    expect(mergeNewLeads(fechada, [{ id: 'n' }], 1)).toBe(fechada);
    expect(mergeNewLeads(falhou, [{ id: 'n' }], 1)).toBe(falhou);
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
