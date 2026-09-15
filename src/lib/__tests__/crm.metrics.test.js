import { describe, it, expect } from 'vitest';
import { metricsOf, crmDelta, bestChannelOf, buildCrmHighlights, seriesOf, OTHERS_ID } from '../crm/metrics.js';
import { comparisonCut } from '../operacional/month.js';

const NOW = new Date(2026, 8, 14, 12, 0);
const D = (m, d, h = 10, min = 0) => new Date(2026, m - 1, d, h, min);
const USERS = [{ id: 'ana', name: 'Ana Ribeiro' }, { id: 'diego', name: 'Diego Santos' }];
const FUNNELS = [
  { id: 'ven', name: 'Vendas', isDefault: true, order: 0 },
  { id: 'ind', name: 'Indicações', systemKind: 'referral', order: 1 },
  { id: 'ren', name: 'Renovações', systemKind: 'renewal', order: 98 }
];
const STATUSES = [
  { name: 'Novo lead', funnelId: 'ven', order: 0 },
  { name: 'Contato feito', funnelId: 'ven', order: 1 },
  { name: 'Aguardando ação', funnelId: 'ind', order: 0 }
];
const L = (id, over) => ({ id, consultantId: 'ana', funnelId: 'ven', source: 'Instagram', status: 'Novo lead', createdAt: D(9, 2), ...over });
const N = (id, leadId, at, text = 'Falei com a pessoa') => ({ id, leadId, type: 'note', text, createdAt: at });
const MV = (id, leadId, from, to, at) => ({ id, leadId, type: 'status_change', fromStatus: from, toStatus: to, funnelId: 'ven', createdAt: at });
const A = (id, leadId, status, at, booked, over = {}) => ({ id, leadId, type: 'aula', status, scheduledFor: at, createdAt: booked, ...over });

const s1 = L('s1', { status: 'Venda', isConverted: true, convertedAt: D(9, 5) });
const s2 = L('s2', { consultantId: 'diego', source: 'Indicação', funnelId: 'ind', nextFollowUp: null });
const s3 = L('s3', { status: 'Perda', lostAt: D(9, 6), lossReason: 'Preço' });
const s4 = L('s4', { consultantId: 'diego', createdAt: D(9, 13), nextFollowUp: D(9, 15) });
const s5 = L('s5', { consultantId: 'ex', nextFollowUp: null });
const imp = L('imp', { importBatchId: 'lote', source: 'Importação' });
const ren = L('ren', { funnelId: 'ren' });
const o1 = L('o1', { consultantId: 'diego', createdAt: D(8, 10), status: 'Venda', isConverted: true, convertedAt: D(9, 8) });
const a1 = L('a1', { createdAt: D(8, 3), status: 'Venda', isConverted: true, convertedAt: D(8, 20) });
const a2 = L('a2', { consultantId: 'diego', source: 'Site', createdAt: D(8, 5), nextFollowUp: D(9, 20) });
const a3 = L('a3', { createdAt: D(8, 12), nextFollowUp: null });

// Setembro em andamento (até dia 14, meio-dia) e agosto fechado.
function makeCtx() {
  const everyone = [s1, s2, s3, s4, s5, imp, ren, o1, a1, a2, a3];
  return {
    now: NOW,
    users: USERS,
    funnels: FUNNELS,
    statuses: STATUSES,
    liveLeads: [s2, s4, s5, a2, a3],
    leadsById: new Map(everyone.map((l) => [l.id, l])),
    months: {
      '2026-09': {
        leadsCreated: [s1, s2, s3, s4, s5, imp, ren],
        converted: [s1, o1],
        lost: [s3],
        aulas: [
          A('r1', 's1', 'attended', D(9, 4), D(9, 3), { professorId: 'p1', professorName: 'Paula Nunes', modality: 'Funcional', converted: true }),
          A('r2', 's2', 'no_show', D(9, 5), D(9, 3), { type: 'visita' }),
          A('r3', 's4', 'agendada', D(9, 20), D(9, 13), { professorId: 'p1', professorName: 'Paula Nunes' })
        ],
        interactions: [
          N('i1', 's1', D(9, 2, 10, 30)),
          N('i2', 's2', D(9, 3, 12)),
          N('i3', 's3', D(9, 2, 10), 'OBSERVAÇÃO DO CADASTRO: veio pelo Instagram'),
          N('i4', 's5', D(9, 2, 15)),
          MV('m1', 's1', 'Novo lead', 'Contato feito', D(9, 3)),
          MV('m2', 's3', 'Novo lead', 'Contato feito', D(9, 4)),
          MV('m4', 's1', 'Contato feito', 'Venda', D(9, 5)),
          MV('m3', 's3', 'Contato feito', 'Perda', D(9, 6))
        ]
      },
      '2026-08': {
        leadsCreated: [a1, a2, a3, o1],
        converted: [a1],
        lost: [],
        aulas: [A('r4', 'a1', 'attended', D(8, 8), D(8, 6), { professorId: 'p1', professorName: 'Paula Nunes', modality: 'Musculação', converted: true })],
        interactions: [N('j1', 'a1', D(8, 3, 10, 20)), N('j2', 'a2', D(8, 7)), N('j3', 'o1', D(8, 10, 10, 45))]
      }
    }
  };
}

describe('metricsOf', () => {
  const ctx = makeCtx();
  const team = metricsOf(ctx, { monthKey: '2026-09' });

  it('faixa do mês em andamento, sem importado e sem funil de cliente', () => {
    expect(team).toMatchObject({ running: true, hasSource: true, leads: 5, enroll: 2, fromCohort: 1 });
    expect(team.appts).toEqual({ total: 2, came: 1, missed: 1, pending: 0, decided: 2, rate: 50 });
    expect(team.cohort).toEqual({ leads: 5, sched: 3, came: 1, enrolled: 1, lost: 1, open: 3, conv: 20 });
    expect(team.channels).toEqual([
      { name: 'Instagram', leads: 4, enrolled: 1 },
      { name: 'Indicação', leads: 1, enrolled: 0 }
    ]);
  });

  it('o desfecho da visita vem da interação da Meta e da tela de Visitas', () => {
    const withVisit = makeCtx();
    const sep = withVisit.months['2026-09'];
    withVisit.months['2026-09'] = {
      ...sep,
      aulas: [...sep.aulas, A('r5', 's5', 'agendada', D(9, 10, 18), D(9, 8), { type: 'visita' })],
      interactions: [...sep.interactions, {
        id: 'g1', leadId: 's5', type: 'daily_goal_done', dailyGoalCategory: 'visita_hoje', appointmentOutcome: 'attended', createdAt: D(9, 10, 19)
      }]
    };
    const m = metricsOf(withVisit, { monthKey: '2026-09' });
    expect(m.appts).toEqual({ total: 3, came: 2, missed: 1, pending: 0, decided: 3, rate: 67 });
    expect(m.cohort).toMatchObject({ sched: 4, came: 2 });
  });

  it('a equipe é a soma das pessoas e de Outros', () => {
    const parts = ['ana', 'diego', OTHERS_ID].map((userId) => metricsOf(ctx, { monthKey: '2026-09', userId }));
    const sum = (pick) => parts.reduce((a, m) => a + pick(m), 0);
    expect(sum((m) => m.leads)).toBe(team.leads);
    expect(sum((m) => m.enroll)).toBe(team.enroll);
    expect(sum((m) => m.appts.total)).toBe(team.appts.total);
    expect(parts[0].cohort).toMatchObject({ leads: 2, enrolled: 1, lost: 1, conv: 50 });
  });

  it('os funis de lead somados dão Todos os funis', () => {
    const ven = metricsOf(ctx, { monthKey: '2026-09', funnelId: 'ven' });
    const ind = metricsOf(ctx, { monthKey: '2026-09', funnelId: 'ind' });
    expect(ven.leads + ind.leads).toBe(team.leads);
  });

  it('perdas, etapa da perda, primeiro contato e dias até a matrícula', () => {
    expect(team.losses).toMatchObject({ total: 1, reasons: [{ name: 'Preço', count: 1 }] });
    expect(team.losses.leads.map((l) => l.id)).toEqual(['s3']);
    expect(team.lossStages).toEqual([{ name: 'Contato feito', count: 1 }]);
    // s4, cadastrado em 13/09 às 10h, está sem contato e já passou de 24 horas no limite (14/09 às 12h).
    expect(team.firstContact).toEqual({ total: 5, h1: 1, h24: 1, over: 2, none: 1, noneLate: 1, median: 1560 });
    expect(team.daysToEnroll).toEqual({ total: 2, buckets: [0, 1, 0, 0, 1, 0], median: 16 });
  });

  it('passagem só com funil escolhido e só a partir de setembro de 2026', () => {
    expect(team.passage).toBeNull();
    const ven = metricsOf(ctx, { monthKey: '2026-09', funnelId: 'ven' });
    // Todos foram cadastrados antes de 14/09 às 18h10, quando o registro da
    // troca entrou: ninguém entra pelo cadastro e a primeira etapa fica sem mediana.
    expect(ven.passage.rows.map((r) => [r.name, r.entered, r.advanced, r.lost, r.medianMin])).toEqual([
      ['Novo lead', 0, 0, 0, null],
      ['Contato feito', 2, 1, 1, 2880]
    ]);
    const aug = metricsOf(ctx, { monthKey: '2026-08', funnelId: 'ven' });
    expect(aug).toMatchObject({ stageBase: false, passage: null, lossStages: null, apptsBase: false });
  });

  it('carteira agora só no mês em andamento e sem corte', () => {
    expect(team.now).toEqual({
      total: 5,
      noNext: 3,
      rows: [{ id: 'ven', name: 'Vendas', count: 4 }, { id: 'ind', name: 'Indicações', count: 1 }]
    });
    expect(metricsOf(ctx, { monthKey: '2026-08' }).now).toBeNull();
    expect(metricsOf(ctx, { monthKey: '2026-09', cutEnd: D(9, 10) }).now).toBeNull();
  });

  it('professores da academia inteira, iguais com pessoa filtrada', () => {
    expect(team.professors.rows.map((p) => [p.name, p.done, p.enrolled, p.conv])).toEqual([['Paula Nunes', 1, 1, 100]]);
    expect(metricsOf(ctx, { monthKey: '2026-09', userId: 'diego' }).professors).toBe(team.professors);
  });

  it('o comparado pró-rata acompanha a safra só até o corte', () => {
    const cut = comparisonCut('2026-09', '2026-08', NOW);
    expect(cut).toEqual(D(8, 14, 12));
    expect(metricsOf(ctx, { monthKey: '2026-08', cutEnd: cut }).cohort).toMatchObject({ leads: 4, enrolled: 0, conv: 0 });
    expect(metricsOf(ctx, { monthKey: '2026-08' }).cohort).toMatchObject({ leads: 4, enrolled: 2, conv: 50 });
  });

  it('com corte, a safra vai até o corte mesmo quando ele cai no fim do mês comparado', () => {
    const end = D(9, 1, 0);
    const m = metricsOf(ctx, { monthKey: '2026-08', cutEnd: end });
    expect(m.asOf).toEqual(end);
    // o1 matriculou em 08/09, depois do corte: segue em jogo.
    expect(m.cohort).toMatchObject({ leads: 4, enrolled: 1, open: 3 });
  });

  it('o espelho em aberto do lead é o retrato de hoje: vale quando a safra vai até agora e sai quando ela é cortada antes', () => {
    const mirrored = makeCtx();
    const mirror = { appointmentScheduledFor: { toDate: () => D(10, 2) } };
    mirrored.leadsById = new Map([...mirrored.leadsById, ['a3', { ...a3, ...mirror }], ['s5', { ...s5, ...mirror }]]);
    const sched = (monthKey, cutEnd = null) => metricsOf(mirrored, { monthKey, cutEnd }).cohort.sched;
    // Mês em andamento: o fim efetivo é agora, e a safra vai até agora.
    expect(sched('2026-09')).toBe(4);
    // O corte sai do instante, não de haver cutEnd: cortar em agora é não cortar.
    expect(sched('2026-09', NOW)).toBe(4);
    // Mês fechado sem corte: até agora.
    expect(sched('2026-08')).toBe(2);
    // Com corte antes de agora, inclusive no fim do mês comparado: sem o retrato de hoje.
    expect(sched('2026-08', D(9, 1, 0))).toBe(1);
    expect(sched('2026-08', D(8, 14, 12))).toBe(1);
  });

  it('mês sem fonte fica sem número; as marcas de base seguem as datas', () => {
    const jul = metricsOf(ctx, { monthKey: '2026-07' });
    expect(jul).toMatchObject({ hasSource: false, leads: null, appts: null, cohort: null, now: null, apptsBase: false, stageBase: false });
  });

  it('mês que falhou fica com fonte, marcado e sem número, e a tendência pula ele', () => {
    const withFail = makeCtx();
    withFail.months['2026-07'] = { failed: true, interactions: [], leadsCreated: [], converted: [], lost: [], aulas: [] };
    expect(metricsOf(withFail, { monthKey: '2026-07' })).toMatchObject({
      hasSource: true, failed: true, leads: null, appts: null, enroll: null, cohort: null,
      losses: null, lossStages: null, firstContact: null, daysToEnroll: null, professors: null
    });
    expect(seriesOf(withFail, { monthKey: '2026-09', pick: (m) => m.leads }).map((p) => p.key)).toEqual(['2026-08', '2026-09']);
    // O retrato de agora vem dos leads ao vivo e continua no mês em andamento que
    // falhou. Um objeto de meses novo zera o cache do ctx.
    withFail.months = { ...withFail.months, '2026-09': { ...withFail.months['2026-09'], failed: true } };
    expect(metricsOf(withFail, { monthKey: '2026-09' })).toMatchObject({ failed: true, leads: null, now: { total: 5 } });
  });

  it('o primeiro contato fica sem número quando a safra passa do fim do mês e o mês seguinte não carregou ou falhou', () => {
    const noSep = makeCtx();
    delete noSep.months['2026-09'];
    expect(metricsOf(noSep, { monthKey: '2026-08' }).firstContact).toBeNull();
    const failedSep = makeCtx();
    failedSep.months['2026-09'] = { ...failedSep.months['2026-09'], failed: true };
    expect(metricsOf(failedSep, { monthKey: '2026-08' }).firstContact).toBeNull();
    // Com o corte dentro do mês, o mês seguinte não faz falta.
    expect(metricsOf(noSep, { monthKey: '2026-08', cutEnd: D(8, 14, 12) }).firstContact).toMatchObject({ total: 4 });
    expect(metricsOf(makeCtx(), { monthKey: '2026-08' }).firstContact).toMatchObject({ total: 4 });
  });

  it('registro remarcado entre meses: vale a cópia do mês mais novo', () => {
    const moved = makeCtx();
    const rx = (status, at) => A('rx', 'a2', status, at, D(8, 20));
    // Na ordem do hook, do mês mais antigo ao mais novo. Agosto ainda guarda a
    // cópia de antes da remarcação de 30/08 para 03/09.
    moved.months = {
      '2026-08': { ...moved.months['2026-08'], aulas: [...moved.months['2026-08'].aulas, rx('agendada', D(8, 30))] },
      '2026-09': { ...moved.months['2026-09'], aulas: [...moved.months['2026-09'].aulas, rx('attended', D(9, 3))] }
    };
    const aug = metricsOf(moved, { monthKey: '2026-08' });
    expect(aug.appts).toMatchObject({ total: 1, came: 1, pending: 0 });
    expect(aug.cohort).toMatchObject({ sched: 2, came: 2 });
    expect(metricsOf(moved, { monthKey: '2026-09' }).appts).toMatchObject({ total: 3, came: 2, missed: 1 });
  });

  it('mesmo ctx e mesmo recorte devolvem o mesmo objeto', () => {
    expect(metricsOf(ctx, { monthKey: '2026-09' })).toBe(team);
  });
});

describe('crmDelta', () => {
  it('contagem em %, taxa em p.p., duração e dias', () => {
    expect(crmDelta(56, 48)).toEqual({ up: true, value: expect.any(Number), text: '16,7%' });
    expect(crmDelta(18, 20, { kind: 'pp' })).toMatchObject({ up: false, text: '−2 p.p.' });
    expect(crmDelta(20, 12, { kind: 'pp' })).toMatchObject({ up: true, text: '+8 p.p.' });
    expect(crmDelta(130, 170, { kind: 'min' })).toMatchObject({ up: false, text: '40 min' });
    expect(crmDelta(6, 7.5, { kind: 'days' })).toMatchObject({ up: false, text: '1,5 dias' });
  });

  it('sem base, comparado com zero e igual', () => {
    expect(crmDelta(null, 5)).toEqual({ none: true, text: 'sem base' });
    expect(crmDelta(5, 0)).toEqual({ none: true, text: 'sem base' });
    expect(crmDelta(5, 5)).toEqual({ flat: true, value: 0, text: '= 0%' });
    expect(crmDelta(30, 30, { kind: 'pp' })).toMatchObject({ flat: true, text: '= 0 p.p.' });
  });

  it('duração e dias que arredondam a zero no texto são iguais', () => {
    expect(crmDelta(130.3, 130.1, { kind: 'min' })).toEqual({ flat: true, value: 0, text: '= 0 min' });
    expect(crmDelta(130.6, 130, { kind: 'min' })).toMatchObject({ up: true, text: '1 min' });
    expect(crmDelta(6.04, 6, { kind: 'days' })).toEqual({ flat: true, value: 0, text: '= 0 dias' });
  });
});

describe('destaques', () => {
  const ctx = makeCtx();
  const cur = metricsOf(ctx, { monthKey: '2026-09' });
  const cmp = metricsOf(ctx, { monthKey: '2026-08', cutEnd: comparisonCut('2026-09', '2026-08', NOW) });

  it('melhor canal só entre os que trouxeram ao menos 5 leads', () => {
    expect(bestChannelOf(cur)).toBeNull();
    expect(bestChannelOf({ channels: [{ name: 'Site', leads: 5, enrolled: 2 }, { name: 'Instagram', leads: 9, enrolled: 1 }] }))
      .toMatchObject({ name: 'Site', conv: 40 });
  });

  it('o canal só é comparado quando o mesmo canal também trouxe ao menos 5 leads no comparado', () => {
    const month = (channels) => ({ hasSource: true, firstContact: null, channels });
    const site = { name: 'Site', leads: 5, enrolled: 2 };
    expect(buildCrmHighlights(month([site]), month([site]), { cmpName: 'agosto' })).toEqual([{
      text: 'Site converteu 40%, a melhor taxa entre os canais',
      delta: '= 0 p.p.',
      tone: 'flat',
      verdict: 'igual a agosto',
      rank: 1
    }]);
    expect(buildCrmHighlights(month([site]), month([{ name: 'Site', leads: 1, enrolled: 1 }]), { cmpName: 'agosto' })).toEqual([]);
  });

  it('leads acima de 24 horas sem contato, com veredito e o pior primeiro no celular', () => {
    expect(buildCrmHighlights(cur, cmp, { cmpName: 'agosto' })).toEqual([{
      text: '3 dos 5 leads passaram de 24 horas sem primeiro contato',
      delta: '▲ 50%',
      tone: 'bad',
      verdict: 'pior que agosto',
      rank: 0
    }]);
  });

  it('sem o comparado não há destaque', () => {
    expect(buildCrmHighlights(cur, null, { cmpName: 'agosto' })).toEqual([]);
    expect(buildCrmHighlights(cur, metricsOf(ctx, { monthKey: '2026-07' }), { cmpName: 'julho' })).toEqual([]);
  });
});

describe('seriesOf', () => {
  it('seis meses até o exibido, sem os meses sem fonte; agendamento só desde setembro de 2026', () => {
    const ctx = makeCtx();
    expect(seriesOf(ctx, { monthKey: '2026-09', pick: (m) => m.leads }))
      .toEqual([{ key: '2026-08', value: 4 }, { key: '2026-09', value: 5 }]);
    expect(seriesOf(ctx, { monthKey: '2026-09', pick: (m) => m.appts?.total ?? null, apptsBased: true }))
      .toEqual([{ key: '2026-09', value: 2 }]);
  });
});
