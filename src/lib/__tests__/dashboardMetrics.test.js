// Testes das regras de métricas do Dashboard. Cada caso codifica a semântica
// documentada em dashboardMetrics.js: base EVENTO (a data do acontecimento
// caiu no período) vs base SAFRA (leads captados no período, desfecho até
// agora). Datas construídas em horário LOCAL, como o app faz.

import { describe, it, expect } from 'vitest';
import {
  buildPeriodRange,
  buildPreviousRange,
  computeCapturedLeads,
  computeScheduledLeads,
  computeConvertedLeads,
  computeDashboardStats,
  computeFunnelSteps,
  computeAttendance,
  computeTeamMetrics,
  computeFunnelRowMetrics,
  computeFunnelComparisonTotals,
  computeDeltas,
  computeSparklines,
  computeSourceMetrics,
  computeAulasPorModalidade,
  computePendingFollowUps
} from '../dashboardMetrics.js';
import {
  getLeadConversionDateStrict,
  isConvertedStatusName,
  isLeadConverted
} from '../leads.js';

// 9 de julho de 2026, 15:00 local — "agora" de referência dos testes.
const NOW = new Date(2026, 6, 9, 15, 0, 0);
const JULY = { start: new Date(2026, 6, 1, 0, 0, 0, 0), end: new Date(2026, 7, 0, 23, 59, 59, 999) };
const JUNE = { start: new Date(2026, 5, 1, 0, 0, 0, 0), end: new Date(2026, 6, 0, 23, 59, 59, 999) };

let seq = 0;
const lead = (over = {}) => ({
  id: over.id || `l${++seq}`,
  name: 'Lead Teste',
  status: 'Novo',
  createdAt: new Date(2026, 6, 5),
  ...over
});

describe('buildPeriodRange', () => {
  it('monthly cobre o mês civil inteiro', () => {
    const r = buildPeriodRange('monthly', { now: NOW });
    expect(r.start.getTime()).toBe(new Date(2026, 6, 1, 0, 0, 0, 0).getTime());
    expect(r.end.getTime()).toBe(new Date(2026, 7, 0, 23, 59, 59, 999).getTime());
  });

  it('custom interpreta as datas em horário local e valida início ≤ fim', () => {
    const r = buildPeriodRange('custom', { customStart: '2026-07-01', customEnd: '2026-07-20', now: NOW });
    expect(r.start.getTime()).toBe(new Date(2026, 6, 1, 0, 0, 0).getTime());
    expect(r.end.getTime()).toBe(new Date(2026, 6, 20, 23, 59, 59, 999).getTime());
    expect(buildPeriodRange('custom', { customStart: '2026-07-20', customEnd: '2026-07-01', now: NOW })).toBeNull();
    expect(buildPeriodRange('custom', { customStart: '', customEnd: '', now: NOW })).toBeNull();
  });
});

describe('buildPreviousRange (deltas pro-rata)', () => {
  it('mês em curso compara com o MESMO trecho do mês anterior', () => {
    const range = buildPeriodRange('monthly', { now: NOW });
    const prev = buildPreviousRange('monthly', range, NOW);
    expect(prev.partial).toBe(true);
    expect(prev.start.getTime()).toBe(new Date(2026, 5, 1, 0, 0, 0, 0).getTime());
    // decorrido: 8d15h desde 1º/jul 00:00 → 9/jun 15:00
    expect(prev.end.getTime()).toBe(new Date(2026, 5, 9, 15, 0, 0).getTime());
  });

  it('clampa no fim do mês anterior quando ele é mais curto (31 → 30 dias)', () => {
    const now = new Date(2026, 4, 31, 12, 0, 0); // 31/mai 12:00
    const range = buildPeriodRange('monthly', { now });
    const prev = buildPreviousRange('monthly', range, now);
    expect(prev.partial).toBe(true);
    expect(prev.start.getTime()).toBe(new Date(2026, 3, 1, 0, 0, 0, 0).getTime());
    // 1º/abr + 30d12h estouraria abril → clampa em 30/abr 23:59:59.999
    expect(prev.end.getTime()).toBe(new Date(2026, 4, 0, 23, 59, 59, 999).getTime());
  });

  it('período já encerrado (Mês anterior) compara inteiro contra inteiro', () => {
    const range = buildPeriodRange('monthlyPrev', { now: NOW }); // junho
    const prev = buildPreviousRange('monthlyPrev', range, NOW);
    expect(prev.partial).toBe(false);
    expect(prev.start.getTime()).toBe(new Date(2026, 4, 1, 0, 0, 0, 0).getTime());
    expect(prev.end.getTime()).toBe(new Date(2026, 5, 0, 23, 59, 59, 999).getTime());
  });

  it('hoje compara com ontem ATÉ A MESMA HORA', () => {
    const range = buildPeriodRange('today', { now: NOW });
    const prev = buildPreviousRange('today', range, NOW);
    expect(prev.partial).toBe(true);
    expect(prev.start.getTime()).toBe(new Date(2026, 6, 8, 0, 0, 0, 0).getTime());
    expect(prev.end.getTime()).toBe(new Date(2026, 6, 8, 15, 0, 0).getTime());
  });

  it('semana em curso desloca 7 dias e corta no mesmo ponto decorrido', () => {
    const range = buildPeriodRange('weekly', { now: NOW });
    const prev = buildPreviousRange('weekly', range, NOW);
    const DAY = 86400000;
    expect(prev.partial).toBe(true);
    expect(prev.start.getTime()).toBe(range.start.getTime() - 7 * DAY);
    expect(prev.end.getTime()).toBe(prev.start.getTime() + (NOW.getTime() - range.start.getTime()));
  });

  it('custom encerrado usa janela cheia imediatamente anterior; em curso usa pro-rata', () => {
    const done = buildPeriodRange('custom', { customStart: '2026-06-01', customEnd: '2026-06-10', now: NOW });
    const prevDone = buildPreviousRange('custom', done, NOW);
    expect(prevDone.partial).toBe(false);
    expect(prevDone.end.getTime()).toBe(done.start.getTime() - 1);
    expect(prevDone.end.getTime() - prevDone.start.getTime()).toBe(done.end.getTime() - done.start.getTime());

    const open = buildPeriodRange('custom', { customStart: '2026-07-01', customEnd: '2026-07-20', now: NOW });
    const prevOpen = buildPreviousRange('custom', open, NOW);
    expect(prevOpen.partial).toBe(true);
    expect(prevOpen.start.getTime()).toBe(new Date(2026, 5, 11, 0, 0, 0, 0).getTime());
    // decorrido 8d15h → 19/jun 15:00
    expect(prevOpen.end.getTime()).toBe(new Date(2026, 5, 19, 15, 0, 0).getTime());
  });
});

describe('computeCapturedLeads (EVENTO captação)', () => {
  it('conta createdAt dentro do período e exclui lead sem createdAt real', () => {
    const inRange = lead({ createdAt: new Date(2026, 6, 3) });
    const outRange = lead({ createdAt: new Date(2026, 5, 20) });
    const missing = lead({ createdAt: NOW, createdAtMissing: true });
    const result = computeCapturedLeads([inRange, outRange, missing], JULY);
    expect(result.map(l => l.id)).toEqual([inRange.id]);
  });
});

describe('computeConvertedLeads (EVENTO matrícula)', () => {
  it('lead captado em junho e convertido em julho conta em JULHO, não em junho', () => {
    const l = lead({ createdAt: new Date(2026, 5, 5), convertedAt: new Date(2026, 6, 3), status: 'Venda', isConverted: true });
    expect(computeConvertedLeads([l], JULY).length).toBe(1);
    expect(computeConvertedLeads([l], JUNE).length).toBe(0);
  });

  it('lead legado convertido SEM convertedAt fica atribuído ao período de captação', () => {
    const legacy = lead({ createdAt: new Date(2026, 5, 5), status: 'Matriculado 2024' });
    expect(computeConvertedLeads([legacy], JUNE).length).toBe(1);
    expect(computeConvertedLeads([legacy], JULY).length).toBe(0);
  });

  it('aceita convertedAt no formato Timestamp do Firestore ({ seconds })', () => {
    const ts = { seconds: Math.floor(new Date(2026, 6, 3).getTime() / 1000) };
    const l = lead({ createdAt: new Date(2026, 5, 5), convertedAt: ts, status: 'Venda' });
    expect(computeConvertedLeads([l], JULY).length).toBe(1);
  });
});

describe('computeDashboardStats', () => {
  const capturedConverted = lead({ createdAt: new Date(2026, 6, 2), convertedAt: new Date(2026, 6, 6), status: 'Venda', isConverted: true });
  const capturedPlain = lead({ createdAt: new Date(2026, 6, 3) });
  const oldConverted = lead({ createdAt: new Date(2026, 4, 10), convertedAt: new Date(2026, 6, 4), status: 'Venda', isConverted: true });
  const visitPast = lead({ createdAt: new Date(2026, 6, 2), appointmentType: 'visita', appointmentScheduledFor: new Date(2026, 6, 3, 10, 0) });
  const visitFuture = lead({ createdAt: new Date(2026, 5, 20), appointmentType: 'visita', appointmentScheduledFor: new Date(2026, 6, 20, 10, 0) });

  const leads = [capturedConverted, capturedPlain, oldConverted, visitPast, visitFuture];
  const captured = computeCapturedLeads(leads, JULY);
  const scheduled = computeScheduledLeads(leads, JULY);
  const converted = computeConvertedLeads(leads, JULY);
  const stats = computeDashboardStats({ capturedLeads: captured, scheduledLeads: scheduled, convertedLeads: converted, now: NOW });

  it('"Matrículas no período" decompõe em safra do período + leads antigos', () => {
    expect(stats.convertidos).toBe(2); // capturedConverted + oldConverted
    expect(stats.convertidosDaSafra).toBe(1);
    expect(stats.convertidosAntigos).toBe(1);
    expect(stats.convertidosDaSafra + stats.convertidosAntigos).toBe(stats.convertidos);
  });

  it('conversão da safra (txConv) usa numerador e denominador da MESMA coorte', () => {
    expect(stats.total).toBe(3); // capturados em julho: capturedConverted, capturedPlain, visitPast
    expect(stats.coorteConvertidos).toBe(1);
    expect(stats.txConv).toBe(33);
  });

  it('visitas: realizadas + futuras somam o valor do KPI', () => {
    expect(stats.agendadosVisita).toBe(2);
    expect(stats.visitasRealizadas).toBe(1);
    expect(stats.visitasFuturas).toBe(1);
    expect(stats.visitasRealizadas + stats.visitasFuturas).toBe(stats.agendadosVisita);
  });
});

describe('computeFunnelSteps (SAFRA, comparecimento honesto)', () => {
  const convFutureAppt = lead({ createdAt: new Date(2026, 6, 2), convertedAt: new Date(2026, 6, 5), status: 'Venda', isConverted: true, appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 6, 15, 10, 0) });
  const attendedPast = lead({ createdAt: new Date(2026, 6, 3), appointmentType: 'visita', appointmentScheduledFor: new Date(2026, 6, 4, 10, 0), appointmentOutcome: 'attended' });
  const pendingPast = lead({ createdAt: new Date(2026, 6, 3), appointmentType: 'visita', appointmentScheduledFor: new Date(2026, 6, 5, 10, 0) });
  const convNoAppt = lead({ createdAt: new Date(2026, 6, 4), convertedAt: new Date(2026, 6, 6), status: 'Venda', isConverted: true });

  const captured = [convFutureAppt, attendedPast, pendingPast, convNoAppt];
  const steps = computeFunnelSteps({ capturedLeads: captured, now: NOW });

  it('agendamento futuro NÃO conta como comparecido, mesmo com lead convertido', () => {
    expect(steps.agendamento.map(l => l.id)).toContain(convFutureAppt.id);
    expect(steps.compareceram.map(l => l.id)).not.toContain(convFutureAppt.id);
  });

  it('compareceu = agendamento com data passada e presença confirmada', () => {
    expect(steps.compareceram.map(l => l.id)).toEqual([attendedPast.id]);
  });

  it('compareceram é subconjunto de agendamentos (monotonicidade)', () => {
    const agIds = new Set(steps.agendamento.map(l => l.id));
    steps.compareceram.forEach(l => expect(agIds.has(l.id)).toBe(true));
  });

  it('matrículas da safra incluem convertido sem agendamento', () => {
    expect(steps.matriculas.map(l => l.id).sort()).toEqual([convFutureAppt.id, convNoAppt.id].sort());
  });
});

describe('computeAttendance (inalterado: só agendamentos já realizados)', () => {
  it('taxa usa apenas datas passadas; convertido com aula futura fica de fora', () => {
    const convFutureAppt = lead({ createdAt: new Date(2026, 6, 2), convertedAt: new Date(2026, 6, 5), status: 'Venda', isConverted: true, appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 6, 15, 10, 0) });
    const attendedPast = lead({ createdAt: new Date(2026, 6, 3), appointmentType: 'visita', appointmentScheduledFor: new Date(2026, 6, 4, 10, 0), appointmentOutcome: 'attended' });
    const pendingPast = lead({ createdAt: new Date(2026, 6, 3), appointmentType: 'visita', appointmentScheduledFor: new Date(2026, 6, 5, 10, 0) });
    const scheduled = computeScheduledLeads([convFutureAppt, attendedPast, pendingPast], JULY);
    const { compareceram, apptPassados } = computeAttendance({ scheduledLeads: scheduled, now: NOW });
    expect(apptPassados).toBe(2);
    expect(compareceram).toBe(1);
  });
});

describe('computeTeamMetrics (conversão por safra, nunca > 100%)', () => {
  const ana = { consultantId: 'ana', consultantName: 'Ana' };
  const bruno = { consultantId: 'bruno', consultantName: 'Bruno' };

  const leads = [
    // Ana: 2 captados em julho (1 deles convertido), + 3 antigos fechados em julho
    lead({ ...ana, createdAt: new Date(2026, 6, 2), convertedAt: new Date(2026, 6, 6), status: 'Venda', isConverted: true }),
    lead({ ...ana, createdAt: new Date(2026, 6, 3) }),
    lead({ ...ana, createdAt: new Date(2026, 3, 1), convertedAt: new Date(2026, 6, 2), status: 'Venda', isConverted: true }),
    lead({ ...ana, createdAt: new Date(2026, 3, 2), convertedAt: new Date(2026, 6, 3), status: 'Venda', isConverted: true }),
    lead({ ...ana, createdAt: new Date(2026, 3, 3), convertedAt: new Date(2026, 6, 4), status: 'Venda', isConverted: true }),
    // Bruno: nenhum captado no período, 1 antigo fechado em julho
    lead({ ...bruno, createdAt: new Date(2026, 2, 1), convertedAt: new Date(2026, 6, 5), status: 'Venda', isConverted: true })
  ];

  const rows = computeTeamMetrics({
    capturedLeads: computeCapturedLeads(leads, JULY),
    scheduledLeads: computeScheduledLeads(leads, JULY),
    convertedLeads: computeConvertedLeads(leads, JULY)
  });

  it('a coluna Matr. segue contando fechamentos do período (EVENTO)', () => {
    const anaRow = rows.find(r => r.consultantId === 'ana');
    expect(anaRow.convertidos).toBe(4);
  });

  it('conversão é da safra: 1 convertido de 2 captados = 50%, nunca 250%', () => {
    const anaRow = rows.find(r => r.consultantId === 'ana');
    expect(anaRow.total).toBe(2);
    expect(anaRow.txConversaoGlobal).toBe(50);
    rows.forEach(r => {
      if (r.txConversaoGlobal != null) expect(r.txConversaoGlobal).toBeLessThanOrEqual(100);
    });
  });

  it('sem captação no período → conversão null (vira travessão na UI)', () => {
    const brunoRow = rows.find(r => r.consultantId === 'bruno');
    expect(brunoRow.total).toBe(0);
    expect(brunoRow.convertidos).toBe(1);
    expect(brunoRow.txConversaoGlobal).toBeNull();
  });
});

describe('computeFunnelRowMetrics (tabela Métricas por funil)', () => {
  it('colunas de contagem são EVENTO; a taxa é SAFRA', () => {
    const scope = [
      lead({ createdAt: new Date(2026, 6, 2), convertedAt: new Date(2026, 7, 10), status: 'Venda', isConverted: true }), // safra julho, fechado em agosto
      lead({ createdAt: new Date(2026, 6, 3) }),
      lead({ createdAt: new Date(2026, 4, 1), convertedAt: new Date(2026, 6, 4), status: 'Venda', isConverted: true }) // antigo fechado em julho
    ];
    const row = computeFunnelRowMetrics(scope, JULY);
    expect(row.captured).toBe(2);
    expect(row.converted).toBe(1); // fechamento dentro de julho (o antigo)
    expect(row.rate).toBe(50); // 1 convertido (qualquer data) de 2 captados
  });

  it('totais recalculam a taxa do agregado (sem média de médias)', () => {
    const totals = computeFunnelComparisonTotals([
      { captured: 10, visits: 2, classes: 1, converted: 3, coorteConvertidos: 1 },
      { captured: 0, visits: 0, classes: 0, converted: 2, coorteConvertidos: 0 }
    ]);
    expect(totals.captured).toBe(10);
    expect(totals.converted).toBe(5);
    expect(totals.rate).toBe(10); // 1 de 10 na safra agregada
  });
});

describe('computeDeltas (pro-rata)', () => {
  it('no dia 9 compara 9 dias contra os 9 primeiros dias do mês anterior', () => {
    const leads = [
      lead({ createdAt: new Date(2026, 6, 2) }),
      lead({ createdAt: new Date(2026, 6, 5) }),
      lead({ createdAt: new Date(2026, 6, 8) }),
      lead({ createdAt: new Date(2026, 5, 2) }),
      lead({ createdAt: new Date(2026, 5, 4) }),
      lead({ createdAt: new Date(2026, 5, 5) }),
      lead({ createdAt: new Date(2026, 5, 6) }),
      lead({ createdAt: new Date(2026, 5, 7) }),
      lead({ createdAt: new Date(2026, 5, 8) }),
      // depois do "mesmo ponto" (9/jun 15:00) — NÃO podem entrar no delta
      lead({ createdAt: new Date(2026, 5, 15) }),
      lead({ createdAt: new Date(2026, 5, 20) }),
      lead({ createdAt: new Date(2026, 5, 25) }),
      lead({ createdAt: new Date(2026, 5, 28) })
    ];
    const range = buildPeriodRange('monthly', { now: NOW });
    const previousRange = buildPreviousRange('monthly', range, NOW);
    const deltas = computeDeltas({ leads, range, previousRange });
    expect(deltas.leads).toBe(-50); // 3 vs 6, e não 3 vs 10
  });

  it('sem base anterior: 100% quando cresceu, null quando tudo zero', () => {
    const range = buildPeriodRange('monthly', { now: NOW });
    const previousRange = buildPreviousRange('monthly', range, NOW);
    const some = computeDeltas({ leads: [lead({ createdAt: new Date(2026, 6, 2) })], range, previousRange });
    expect(some.leads).toBe(100);
    const none = computeDeltas({ leads: [], range, previousRange });
    expect(none.leads).toBeNull();
  });
});

describe('computeSparklines', () => {
  it('período em curso mostra os últimos 14 dias; encerrado acompanha o próprio período', () => {
    const leads = [lead({ createdAt: new Date(2026, 6, 8) }), lead({ createdAt: new Date(2026, 5, 10) })];
    const current = computeSparklines({ leads, range: JULY, now: NOW });
    expect(current.leads.length).toBe(14);
    expect(current.leads.reduce((a, b) => a + b, 0)).toBe(1); // só o lead de 8/jul cai na janela
    const past = computeSparklines({ leads, range: JUNE, now: NOW });
    expect(past.leads.length).toBe(30);
    expect(past.leads.reduce((a, b) => a + b, 0)).toBe(1); // lead de 10/jun
  });
});

describe('agrupadores simples', () => {
  it('canais de aquisição agrupam por origem e ordenam por volume', () => {
    const captured = [
      lead({ source: 'Instagram' }),
      lead({ source: 'Instagram' }),
      lead({ source: 'Indicação' }),
      lead({})
    ];
    const rows = computeSourceMetrics(captured);
    expect(rows[0]).toEqual({ name: 'Instagram', count: 2 });
    expect(rows.map(r => r.name)).toContain('Desconhecida');
  });

  it('aulas por modalidade só contam aulas experimentais', () => {
    const scheduled = [
      lead({ appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 6, 3), appointmentModality: 'Musculação' }),
      lead({ appointmentType: 'aula_experimental', appointmentScheduledFor: new Date(2026, 6, 4), appointmentModality: '' }),
      lead({ appointmentType: 'visita', appointmentScheduledFor: new Date(2026, 6, 5) })
    ];
    const rows = computeAulasPorModalidade(scheduled);
    expect(rows.map(r => r.name).sort()).toEqual(['Musculação', 'Sem modalidade']);
  });

  it('follow-ups pendentes excluem Venda/Perda e ordenam pela data', () => {
    const later = lead({ nextFollowUp: new Date(2026, 6, 20) });
    const sooner = lead({ nextFollowUp: new Date(2026, 6, 10) });
    const won = lead({ status: 'Venda', nextFollowUp: new Date(2026, 6, 11) });
    const rows = computePendingFollowUps([later, sooner, won]);
    expect(rows.map(l => l.id)).toEqual([sooner.id, later.id]);
  });
});

describe('helpers novos em leads.js', () => {
  it('isConvertedStatusName casa Venda e nomes com "matricul"/"convertid"', () => {
    expect(isConvertedStatusName('Venda')).toBe(true);
    expect(isConvertedStatusName('Matriculado 2024')).toBe(true);
    expect(isConvertedStatusName('Convertido')).toBe(true);
    expect(isConvertedStatusName('Negociação')).toBe(false);
    expect(isConvertedStatusName('')).toBe(false);
  });

  it('getLeadConversionDateStrict NÃO cai no createdAt', () => {
    const withDate = lead({ convertedAt: new Date(2026, 6, 3) });
    const without = lead({ status: 'Matriculado' });
    expect(getLeadConversionDateStrict(withDate).getTime()).toBe(new Date(2026, 6, 3).getTime());
    expect(getLeadConversionDateStrict(without)).toBeNull();
  });

  it('isLeadConverted mantém o comportamento atual', () => {
    expect(isLeadConverted(lead({ status: 'Venda' }))).toBe(true);
    expect(isLeadConverted(lead({ isConverted: true }))).toBe(true);
    expect(isLeadConverted(lead({ status: 'Matriculado' }))).toBe(true);
    expect(isLeadConverted(lead({ status: 'Novo' }))).toBe(false);
  });
});
