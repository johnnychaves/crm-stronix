import { describe, it, expect } from 'vitest';
import { normalizeContract } from '../operacional/base.js';
import { metricsOf, deltaOf, buildHighlights, seriesOf } from '../operacional/metrics.js';

const NOW = new Date(2026, 8, 11, 14, 0);
const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const USERS = [
  { id: 'ana', authUid: 'u-ana', name: 'Ana Ribeiro', dailyVolumeTarget: 10 },
  { id: 'diego', authUid: 'u-diego', name: 'Diego Santos', dailyVolumeTarget: 10 }
];
const C = (id, over = {}) => normalizeContract({
  id, leadId: id, consultantId: 'ana', status: 'ativo',
  startsAt: D(1, 1), endsAt: D(12, 31), createdAt: D(1, 1), ...over
});

function makeCtx() {
  return {
    now: NOW,
    users: USERS,
    config: { metaWeekdays: [1, 2, 3, 4, 5], renewalCheckpoints: [90, 60, 30], renewalGraceDays: 15 },
    contracts: [
      C('a1'), C('a2', { consultantId: 'diego' }),
      C('novo', { startsAt: D(9, 2), createdAt: D(9, 2), consultantId: 'diego' }),
      C('vence', { endsAt: D(9, 5), consultantId: 'ana' })
    ],
    leadsById: new Map([['vence', { id: 'vence', consultantId: 'diego' }]]),
    liveLeads: [{ consultantId: 'ana', status: 'Novo', nextFollowUp: D(9, 1) }],
    months: {
      '2026-09': {
        history: [{ consultantId: 'ana', date: '2026-09-01' }, { consultantId: 'diego', date: '2026-09-02' }],
        interactions: [{ type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', leadId: 'x', actorAuthUid: 'u-ana', createdAt: D(9, 2) }],
        leadsCreated: []
      },
      '2026-08': { history: [], interactions: [], leadsCreated: [] }
    }
  };
}

describe('metricsOf', () => {
  const ctx = makeCtx();
  const team = metricsOf(ctx, { monthKey: '2026-09' });
  const ana = metricsOf(ctx, { monthKey: '2026-09', userId: 'ana' });
  const diego = metricsOf(ctx, { monthKey: '2026-09', userId: 'diego' });

  it('equipe é a soma das pessoas na rotina', () => {
    expect(team.meta.done).toBe(ana.meta.done + diego.meta.done);
    expect(team.meta.total).toBe(ana.meta.total + diego.meta.total);
    expect(team.tasks.total).toBe(ana.tasks.total + diego.tasks.total);
  });

  it('com pessoa filtrada a base continua da academia', () => {
    expect(ana.base.active).toBe(team.base.active);
    expect(ana.base.churn).toEqual(team.base.churn);
  });

  it('renovação segue o responsável atual pelo cliente', () => {
    expect(diego.renewal.cohort).toBe(1);
    expect(ana.renewal.cohort).toBe(0);
  });

  it('matrícula por vendedor do contrato', () => {
    expect(diego.entered).toBe(1);
    expect(team.entered).toBe(1);
  });

  it('retratos do agora só no mês em andamento sem corte', () => {
    expect(team.late.total).toBe(1);
    expect(team.upcoming).not.toBeNull();
    expect(metricsOf(ctx, { monthKey: '2026-08' }).late).toBeNull();
    expect(metricsOf(ctx, { monthKey: '2026-08', cutEnd: D(8, 11, 14) }).upcoming).toBeNull();
  });

  it('mês sem fonte carregada não inventa rotina', () => {
    const r = metricsOf(ctx, { monthKey: '2026-07' });
    expect(r.meta).toBeNull();
    expect(r.prosp).toBeNull();
    expect(r.tasks).toBeNull();
  });
});

describe('deltaOf', () => {
  it('sem base quando falta o comparado', () => {
    expect(deltaOf(10, null)).toEqual({ none: true, text: 'sem base' });
  });
  it('igual quando não mudou', () => {
    expect(deltaOf(5, 5)).toMatchObject({ flat: true, text: 'igual' });
  });
  it('p.p. para taxa e absoluto para contagem', () => {
    expect(deltaOf(82, 74, { kind: 'pp' })).toMatchObject({ up: true, text: '+8 p.p.' });
    expect(deltaOf(0.5, 1.2, { kind: 'pp' })).toMatchObject({ up: false, text: '−0,7 p.p.' });
    expect(deltaOf(419, 417)).toMatchObject({ up: true, text: '+2' });
  });
});

describe('buildHighlights', () => {
  const base = { cancels: { items: [] } };
  const mk = (over) => ({
    tasks: { novos: 10, contatos: 10, agenda: 10, atrasados: 10, renovacoes: 10, vencidos: 10 },
    milestones: [{ days: 30, pct: 70 }],
    upgrades: 5,
    base,
    renewal: { when: { antes: 4, no: 2, depois: 1 } },
    ...over
  });

  it('escolhe as maiores mudanças e marca o que piorou', () => {
    const cur = mk({ milestones: [{ days: 30, pct: 56 }], upgrades: 8, base: { cancels: { items: [{ name: 'Financeiro', count: 6 }] } } });
    const prev = mk({ base: { cancels: { items: [{ name: 'Financeiro', count: 3 }] } } });
    const h = buildHighlights(cur, prev);
    expect(h).toHaveLength(3);
    expect(h.map((x) => x.text)).toContain('Contatos no marco de 30 dias: de 70% para 56%');
    const cancel = h.find((x) => x.text.startsWith('Cancelamentos'));
    expect(cancel).toMatchObject({ up: true, bad: true, text: 'Cancelamentos por motivo financeiro: de 3 para 6' });
  });

  it('nada mudou, nenhum destaque; sem comparado, nenhum destaque', () => {
    expect(buildHighlights(mk({}), mk({}))).toEqual([]);
    expect(buildHighlights(mk({}), null)).toEqual([]);
  });
});

describe('seriesOf', () => {
  it('pula meses sem fonte e respeita a ordem dos meses', () => {
    const ctx = makeCtx();
    const s = seriesOf(ctx, { monthKey: '2026-09', pick: (m) => m.meta?.pct ?? null });
    expect(s.map((p) => p.key)).toEqual(['2026-08', '2026-09']);
  });
});

describe('metricsOf em cache', () => {
  it('mesma chamada no mesmo ctx devolve o mesmo objeto', () => {
    const ctx = makeCtx();
    const a = metricsOf(ctx, { monthKey: '2026-09', userId: 'ana' });
    expect(metricsOf(ctx, { monthKey: '2026-09', userId: 'ana' })).toBe(a);
    expect(metricsOf(ctx, { monthKey: '2026-09', userId: 'diego' })).not.toBe(a);
    expect(metricsOf(ctx, { monthKey: '2026-08', cutEnd: D(8, 11, 14) }))
      .toBe(metricsOf(ctx, { monthKey: '2026-08', cutEnd: D(8, 11, 14) }));
  });

  it('mudar o ctx invalida, inclusive trocando os contratos no mesmo objeto', () => {
    const ctx = makeCtx();
    const a = metricsOf(ctx, { monthKey: '2026-09' });
    const contracts = [...ctx.contracts, C('extra', { startsAt: D(9, 3), createdAt: D(9, 3) })];
    const b = metricsOf({ ...ctx, contracts }, { monthKey: '2026-09' });
    expect(b).not.toBe(a);
    expect(b.base.active).toBe(a.base.active + 1);
    ctx.contracts = contracts;
    expect(metricsOf(ctx, { monthKey: '2026-09' }).base.active).toBe(a.base.active + 1);
  });

  it('mês carregado depois no mesmo ctx aparece', () => {
    const ctx = makeCtx();
    expect(metricsOf(ctx, { monthKey: '2026-07' }).hasSource).toBe(false);
    ctx.months['2026-07'] = { history: [], interactions: [], leadsCreated: [] };
    expect(metricsOf(ctx, { monthKey: '2026-07' }).hasSource).toBe(true);
  });
});

describe('marcos no metricsOf', () => {
  it('contato no começo do mês seguinte conta para o marco cruzado no fim do mês', () => {
    const empty = { history: [], interactions: [], leadsCreated: [] };
    const ctx = {
      now: new Date(2026, 9, 5, 10),
      users: USERS,
      config: { metaWeekdays: [1, 2, 3, 4, 5], renewalCheckpoints: [30], renewalGraceDays: 15 },
      contracts: [C('m', { startsAt: D(3, 1), createdAt: D(3, 1), endsAt: D(10, 29, 12) })], // marco em 29/09
      leadsById: new Map(),
      liveLeads: [],
      months: {
        '2026-09': empty,
        '2026-10': { ...empty, interactions: [{ type: 'daily_goal_done', dailyGoalCategory: 'renovacao', leadId: 'm', createdAt: D(10, 1) }] }
      }
    };
    expect(metricsOf(ctx, { monthKey: '2026-09' }).milestones).toEqual([{ days: 30, total: 1, done: 1, pct: 100 }]);
  });
});
