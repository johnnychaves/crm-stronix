import { describe, it, expect } from 'vitest';
import {
  docsFromServerOrThrow, newestCreatedAtOf, leadsWindowSince, mergeNewLeads, monthHistory, currentMonthLeadsWindow
} from '../operacional/queries.js';
import { metaDaysOfMonth } from '../operacional/month.js';
import { prospectionSummary, pickProspection, isImportCreatedLead } from '../operacional/routine.js';

const T = (d, h = 10, min = 0) => new Date(2026, 8, d, h, min);

describe('resposta do servidor ou falha', () => {
  it('resposta que veio do cache do aparelho (sem rede) é falha', () => {
    let err = null;
    try { docsFromServerOrThrow({ metadata: { fromCache: true }, docs: [1] }); } catch (e) { err = e; }
    expect(err?.code).toBe('unavailable');
  });

  it('resposta do servidor devolve os docs', () => {
    expect(docsFromServerOrThrow({ metadata: { fromCache: false }, docs: [1, 2] })).toEqual([1, 2]);
    expect(docsFromServerOrThrow({ docs: [3] })).toEqual([3]);
  });
});

describe('âncora da busca incremental', () => {
  it('maior createdAt real; lead sem data real não conta', () => {
    expect(newestCreatedAtOf([
      { id: 'a', createdAt: T(10) },
      { id: 'b', createdAt: T(12, 9) },
      { id: 'c', createdAt: T(20), createdAtMissing: true },
      { id: 'd' }
    ])).toBe(T(12, 9).getTime());
    expect(newestCreatedAtOf([])).toBeNull();
    expect(newestCreatedAtOf(undefined)).toBeNull();
  });

  it('aparelho adiantado: a âncora é o lead mais novo do servidor, não o relógio do aparelho', () => {
    // A busca "aconteceu" às 14h10 pelo relógio do aparelho; o lead mais novo que o servidor devolveu é das 13h55.
    const entry = { closed: false, fetchedAt: T(12, 14, 10).getTime(), newestCreatedAt: T(12, 13, 55).getTime() };
    expect(leadsWindowSince(entry)).toBe(T(12, 13, 55).getTime());
    expect(currentMonthLeadsWindow('2026-09', leadsWindowSince(entry)).from).toBe(T(12, 13, 53).getTime());
  });

  it('aparelho atrasado: vale o instante da busca, o mais cedo dos dois', () => {
    const entry = { closed: false, fetchedAt: T(12, 13, 50).getTime(), newestCreatedAt: T(12, 13, 58).getTime() };
    expect(leadsWindowSince(entry)).toBe(T(12, 13, 50).getTime());
  });

  it('nada visto ainda: sem âncora, a busca pega o mês inteiro', () => {
    expect(leadsWindowSince({ closed: false, fetchedAt: T(12, 14).getTime() })).toBeNull();
    expect(leadsWindowSince(undefined)).toBeNull();
    expect(currentMonthLeadsWindow('2026-09', null).from).toBe(new Date(2026, 8, 1).getTime());
  });

  it('a união guarda o lead mais novo já visto, e uma busca antiga que chega depois não recua a âncora', () => {
    const entry = {
      closed: false, interactions: null, history: null,
      leadsCreated: [{ id: 'a', createdAt: T(10) }], fetchedAt: T(12, 9).getTime(), newestCreatedAt: T(10).getTime()
    };
    const r = mergeNewLeads(entry, [{ id: 'n', createdAt: T(12, 13) }], T(12, 14).getTime());
    expect(r.newestCreatedAt).toBe(T(12, 13).getTime());
    const r2 = mergeNewLeads(r, [{ id: 'x', createdAt: T(11) }], T(12, 11).getTime());
    expect(r2.newestCreatedAt).toBe(T(12, 13).getTime());
    expect(r2.leadsCreated.map((l) => l.id)).toEqual(['x', 'a', 'n']);
  });
});

describe('histórico do mês na saída do hook', () => {
  const docs = [{ date: '2026-09-02' }, { date: '2026-08-31' }, { date: 5 }];

  it('mês corrente: o ao vivo, recortado pelo mês', () => {
    expect(monthHistory('2026-09', { isCurrent: true, live: { scope: 'all', docs }, liveReady: true, loaded: {} }))
      .toEqual([{ date: '2026-09-02' }]);
  });

  it('sem resposta da assinatura ainda: null', () => {
    expect(monthHistory('2026-09', { isCurrent: true, live: { scope: 'all', docs: [] }, liveReady: false, loaded: {} })).toBeNull();
  });

  it('assinatura da própria pessoa falhou (docs null): null em todo mês, e a meta fica sem número', () => {
    const live = { scope: 'own', docs: null };
    expect(monthHistory('2026-09', { isCurrent: true, live, liveReady: true, loaded: {} })).toBeNull();
    expect(monthHistory('2026-08', { isCurrent: false, live, liveReady: true, loaded: { history: [{ date: '2026-08-03' }] } })).toBeNull();
  });

  it('assinatura só da pessoa: todo mês sai do ao vivo', () => {
    const live = { scope: 'own', docs };
    expect(monthHistory('2026-08', { isCurrent: false, live, liveReady: true, loaded: { history: [] } })).toEqual([{ date: '2026-08-31' }]);
  });

  it('mês fechado com a equipe: o que veio com ele, e null se a consulta foi negada', () => {
    const live = { scope: 'all', docs };
    expect(monthHistory('2026-08', { isCurrent: false, live, liveReady: true, loaded: { history: [{ date: '2026-08-03' }] } }))
      .toEqual([{ date: '2026-08-03' }]);
    expect(monthHistory('2026-08', { isCurrent: false, live, liveReady: true, loaded: { history: null } })).toBeNull();
  });
});

describe('prospecção sem importação', () => {
  const USERS = [{ id: 'ana', authUid: 'u-ana', name: 'Ana', dailyVolumeTarget: 10 }];
  const DAYS = metaDaysOfMonth('2026-09', [1, 2, 3, 4, 5], new Date(2026, 8, 11, 14));
  const stamps = { importBatchId: 'lote-1', importSource: 'nextfit', importedBy: 'u-admin' };

  it('reconhece o lead que a importação criou, e não o que só casou com a planilha', () => {
    expect(isImportCreatedLead({ source: 'Importação NextFit', ...stamps })).toBe(true);
    expect(isImportCreatedLead({ source: 'Importação por planilha', ...stamps })).toBe(true);
    expect(isImportCreatedLead({ source: 'Instagram', ...stamps })).toBe(false);
    expect(isImportCreatedLead({ source: 'Importação NextFit' })).toBe(false);
    expect(isImportCreatedLead({})).toBe(false);
  });

  it('lead criado pela importação não conta; o cadastrado e o que casou com a planilha contam', () => {
    const leadsCreated = [
      { id: 'cadastrado', consultantId: 'ana', createdAt: T(2) },
      { id: 'importado', consultantId: 'ana', createdAt: T(2), source: 'Importação NextFit', ...stamps },
      { id: 'casou', consultantId: 'ana', createdAt: T(3), source: 'Instagram', ...stamps }
    ];
    const s = prospectionSummary({ users: USERS, interactions: [], leadsCreated, metaDays: DAYS });
    expect(pickProspection(s, 'ana').done).toBe(2);
  });
});
