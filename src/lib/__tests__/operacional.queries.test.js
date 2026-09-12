import { describe, it, expect, vi } from 'vitest';
import {
  monthWindowSpec, interactionsInMonthSpec, leadsCreatedInMonthSpec, goalHistorySinceSpec,
  chunk, loadWithCountCheck, leadIdsForRenewal
} from '../operacional/queries.js';
import { normalizeContract } from '../operacional/base.js';

describe('specs de consulta', () => {
  it('toda consulta por mês é de campo único: range e orderBy no mesmo campo', () => {
    const specs = [
      interactionsInMonthSpec(0, 10),
      leadsCreatedInMonthSpec(0, 10),
      goalHistorySinceSpec('2026-04-01'),
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
