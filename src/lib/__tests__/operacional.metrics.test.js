import { describe, it, expect } from 'vitest';
import { normalizeContract } from '../operacional/base.js';
import { metricsOf, deltaOf, buildHighlights, seriesOf, milestoneMonthsAfter, OTHERS_ID } from '../operacional/metrics.js';

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

  it('sem base de contratos no mês, entraram e upgrades ficam sem número', () => {
    const r = metricsOf(ctx, { monthKey: '2025-12' });
    expect(r.base.known).toBe(false);
    expect(r.entered).toBeNull();
    expect(r.upgrades).toBeNull();
    expect(team.entered).toBe(1);
  });
});

describe('histórico só da própria pessoa (historyOwnerOnly)', () => {
  it('só a pessoa tem meta; equipe, colegas e OTHERS_ID ficam sem número e marcados', () => {
    const ctx = { ...makeCtx(), historyOwnerOnly: 'ana' };
    const ana = metricsOf(ctx, { monthKey: '2026-09', userId: 'ana' });
    expect(ana.metaHidden).toBe(false);
    expect(ana.meta).toEqual(metricsOf(makeCtx(), { monthKey: '2026-09', userId: 'ana' }).meta);
    expect(ana.calendar.length).toBeGreaterThan(0);
    [null, 'diego', OTHERS_ID].forEach((userId) => {
      expect(metricsOf(ctx, { monthKey: '2026-09', userId })).toMatchObject({ meta: null, calendar: [], metaHidden: true });
    });
  });

  it('o resto da tela não muda: prospecção, tarefas e base continuam', () => {
    const team = metricsOf({ ...makeCtx(), historyOwnerOnly: 'ana' }, { monthKey: '2026-09' });
    const full = metricsOf(makeCtx(), { monthKey: '2026-09' });
    expect(team.prosp).toEqual(full.prosp);
    expect(team.tasks).toEqual(full.tasks);
    expect(team.base.active).toBe(full.base.active);
  });

  it('sem a marca ninguém fica escondido; ligar a marca no mesmo ctx não devolve o resultado guardado', () => {
    const ctx = makeCtx();
    expect(metricsOf(ctx, { monthKey: '2026-09' })).toMatchObject({ metaHidden: false, meta: { done: expect.any(Number) } });
    ctx.historyOwnerOnly = 'ana';
    expect(metricsOf(ctx, { monthKey: '2026-09' })).toMatchObject({ meta: null, metaHidden: true });
  });

  it('histórico ainda sem resposta (null): meta sem número, sem a marca, e o resto do mês segue', () => {
    const ctx = makeCtx();
    ctx.months['2026-09'] = { ...ctx.months['2026-09'], history: null };
    const m = metricsOf(ctx, { monthKey: '2026-09' });
    expect(m).toMatchObject({ meta: null, calendar: [], metaHidden: false, hasSource: true });
    expect(m.tasks).not.toBeNull();
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
  const base = { known: true, cancels: { items: [] } };
  const mk = (over) => ({
    tasks: { novos: 10, contatos: 10, agenda: 10, atrasados: 10, renovacoes: 10, vencidos: 10 },
    milestones: [{ days: 30, pct: 70 }],
    upgrades: 5,
    base,
    renewal: { when: { antes: 4, no: 2, depois: 1 } },
    ...over
  });

  it('escolhe as maiores mudanças e marca o que piorou', () => {
    const cur = mk({ milestones: [{ days: 30, pct: 56 }], upgrades: 8, base: { known: true, cancels: { items: [{ name: 'Financeiro', count: 6 }] } } });
    const prev = mk({ base: { known: true, cancels: { items: [{ name: 'Financeiro', count: 3 }] } } });
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

  it('sem base de um dos lados, fica só o que não sai dos contratos', () => {
    const cur = mk({
      upgrades: 8,
      tasks: { ...mk({}).tasks, contatos: 20 },
      renewal: { when: { antes: 9, no: 2, depois: 1 } },
      base: { known: true, cancels: { items: [{ name: 'Financeiro', count: 6 }] } }
    });
    const prev = mk({ base: { known: false, cancels: { items: [] } } });
    expect(buildHighlights(cur, prev, { limit: 10 }).map((x) => x.text)).toEqual(['Contatos concluídos: de 10 para 20']);
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

describe('meses que os marcos alcançam', () => {
  const far = new Date(2027, 5, 1);

  it('[90, 60, 30] continua pedindo só o mês seguinte', () => {
    expect(milestoneMonthsAfter('2026-08', { checkpoints: [90, 60, 30], asOf: far })).toEqual(['2026-09']);
    expect(milestoneMonthsAfter('2026-06', { checkpoints: [90, 60, 30], asOf: far })).toEqual(['2026-07']);
  });

  it('[90, 30] pede dois meses, sem passar do corte', () => {
    expect(milestoneMonthsAfter('2026-08', { checkpoints: [90, 30], asOf: far })).toEqual(['2026-09', '2026-10']);
    expect(milestoneMonthsAfter('2026-08', { checkpoints: [90, 30], asOf: new Date(2026, 8, 11, 14) })).toEqual(['2026-09']);
  });

  it('mês em andamento, ou corte dentro do mês, não pede nada', () => {
    expect(milestoneMonthsAfter('2026-09', { checkpoints: [90, 30], asOf: new Date(2026, 8, 11, 14) })).toEqual([]);
    expect(milestoneMonthsAfter('2026-08', { checkpoints: [90, 60, 30], asOf: new Date(2026, 7, 11, 14) })).toEqual([]);
  });

  it('fevereiro é curto: janeiro com [90, 60, 30] alcança o começo de março', () => {
    expect(milestoneMonthsAfter('2026-01', { checkpoints: [90, 60, 30], asOf: far })).toEqual(['2026-02', '2026-03']);
  });
});

describe('marcos espaçados no metricsOf', () => {
  const empty = () => ({ history: [], interactions: [], leadsCreated: [] });
  // Marco de 90 dias em 30/08. Com [90, 30], o intervalo vai até o marco de 30,
  // em 29/10, e o contato de 02/10 cai dois meses à frente.
  function ctxLongInterval(checkpoints) {
    const ctx = makeCtx();
    ctx.now = new Date(2026, 9, 5, 10);
    ctx.config = { ...ctx.config, renewalCheckpoints: checkpoints };
    ctx.contracts = [...ctx.contracts, C('longe', { endsAt: D(11, 28) })];
    ctx.months = { '2026-08': empty(), '2026-09': empty() };
    return ctx;
  }
  const contatoEmOutubro = { type: 'daily_goal_done', dailyGoalCategory: 'renovacao', leadId: 'longe', createdAt: D(10, 2) };

  it('[90, 30]: sem outubro, agosto fica sem marcos; outubro carregado depois no mesmo ctx, o contato conta', () => {
    const ctx = ctxLongInterval([90, 30]);
    expect(metricsOf(ctx, { monthKey: '2026-08' }).milestones).toBeNull();
    ctx.months['2026-10'] = { ...empty(), interactions: [contatoEmOutubro] };
    expect(metricsOf(ctx, { monthKey: '2026-08' }).milestones.find((m) => m.days === 90)).toEqual({ days: 90, total: 1, done: 1, pct: 100 });
  });

  it('[90, 60, 30]: agosto só precisa de setembro', () => {
    expect(metricsOf(ctxLongInterval([90, 60, 30]), { monthKey: '2026-08' }).milestones).not.toBeNull();
  });
});

describe('prospecção no corte pró-rata', () => {
  it('lead e ação depois do corte das 14h, no mesmo dia, ficam fora do mês comparado', () => {
    const ctx = makeCtx();
    ctx.months['2026-08'] = {
      history: [],
      interactions: [
        { volumeKind: 'mensagem', actorAuthUid: 'u-ana', createdAt: D(8, 11, 9) },
        { volumeKind: 'mensagem', actorAuthUid: 'u-ana', createdAt: D(8, 11, 20) }
      ],
      leadsCreated: [{ id: 'n1', consultantId: 'ana', createdAt: D(8, 11, 20) }]
    };
    expect(metricsOf(ctx, { monthKey: '2026-08', userId: 'ana', cutEnd: D(8, 11, 14) }).prosp.done).toBe(1);
    expect(metricsOf(ctx, { monthKey: '2026-08', userId: 'ana' }).prosp.done).toBe(3);
  });
});

describe('responsável fora da equipe (OTHERS_ID)', () => {
  function ctxWithOutsiders() {
    const ctx = makeCtx();
    ctx.contracts = [
      ...ctx.contracts,
      C('ex-venda', { startsAt: D(9, 3), createdAt: D(9, 3), consultantId: 'ex' }),  // ex-consultor vendeu
      C('sem-dono', { startsAt: D(9, 4), createdAt: D(9, 4), consultantId: null }),  // venda sem consultor
      C('ex-upgrade', { leadId: 'a1', renewedFromId: 'a1', closedFromUpgrade: true, startsAt: D(9, 5), createdAt: D(9, 5), consultantId: 'ex' }),
      C('ex-carteira', { endsAt: D(9, 8), consultantId: 'ex' })                        // vence em setembro, dono fora da equipe
    ];
    ctx.liveLeads = [
      ...ctx.liveLeads,
      { consultantId: 'ex', status: 'Negociação', nextFollowUp: D(9, 2) },
      { consultantId: '', status: 'Novo', nextFollowUp: D(9, 3) }
    ];
    ctx.months['2026-09'].interactions = [
      ...ctx.months['2026-09'].interactions,
      { type: 'daily_goal_done', dailyGoalCategory: 'vencido', leadId: 'y', actorAuthUid: 'u-ex', createdAt: D(9, 3) }
    ];
    return ctx;
  }

  it('só o que é de quem não está em ctx.users; meta e prospecção ficam sem número', () => {
    const others = metricsOf(ctxWithOutsiders(), { monthKey: '2026-09', userId: OTHERS_ID });
    expect(others.meta).toBeNull();
    expect(others.prosp).toBeNull();
    expect(others.entered).toBe(2);
    expect(others.upgrades).toBe(1);
    expect(others.renewal).toMatchObject({ cohort: 1, counts: { lapsed: 1 } });
    expect(others.tasks).toMatchObject({ vencidos: 1, total: 1 });
    expect(others.late.byUser.get(OTHERS_ID)).toBe(2);
  });

  it('pessoas + OTHERS_ID batem com a equipe em entraram, upgrades, renovação e atrasados', () => {
    const ctx = ctxWithOutsiders();
    const ids = [...USERS.map((u) => u.id), OTHERS_ID];
    const team = metricsOf(ctx, { monthKey: '2026-09' });
    const parts = ids.map((userId) => metricsOf(ctx, { monthKey: '2026-09', userId }));
    const sum = (pick) => parts.reduce((a, m) => a + pick(m), 0);
    expect(sum((m) => m.entered)).toBe(team.entered);
    expect(sum((m) => m.upgrades)).toBe(team.upgrades);
    expect(sum((m) => m.renewal.cohort)).toBe(team.renewal.cohort);
    ['renew', 'wont', 'lapsed', 'pending'].forEach((k) => expect(sum((m) => m.renewal.counts[k])).toBe(team.renewal.counts[k]));
    expect(team.late.total).toBe(3);
    expect(ids.reduce((a, id) => a + (team.late.byUser.get(id) || 0), 0)).toBe(team.late.total);
  });
});

describe('marcos de mês fechado', () => {
  const empty = () => ({ history: [], interactions: [], leadsCreated: [] });

  it('sem o mês seguinte carregado, os marcos ficam sem número e saem dos destaques', () => {
    const ctx = makeCtx();
    ctx.contracts = [...ctx.contracts, C('marco', { endsAt: D(12, 4) })]; // marco de 90 dias em 05/09
    ctx.months['2026-09'].interactions.push({ type: 'daily_goal_done', dailyGoalCategory: 'renovacao', leadId: 'marco', createdAt: D(9, 6) });
    ctx.months['2026-06'] = empty();
    const june = metricsOf(ctx, { monthKey: '2026-06' });
    expect(june.milestones).toBeNull();
    const sep = metricsOf(ctx, { monthKey: '2026-09' });
    expect(sep.milestones.find((m) => m.days === 90).pct).toBe(100);
    expect(buildHighlights(sep, june, { limit: 20 }).filter((h) => h.text.includes('marco'))).toEqual([]);
    // Com julho carregado, o contato de 01/07 conta para o marco de 90 dias cruzado em 07/06.
    ctx.months['2026-07'] = { ...empty(), interactions: [{ type: 'daily_goal_done', dailyGoalCategory: 'renovacao', leadId: 'vence', createdAt: D(7, 1) }] };
    expect(metricsOf(ctx, { monthKey: '2026-06' }).milestones.find((m) => m.days === 90)).toMatchObject({ total: 1, done: 1 });
  });

  it('o mês seguinte é o corrente e está carregado: agosto tem número', () => {
    expect(metricsOf(makeCtx(), { monthKey: '2026-08' }).milestones).not.toBeNull();
  });

  it('no corte pró-rata o intervalo para no corte e não precisa do mês seguinte', () => {
    const ctx = makeCtx();
    ctx.months['2026-06'] = empty();
    expect(metricsOf(ctx, { monthKey: '2026-06', cutEnd: D(6, 11, 14) }).milestones).not.toBeNull();
  });
});

describe('mês seguinte que falhou', () => {
  const empty = () => ({ history: [], interactions: [], leadsCreated: [] });

  it('conta como ausente: os marcos ficam sem número, e voltam quando ele carrega', () => {
    const ctx = makeCtx();
    ctx.months['2026-06'] = empty();
    ctx.months['2026-07'] = { ...empty(), failed: true };
    expect(metricsOf(ctx, { monthKey: '2026-06' }).milestones).toBeNull();
    ctx.months['2026-07'] = empty();
    expect(metricsOf(ctx, { monthKey: '2026-06' }).milestones).not.toBeNull();
  });

  it('[90, 30] pede três meses para dezembro e janeiro fora de ano bissexto, porque fevereiro é curto', () => {
    const far = new Date(2027, 5, 1);
    expect(milestoneMonthsAfter('2026-01', { checkpoints: [90, 30], asOf: far })).toEqual(['2026-02', '2026-03', '2026-04']);
    expect(milestoneMonthsAfter('2025-12', { checkpoints: [90, 30], asOf: far })).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(milestoneMonthsAfter('2026-11', { checkpoints: [90, 30], asOf: far })).toEqual(['2026-12', '2027-01']);
  });

  it('em ano bissexto, [90, 30] pede dois meses para dezembro e janeiro', () => {
    const far = new Date(2028, 11, 1);
    expect(milestoneMonthsAfter('2028-01', { checkpoints: [90, 30], asOf: far })).toEqual(['2028-02', '2028-03']);
    expect(milestoneMonthsAfter('2027-12', { checkpoints: [90, 30], asOf: far })).toEqual(['2028-01', '2028-02']);
  });
});

describe('histórico sem assinatura nenhuma (historyUnavailable)', () => {
  it('ninguém tem meta, nem a própria pessoa, e todo recorte fica marcado', () => {
    const ctx = { ...makeCtx(), historyOwnerOnly: 'ana', historyUnavailable: true };
    ['ana', 'diego', null].forEach((userId) => {
      expect(metricsOf(ctx, { monthKey: '2026-09', userId })).toMatchObject({ meta: null, calendar: [], metaHidden: true });
    });
  });

  it('ligar a marca no mesmo ctx não devolve o resultado guardado', () => {
    const ctx = { ...makeCtx(), historyOwnerOnly: 'ana' };
    expect(metricsOf(ctx, { monthKey: '2026-09', userId: 'ana' }).metaHidden).toBe(false);
    ctx.historyUnavailable = true;
    expect(metricsOf(ctx, { monthKey: '2026-09', userId: 'ana' }).metaHidden).toBe(true);
  });
});
