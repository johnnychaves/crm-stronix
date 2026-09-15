import { describe, it, expect } from 'vitest';
import {
  appointmentsOf, recordsByLeadOf, cohortMilestones, professorsOf, visitOutcomesByLead, effectiveStatus
} from '../crm/appointments.js';

const D = (m, d, h = 10) => new Date(2026, m - 1, d, h);
const WIN = { start: D(9, 1, 0), end: D(9, 14, 12) };
const lead = (id, over = {}) => ({ id, consultantId: 'ana', funnelId: 'ven', ...over });
const LEADS = new Map([['a', lead('a')], ['b', lead('b', { consultantId: 'diego' })]]);
const leadOf = (id) => LEADS.get(id) || { id, unknown: true };
const all = () => true;
const R = (id, over) => ({ id, leadId: 'a', type: 'aula', status: 'agendada', scheduledFor: D(9, 2), createdAt: D(8, 30), ...over });

describe('agendamentos do mês', () => {
  const recs = [
    R('1', { status: 'attended' }),
    R('2', { status: 'no_show', leadId: 'b' }),
    R('3', { status: 'agendada', type: 'visita' }),
    R('4', { status: 'cancelled' }),
    R('5', { status: 'attended', scheduledFor: D(9, 20) }),
    R('6', { status: 'attended', scheduledFor: D(8, 31) }),
    R('1', { status: 'attended' })
  ];

  it('visitas e aulas do mês até o fim da janela, sem cancelados, sem repetir', () => {
    expect(appointmentsOf(recs, { ...WIN, leadOf, inScope: all }))
      .toEqual({ total: 3, came: 1, missed: 1, pending: 1, decided: 2, rate: 50 });
  });

  it('pessoa e funil saem do lead do registro', () => {
    expect(appointmentsOf(recs, { ...WIN, leadOf, inScope: (l) => l.consultantId === 'diego' }))
      .toMatchObject({ total: 1, missed: 1, rate: 0 });
  });

  it('agendamento marcado depois de a pessoa virar cliente não é funil de lead (aula de upgrade)', () => {
    const people = new Map([
      ['k', lead('k', { clienteSince: { toDate: () => D(8, 20) } })],
      ['n', lead('n', { clienteSince: D(9, 10) })]
    ]);
    const of = (id) => people.get(id) || { id, unknown: true };
    const list = [
      R('u1', { leadId: 'k', status: 'attended', createdAt: D(9, 1), scheduledFor: D(9, 3) }),
      R('u2', { leadId: 'n', status: 'attended', createdAt: D(8, 30), scheduledFor: D(9, 2) })
    ];
    expect(appointmentsOf(list, { ...WIN, leadOf: of, inScope: all }))
      .toEqual({ total: 1, came: 1, missed: 0, pending: 0, decided: 1, rate: 100 });
  });

  it('registro de visita reaproveitado por quem já era cliente fica fora, mesmo com o createdAt de quando era lead', () => {
    // upsertScheduledAppointment acha o registro de visita em aberto e só troca
    // a data: o createdAt continua o de quando a pessoa ainda era lead.
    const people = new Map([['c', lead('c', { clienteSince: D(9, 5) })]]);
    const of = (id) => people.get(id) || { id, unknown: true };
    const list = [
      R('v1', { leadId: 'c', type: 'visita', createdAt: D(8, 20), scheduledFor: D(9, 8) }),
      R('v2', { leadId: 'c', type: 'visita', createdAt: D(8, 20), scheduledFor: D(9, 4) })
    ];
    expect(appointmentsOf(list, { ...WIN, leadOf: of, inScope: all }))
      .toEqual({ total: 1, came: 0, missed: 0, pending: 1, decided: 0, rate: null });
  });

  it('cliente que virou cliente sem contrato (só convertedAt, sem clienteSince) também fica fora depois da matrícula', () => {
    const people = new Map([['v', lead('v', { convertedAt: { toDate: () => D(3, 10) } })]]);
    const of = (id) => people.get(id) || { id, unknown: true };
    const list = [R('x1', { leadId: 'v', status: 'attended', createdAt: D(9, 1), scheduledFor: D(9, 8) })];
    expect(appointmentsOf(list, { ...WIN, leadOf: of, inScope: all }))
      .toEqual({ total: 0, came: 0, missed: 0, pending: 0, decided: 0, rate: null });
  });
});

describe('marcos da safra', () => {
  const asOf = D(9, 14, 12);
  const byLead = recordsByLeadOf([
    R('1', { leadId: 'a', status: 'attended', scheduledFor: D(9, 3) }),
    R('2', { leadId: 'b', status: 'cancelled' }),
    R('3', { leadId: 'c', status: 'agendada', scheduledFor: D(9, 20), createdAt: D(9, 10) }),
    R('4', { leadId: 'd', status: 'agendada', scheduledFor: D(9, 20), createdAt: null }),
    R('5', { leadId: 'e', status: 'no_show', scheduledFor: D(9, 4) })
  ]);
  const cohort = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id }));
  cohort[5].appointmentScheduledFor = { toDate: () => D(10, 2) };
  cohort[6].appointmentScheduledFor = D(9, 25);
  cohort[6].appointmentOutcome = 'cancelled';

  it('agendou: registro não cancelado marcado até o instante, ou agendamento em aberto no lead', () => {
    expect(cohortMilestones(cohort, { asOf, cut: false, recordsByLead: byLead })).toEqual({ sched: 4, came: 1 });
  });

  it('no corte pró-rata o agendamento em aberto do lead não conta, porque ele é o de hoje', () => {
    expect(cohortMilestones(cohort, { asOf, cut: true, recordsByLead: byLead })).toEqual({ sched: 3, came: 1 });
  });

  it('um agendamento nunca é marcado depois da própria data: vale a mais cedo entre createdAt e scheduledFor', () => {
    // O backfill gravou createdAt no dia em que rodou, depois da data marcada.
    const late = recordsByLeadOf([R('9', { leadId: 'z', status: 'no_show', scheduledFor: D(8, 8), createdAt: D(8, 18) })]);
    expect(cohortMilestones([{ id: 'z' }], { asOf: D(8, 15), cut: true, recordsByLead: late })).toEqual({ sched: 1, came: 0 });
  });

  it('agendamento marcado na primeira matrícula ou depois dela não é funil de lead (aula de upgrade)', () => {
    const recs = recordsByLeadOf([
      R('u1', { leadId: 'm', status: 'attended', createdAt: D(9, 6), scheduledFor: D(9, 8) }),
      R('u2', { leadId: 'n', status: 'attended', createdAt: D(9, 1), scheduledFor: D(9, 3) }),
      R('u3', { leadId: 'p', status: 'agendada', createdAt: D(9, 5, 10), scheduledFor: D(9, 12) })
    ]);
    const leads = [
      { id: 'm', convertedAt: { toDate: () => D(9, 5) } },
      { id: 'n', convertedAt: D(9, 5) },
      { id: 'p', clienteSince: D(9, 5, 10) }
    ];
    expect(cohortMilestones(leads, { asOf, cut: true, recordsByLead: recs })).toEqual({ sched: 1, came: 1 });
  });

  it('registro de visita reaproveitado depois da matrícula: agendou pela visita de antes, não compareceu pela de depois', () => {
    // Cadastrado em 18/08, faltou à visita de 20/08 e matriculou em 05/09. O
    // mesmo registro (upsertScheduledAppointment só troca a data) virou a
    // visita de 20/09, e nessa ele veio.
    const rec = R('rv', { leadId: 'w', type: 'visita', createdAt: D(8, 18, 11), scheduledFor: D(9, 20, 18) });
    const w = {
      id: 'w', createdAt: D(8, 18), convertedAt: D(9, 5), clienteSince: D(9, 5),
      appointmentScheduledFor: D(9, 20, 18), appointmentOutcome: 'attended'
    };
    const mark = (id, outcome, at) => ({ id, leadId: 'w', type: 'daily_goal_done', dailyGoalCategory: 'visita_hoje', appointmentOutcome: outcome, createdAt: at });
    const marks = visitOutcomesByLead([mark('g1', 'no_show', D(8, 20, 19)), mark('g2', 'attended', D(9, 20, 19))]);
    expect(cohortMilestones([w], { asOf: D(9, 25), cut: false, recordsByLead: recordsByLeadOf([rec]), visitOutcomes: marks }))
      .toEqual({ sched: 1, came: 0 });
  });
});

describe('desfecho da visita pela linha do tempo', () => {
  const G = (id, leadId, outcome, at, category = 'visita_hoje') => ({
    id, leadId, type: 'daily_goal_done', dailyGoalCategory: category, appointmentOutcome: outcome, createdAt: at
  });
  const outcomes = visitOutcomesByLead([
    G('g1', 'v1', 'attended', D(9, 3, 19)),
    G('g1', 'v1', 'attended', D(9, 3, 19)),
    G('g0', 'v1', 'no_show', D(9, 3, 20), 'aula_hoje'),
    G('g2', 'v2', 'no_show', D(9, 4, 9)),
    G('g9', 'v2', 'attended', D(9, 1)),
    G('g3', 'v3', 'attended', D(9, 6)),
    G('g4', 'v4', 'cancelled', D(9, 3, 8)),
    G('g5', 'v5', 'rescheduled', D(9, 3, 19)),
    G('g6', 'au', 'attended', D(9, 3, 19)),
    { id: 'g7', leadId: 'v6', type: 'note', dailyGoalCategory: 'visita_hoje', appointmentOutcome: 'attended', createdAt: D(9, 3, 19) },
    G('g8', 'v6', 'attended', null)
  ]);
  const V = (id, leadId) => R(id, { leadId, type: 'visita', scheduledFor: D(9, 3, 18) });
  const recs = [V('1', 'v1'), V('2', 'v2'), V('3', 'v3'), V('4', 'v4'), V('5', 'v5'), R('6', { leadId: 'au', scheduledFor: D(9, 3, 18) })];
  const people = new Map(['v1', 'v2', 'v3', 'v4', 'v5', 'au'].map((id) => [id, lead(id)]));
  const of = (id) => people.get(id) || { id, unknown: true };

  it('só visita_hoje com desfecho que fecha a visita, em ordem, sem repetir e sem data inválida', () => {
    expect(outcomes.get('v1')).toEqual([{ at: D(9, 3, 19).getTime(), status: 'attended' }]);
    expect(outcomes.get('v2')).toEqual([{ at: D(9, 1).getTime(), status: 'attended' }, { at: D(9, 4, 9).getTime(), status: 'no_show' }]);
    expect(outcomes.has('v5')).toBe(false);
    expect(outcomes.has('v6')).toBe(false);
  });

  it('veio no dia, faltou no dia seguinte, desfecho três dias depois não conta, cancelada sai da conta, aula não muda', () => {
    expect(recs.map((r) => effectiveStatus(r, outcomes)))
      .toEqual(['attended', 'no_show', 'agendada', 'cancelled', 'agendada', 'agendada']);
    expect(appointmentsOf(recs, { ...WIN, leadOf: of, inScope: all, visitOutcomes: outcomes }))
      .toEqual({ total: 5, came: 1, missed: 1, pending: 3, decided: 2, rate: 50 });
  });

  it('a janela vai do início do dia marcado até dois dias depois, em horário local', () => {
    const at = (d, h, min = 0) => visitOutcomesByLead([G('x', 'v1', 'attended', new Date(2026, 8, d, h, min))]);
    expect(effectiveStatus(V('1', 'v1'), at(3, 0))).toBe('attended');
    expect(effectiveStatus(V('1', 'v1'), at(4, 23, 59))).toBe('attended');
    expect(effectiveStatus(V('1', 'v1'), at(5, 0))).toBe('agendada');
    expect(effectiveStatus(V('1', 'v1'), at(2, 23, 59))).toBe('agendada');
  });

  it('vale o último desfecho da janela: "Veio" no dia corrigido para "Faltou" no dia seguinte', () => {
    const fixed = visitOutcomesByLead([
      G('c2', 'v1', 'no_show', D(9, 4, 9)),
      G('c1', 'v1', 'attended', D(9, 3, 19))
    ]);
    expect(effectiveStatus(V('1', 'v1'), fixed)).toBe('no_show');
  });

  it('sem os desfechos da linha do tempo, vale o status do registro', () => {
    expect(appointmentsOf(recs, { ...WIN, leadOf: of, inScope: all })).toMatchObject({ total: 6, came: 0, pending: 6 });
  });

  it('marcos da safra: a visita que veio conta como comparecimento e a cancelada não é agendamento', () => {
    const cohort = ['v1', 'v2', 'v4'].map((id) => ({ id }));
    expect(cohortMilestones(cohort, { asOf: D(9, 14, 12), cut: false, recordsByLead: recordsByLeadOf(recs), visitOutcomes: outcomes }))
      .toEqual({ sched: 2, came: 1 });
  });
});

describe('desfecho corrigido no espelho do lead', () => {
  const G = (id, leadId, outcome, at) => ({
    id, leadId, type: 'daily_goal_done', dailyGoalCategory: 'visita_hoje', appointmentOutcome: outcome, createdAt: at
  });
  const at = D(9, 3, 18);
  const V = (id) => R(id, { leadId: 'v1', type: 'visita', scheduledFor: at });
  // A Agenda do dia gravou "não veio" com a marca do dia. A correção para
  // "veio" mudou só o lead, porque a marca do dia já existia.
  const marks = visitOutcomesByLead([G('g1', 'v1', 'no_show', D(9, 3, 19))]);
  const mirror = (over) => lead('v1', { appointmentScheduledFor: { toDate: () => new Date(at) }, ...over });

  it('a correção no espelho do mesmo agendamento ganha da marca antiga da linha do tempo', () => {
    expect(effectiveStatus(V('1'), marks, mirror({ appointmentOutcome: 'attended' }))).toBe('attended');
    const came = visitOutcomesByLead([G('g2', 'v1', 'attended', D(9, 3, 19))]);
    expect(effectiveStatus(V('1'), came, mirror({ appointmentOutcome: 'no_show' }))).toBe('no_show');
    expect(effectiveStatus(V('1'), null, mirror({ appointmentOutcome: 'attended' }))).toBe('attended');
  });

  it('espelho de outra data não vale: o lead já está em outro agendamento', () => {
    expect(effectiveStatus(V('1'), marks, mirror({ appointmentScheduledFor: D(9, 10, 18), appointmentOutcome: 'attended' })))
      .toBe('no_show');
  });

  it('sem veio ou não veio no espelho, decide a linha do tempo; o cancelamento limpa a data e segue por ela', () => {
    expect(effectiveStatus(V('1'), marks, mirror({ appointmentOutcome: null }))).toBe('no_show');
    expect(effectiveStatus(V('1'), marks, mirror({ appointmentOutcome: 'rescheduled' }))).toBe('no_show');
    const cancelled = visitOutcomesByLead([G('g3', 'v1', 'cancelled', D(9, 3, 8))]);
    expect(effectiveStatus(V('1'), cancelled, mirror({ appointmentScheduledFor: null, appointmentOutcome: 'cancelled' })))
      .toBe('cancelled');
  });

  it('aula não usa o espelho: o desfecho dela já vai para o registro', () => {
    expect(effectiveStatus(R('a', { leadId: 'v1', scheduledFor: at }), null, mirror({ appointmentOutcome: 'attended' })))
      .toBe('agendada');
  });

  it('agendamentos do mês usam o lead do registro, e os marcos, o lead da safra', () => {
    const fixed = mirror({ appointmentOutcome: 'attended' });
    const of = (id) => (id === 'v1' ? fixed : { id, unknown: true });
    expect(appointmentsOf([V('1')], { ...WIN, leadOf: of, inScope: all, visitOutcomes: marks }))
      .toEqual({ total: 1, came: 1, missed: 0, pending: 0, decided: 1, rate: 100 });
    expect(cohortMilestones([fixed], { asOf: D(9, 14, 12), cut: true, recordsByLead: recordsByLeadOf([V('1')]), visitOutcomes: marks }))
      .toEqual({ sched: 1, came: 1 });
  });
});

describe('professores', () => {
  const recs = [
    R('1', { status: 'attended', professorId: 'p1', professorName: 'Paula Nunes', modality: 'Funcional', converted: true }),
    R('2', { status: 'attended', professorId: 'p1', professorName: 'Paula Nunes', modality: 'Musculação' }),
    R('3', { status: 'no_show', professorId: 'p1', professorName: 'Paula Nunes' }),
    R('4', { status: 'attended', professorId: 'p2', professorName: 'Rafael Costa', modality: 'Musculação', converted: true }),
    R('5', { status: 'attended', soloTraining: true, modality: 'Musculação' }),
    R('6', { status: 'attended', type: 'visita', professorId: 'p1' }),
    R('7', { status: 'agendada', professorId: 'p3', professorName: 'Bianca Alves' }),
    R('8', { status: 'attended', professorId: 'p2', professorName: 'Rafael Costa', scheduledFor: D(9, 20) })
  ];

  it('só aulas do mês até o fim da janela; realizadas, faltas, matrículas e modalidade; treina sozinho à parte', () => {
    const r = professorsOf(recs, WIN);
    expect(r.rows.map((p) => [p.name, p.done, p.missed, p.enrolled, p.conv])).toEqual([
      ['Rafael Costa', 1, 0, 1, 100],
      ['Paula Nunes', 2, 1, 1, 50]
    ]);
    expect(r.rows[1].mods).toEqual([{ name: 'Funcional', count: 1 }, { name: 'Musculação', count: 1 }]);
    expect(r.solo).toMatchObject({ name: 'Treina sozinho', done: 1, enrolled: 0, conv: 0 });
    expect(r.done).toBe(4);
  });

  it('mês sem aula: sem linhas, sem treina sozinho', () => {
    expect(professorsOf([], WIN)).toEqual({ rows: [], solo: null, done: 0 });
  });
});
