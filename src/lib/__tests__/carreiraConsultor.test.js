// As contas do consultor no plano de carreira (PR 4): cada uma chama a conta
// do painel de origem, e o teste compara as duas num mês fechado.
import { describe, it, expect } from 'vitest';
import {
  consultoresDaCarreira, contasDoConsultor, conversaoDoConsultor, mesesCorridos, mesesDoPeriodo,
  metaDiariaDoConsultor, renovacaoDoConsultor, vendasDoConsultor,
} from '../carreiraConsultor.js';
import { metricsOf as crmMetricsOf } from '../crm/metrics.js';
import { makeCtx, NOW } from './fixtures/crmCtx.js';
import { normalizeContracts } from '../operacional/base.js';
import { salesOf } from '../gerencial/sales.js';
import { sellersOf } from '../gerencial/people.js';
import { renewalCohort, summarizeCohort } from '../operacional/renewal.js';
import { metaDaysOfMonth } from '../operacional/month.js';
import { metaDaysSummary } from '../operacional/routine.js';
import { placarDe } from '../carreira/placar.js';
import { trilhasDe } from '../carreira/trilhas.js';

const P = (a, m, a2, m2) => ({ chave: 'x', inicio: new Date(a, m, 1), fim: new Date(a2, m2, 1) });
const agosto = P(2026, 7, 2026, 8);

describe('meses do período', () => {
  it('vai do início até o mês de agora, sem passar do fim', () => {
    expect(mesesDoPeriodo(P(2025, 11, 2026, 11), new Date(2026, 2, 10))).toEqual(['2025-12', '2026-01', '2026-02', '2026-03']);
    expect(mesesDoPeriodo(P(2025, 11, 2026, 1), new Date(2026, 5, 10))).toEqual(['2025-12', '2026-01']);
    expect(mesesDoPeriodo(P(2026, 11, 2027, 11), new Date(2026, 5, 10))).toEqual([]);
  });

  it('o mês em andamento conta pelos dias corridos', () => {
    // dezembro e janeiro inteiros, mais 10 de 28 dias de fevereiro
    expect(mesesCorridos(P(2025, 11, 2026, 11), new Date(2026, 1, 10, 15))).toBeCloseTo(2 + 10 / 28, 5);
    expect(mesesCorridos(P(2025, 11, 2026, 1), new Date(2026, 5, 10))).toBe(2);
    expect(mesesCorridos(P(2026, 11, 2027, 11), new Date(2026, 5, 10))).toBe(0);
  });
});

describe('quem é consultor na Carreira', () => {
  it('só o papel consultor, em ordem de nome, com a trilha e o nível do cadastro', () => {
    const users = [
      { id: 'g', name: 'Gestora', role: 'admin' },
      { id: 'p', name: 'Professor', role: 'professor' },
      { id: 'b', name: 'Bruno', role: 'consultant', trilhaId: 'consultor', nivel: 'pleno', nivelDesde: '2026-01-01' },
      { id: 'a', name: 'Ana', role: 'consultant' },
    ];
    expect(consultoresDaCarreira(users)).toEqual([
      { id: 'a', nome: 'Ana', photoUrl: null, trilhaId: null, nivel: null, nivelDesde: null },
      { id: 'b', nome: 'Bruno', photoUrl: null, trilhaId: 'consultor', nivel: 'pleno', nivelDesde: '2026-01-01' },
    ]);
  });
});

describe('conversão do consultor', () => {
  const conta = (ctx, id, periodo) => conversaoDoConsultor({ months: ctx.months, leadsById: ctx.leadsById, users: ctx.users, funnels: ctx.funnels, consultantId: id, periodo, agora: NOW });

  it('num mês fechado é a safra por pessoa do painel CRM, e a academia é a equipe toda', () => {
    const ctx = makeCtx();
    const equipe = crmMetricsOf(ctx, { monthKey: '2026-08' }).cohort;
    for (const id of ['ana', 'diego']) {
      const painel = crmMetricsOf(ctx, { monthKey: '2026-08', userId: id }).cohort;
      const r = conta(ctx, id, agosto);
      expect(r.consultor.leads, id).toBe(painel.leads);
      expect(r.consultor.matriculas, id).toBe(painel.enrolled);
      expect(r.consultor.taxa, id).toBe(painel.conv);
      expect(r.academia.leads).toBe(equipe.leads);
      expect(r.academia.matriculas).toBe(equipe.enrolled);
      expect(r.incompleto).toBe(false);
    }
  });

  it('soma os meses do período, e cada lead da lista leva o mês e o desfecho de agora', () => {
    const ctx = makeCtx();
    const ago = crmMetricsOf(ctx, { monthKey: '2026-08', userId: 'ana' }).cohort;
    const set = crmMetricsOf(ctx, { monthKey: '2026-09', userId: 'ana' }).cohort;
    const r = conta(ctx, 'ana', P(2026, 7, 2026, 9));
    expect(r.consultor.leads).toBe(ago.leads + set.leads);
    expect(r.consultor.matriculas).toBe(ago.enrolled + set.enrolled);
    expect(r.linhas).toHaveLength(r.consultor.leads);
    expect(r.linhas.every((l) => ['enrolled', 'lost', 'open'].includes(l.desfecho) && /^2026-0[89]$/.test(l.mes))).toBe(true);
  });

  it('mês sem carga deixa a conta incompleta', () => {
    expect(conta(makeCtx(), 'ana', P(2026, 6, 2026, 8)).incompleto).toBe(true);
  });
});

const contrato = (id, over) => ({
  id, leadId: `l-${id}`, personKey: `p-${id}`, consultantId: 'ana', value: 1200, durationMonths: 12,
  createdAt: new Date(2026, 7, 10), startsAt: new Date(2026, 7, 10), endsAt: new Date(2027, 7, 10), ...over,
});

describe('vendas do consultor', () => {
  const contratos = normalizeContracts([
    contrato('c1'),
    contrato('c2', { value: 600, createdAt: new Date(2026, 7, 20) }),
    contrato('c3', { consultantId: 'diego', value: 900 }),
    contrato('c4', { createdAt: new Date(2026, 8, 3), renewedFromId: 'c1' }),
    contrato('c5', { importBatchId: 'lote', value: 0 }),
  ]);

  it('num mês fechado, o total e a quantidade são os do consultor no Gerencial', () => {
    const { rows, sold } = salesOf(contratos, { start: agosto.inicio, end: agosto.fim });
    const ana = sellersOf(rows, sold).find((s) => s.id === 'ana');
    const r = vendasDoConsultor({ contratos, consultantId: 'ana', periodo: agosto, agora: new Date(2026, 9, 5) });
    expect(r.total).toBe(ana.value);
    expect(r.quantidade).toBe(ana.count);
    expect(r.meses).toBe(1);
    expect(r.porMes).toEqual({ valor: ana.value, quantidade: ana.count });
  });

  it('o mês em andamento divide pelos dias corridos, e a renovação aparece como tal', () => {
    const agora = new Date(2026, 8, 15, 12); // 15 de 30 dias de setembro
    const r = vendasDoConsultor({ contratos, consultantId: 'ana', periodo: P(2026, 7, 2026, 9), agora });
    expect(r.quantidade).toBe(3);
    expect(r.renovacoes).toBe(1);
    expect(r.meses).toBeCloseTo(1.5, 5);
    expect(r.porMes.valor).toBeCloseTo(3000 / 1.5, 5);
    expect(r.linhas[0].contrato.id).toBe('c4');
    expect(r.linhas[0].tipo).toBe('renovacao');
  });

  it('a trilha escolhe o valor do placar: reais ou quantidade por mês', () => {
    const agora = new Date(2026, 9, 5);
    expect(vendasDoConsultor({ contratos, consultantId: 'ana', periodo: agosto, agora, vendasEm: 'quantidade' }).valor).toBe(2);
    expect(vendasDoConsultor({ contratos, consultantId: 'ana', periodo: agosto, agora }).valor).toBe(1800);
  });

  it('sem mês corrido, não há valor', () => {
    expect(vendasDoConsultor({ contratos, consultantId: 'ana', periodo: P(2027, 0, 2027, 11), agora: new Date(2026, 9, 5) }).valor).toBeNull();
  });
});

describe('renovação do consultor', () => {
  const venceu = (id, over) => contrato(id, {
    createdAt: new Date(2025, 7, 10), startsAt: new Date(2025, 7, 10), endsAt: new Date(2026, 7, 10), ...over,
  });
  const contratos = normalizeContracts([
    venceu('v1'),
    venceu('v2'),
    // o lead de v3 é da Ana hoje, mesmo com o contrato vendido pelo Diego
    venceu('v3', { consultantId: 'diego' }),
    contrato('n1', { personKey: 'p-v1', leadId: 'l-v1', renewedFromId: 'v1', createdAt: new Date(2026, 7, 5), startsAt: new Date(2026, 7, 10), endsAt: new Date(2027, 7, 10) }),
  ]);
  const clientesPorId = new Map([['l-v3', { id: 'l-v3', consultantId: 'ana' }]]);
  const agora = new Date(2026, 9, 20);

  it('é a coorte do Operacional filtrada pelo dono de hoje', () => {
    const rows = renewalCohort(contratos, { start: agosto.inicio, end: agosto.fim, asOf: agora, graceDays: 15, leadsById: clientesPorId });
    const painel = summarizeCohort(rows, { owner: 'ana' });
    const r = renovacaoDoConsultor({ contratos, clientesPorId, graceDays: 15, consultantId: 'ana', periodo: agosto, agora });
    expect(r.taxa).toBe(painel.rate);
    expect(r.renovados).toBe(painel.counts.renew);
    expect(r.decididos).toBe(painel.decided);
    expect(r.linhas.map((l) => l.contract.id).sort()).toEqual(['v1', 'v2', 'v3']);
  });

  it('quem ainda está na tolerância fica fora da taxa', () => {
    const r = renovacaoDoConsultor({ contratos, clientesPorId, graceDays: 15, consultantId: 'ana', periodo: agosto, agora: new Date(2026, 7, 15) });
    expect(r.linhas.find((l) => l.contract.id === 'v2').outcome).toBe('pending');
    expect(r.decididos).toBe(1);
  });
});

describe('meta diária do consultor', () => {
  const semana = [1, 2, 3, 4, 5];
  const history = [
    { consultantId: 'ana', date: '2026-08-03' },
    { consultantId: 'ana', date: '2026-08-04' },
    { consultantId: 'ana', date: '2026-08-08' }, // sábado: fora da meta
    { consultantId: 'diego', date: '2026-08-05' },
  ];

  it('num mês fechado é a conta do Operacional', () => {
    const agora = new Date(2026, 9, 1);
    const painel = metaDaysSummary({ users: [{ id: 'ana' }], history, metaDays: metaDaysOfMonth('2026-08', semana, agora) }).byUser.get('ana');
    const r = metaDiariaDoConsultor({ history, metaWeekdays: semana, consultantId: 'ana', periodo: agosto, agora });
    expect(r.bateram).toBe(painel.done);
    expect(r.total).toBe(painel.total);
    expect(r.total).toBe(21);
  });

  it('conta até ontem, sem os dias de folga, do dia mais novo para o mais antigo', () => {
    const r = metaDiariaDoConsultor({ history, metaWeekdays: semana, consultantId: 'ana', periodo: agosto, agora: new Date(2026, 7, 5, 9) });
    expect(r.dias.map((d) => d.key)).toEqual(['2026-08-04', '2026-08-03']);
    expect(r.taxa).toBe(100);
  });
});

describe('contas do consultor para o placar', () => {
  it('devolve os quatro resultados com as chaves dos números da trilha', () => {
    const ctx = makeCtx();
    const trilha = trilhasDe(null).find((t) => t.id === 'consultor');
    const c = contasDoConsultor({
      trilha, periodo: { ...agosto, chave: '2026' }, pessoa: { id: 'ana', nivel: 'junior' },
      crm: { months: ctx.months, leadsById: ctx.leadsById }, users: ctx.users, funnels: ctx.funnels,
      contratos: [], clientesPorId: new Map(), graceDays: 15, metaWeekdays: [1, 2, 3, 4, 5], history: [], agora: NOW,
    });
    expect(Object.keys(c.resultados).sort()).toEqual(['consultorConversao', 'consultorRenovacao', 'metaDiaria', 'vendas']);
    expect(c.resultados.consultorConversao).toEqual({ valor: c.conversao.consultor.taxa, academia: c.conversao.academia.taxa });
    expect(c.resultados.vendas).toEqual({ valor: 0 });
    const placar = placarDe(trilha, 'junior', c.resultados);
    expect(placar.itens.map((i) => i.id)).toEqual(['consultorConversao', 'vendas', 'consultorRenovacao', 'metaDiaria']);
  });
});
