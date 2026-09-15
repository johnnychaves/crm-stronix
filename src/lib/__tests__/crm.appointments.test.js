import { describe, it, expect } from 'vitest';
import { appointmentsOf, recordsByLeadOf, cohortMilestones, professorsOf } from '../crm/appointments.js';

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
