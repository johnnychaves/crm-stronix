import { describe, it, expect } from 'vitest';
import { metaDaysOfMonth } from '../operacional/month.js';
import {
  TASK_ROWS, metaDaysSummary, pickMeta, metaCalendar,
  prospectionSummary, pickProspection, tasksByType, overdueNow
} from '../operacional/routine.js';

const NOW = new Date(2026, 8, 11, 14, 0);
const D = (d, h = 10) => new Date(2026, 8, d, h);
const USERS = [
  { id: 'ana', authUid: 'u-ana', name: 'Ana Ribeiro', dailyVolumeTarget: 10 },
  { id: 'marcos', authUid: 'u-marcos', name: 'Marcos Lima', dailyVolumeTarget: 0 }
];
const DAYS = metaDaysOfMonth('2026-09', [1, 2, 3, 4, 5], NOW);

describe('meta diária', () => {
  const history = [
    { consultantId: 'ana', date: '2026-09-01' },
    { consultantId: 'ana', date: '2026-09-02' },
    { consultantId: 'ana', date: '2026-09-11' },   // hoje: não entra na conta
    { consultantId: 'ana', date: '2026-08-31' },   // outro mês
    { consultantId: 'marcos', date: '2026-09-01' }
  ];
  const meta = metaDaysSummary({ users: USERS, history, metaDays: DAYS });

  it('conta só os dias fechados', () => {
    expect(meta.closedCount).toBe(8);
    expect(pickMeta(meta, 'ana')).toEqual({ done: 2, total: 8, pct: 25 });
  });

  it('equipe é a soma dos dias-pessoa', () => {
    expect(pickMeta(meta, null)).toEqual({ done: 3, total: 16, pct: 19 });
  });

  it('calendário diz quantos bateram e se a pessoa bateu', () => {
    const cal = metaCalendar({ metaDays: DAYS, hitsBy: meta.hitsBy, userId: 'ana' });
    expect(cal[0]).toMatchObject({ key: '2026-09-01', hits: 2, me: true, state: 'closed' });
    expect(cal.find((c) => c.day === 11)).toMatchObject({ state: 'today', me: true });
  });
});

describe('prospecção', () => {
  const leadsCreated = [
    { id: 'l1', consultantId: 'ana', createdAt: D(1) },
    { id: 'l1', consultantId: 'ana', createdAt: D(1) },            // duplicado: conta uma vez
    { id: 'l2', consultantId: 'ana', createdAt: D(5) },            // sábado: fora da meta
    { id: 'l3', consultantId: 'marcos', createdAt: D(2) }
  ];
  const interactions = [
    { volumeKind: 'mensagem', actorAuthUid: 'u-ana', createdAt: D(2) },
    { volumeKind: 'ligacao', leadConsultantAuthUid: 'u-ana', createdAt: D(11, 9) }, // hoje, sem ator: vale o dono do lead
    { volumeKind: null, actorAuthUid: 'u-ana', createdAt: D(2) },
    { volumeKind: 'visita', actorAuthUid: 'u-marcos', createdAt: D(3) }
  ];
  const summary = prospectionSummary({ users: USERS, interactions, leadsCreated, metaDays: DAYS });

  it('conta ações por dia de meta, hoje entra parcial', () => {
    const ana = pickProspection(summary, 'ana');
    expect(ana).toMatchObject({ on: true, done: 3, target: 90, dailyTarget: 10, pct: 3 });
    expect(ana.perDay.slice(0, 2)).toEqual([1, 1]);
    expect(ana.perDay[8]).toBe(1);
  });

  it('alvo 0 é prospecção desligada e fica fora da equipe', () => {
    expect(pickProspection(summary, 'marcos').on).toBe(false);
    expect(pickProspection(summary, null)).toMatchObject({ done: 3, target: 90, dailyTarget: 10 });
  });

  it('respeita o corte: lead e ação depois dele não contam, nem no dia do corte', () => {
    const lateInteractions = [...interactions, { volumeKind: 'mensagem', actorAuthUid: 'u-ana', createdAt: D(11, 20) }];
    const lateLeads = [...leadsCreated, { id: 'l9', consultantId: 'ana', createdAt: D(11, 20) }];
    const args = { users: USERS, interactions: lateInteractions, leadsCreated: lateLeads, metaDays: DAYS };
    expect(pickProspection(prospectionSummary(args), 'ana').done).toBe(5);
    const cut = pickProspection(prospectionSummary({ ...args, end: NOW }), 'ana');
    expect(cut.done).toBe(3);
    expect(cut.perDay[8]).toBe(1);
  });
});

describe('tarefas por tipo', () => {
  const interactions = [
    { type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', leadId: 'a', actorAuthUid: 'u-ana', createdAt: D(2) },
    { type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', leadId: 'a', actorAuthUid: 'u-ana', createdAt: D(2, 16) }, // repetida no dia
    { type: 'daily_goal_done', dailyGoalCategory: 'visita_hoje', leadId: 'b', actorAuthUid: 'u-ana', createdAt: D(3) },
    { type: 'daily_goal_done', dailyGoalCategory: 'aula_hoje', leadId: 'c', leadConsultantAuthUid: 'u-marcos', createdAt: D(3) },
    { type: 'note', leadId: 'd', actorAuthUid: 'u-ana', createdAt: D(3) }
  ];
  const range = { start: new Date(2026, 8, 1), end: NOW };

  it('uma por lead, categoria e dia; visitas e aulas juntas', () => {
    const team = tasksByType({ interactions, users: USERS, ...range });
    expect(team).toMatchObject({ contatos: 1, agenda: 2, total: 3 });
    expect(TASK_ROWS.map((r) => r.id)).toEqual(['novos', 'contatos', 'agenda', 'atrasados', 'renovacoes', 'vencidos']);
  });

  it('pessoa: só as tarefas que ela fez', () => {
    expect(tasksByType({ interactions, users: USERS, userId: 'marcos', ...range })).toMatchObject({ agenda: 1, total: 1 });
  });
});

describe('atrasados agora', () => {
  it('mesma condição da categoria Atrasados da Meta', () => {
    const liveLeads = [
      { consultantId: 'ana', status: 'Negociação', nextFollowUp: D(10) },
      { consultantId: 'ana', status: 'Negociação', nextFollowUp: D(11, 8) },   // hoje: não é atrasado
      { consultantId: 'ana', status: 'Venda', nextFollowUp: D(1) },
      { consultantId: 'marcos', status: 'Novo', nextFollowUp: D(3) }
    ];
    const r = overdueNow({ liveLeads, users: USERS, now: NOW });
    expect(r.total).toBe(2);
    expect(Object.fromEntries(r.byUser)).toEqual({ ana: 1, marcos: 1 });
  });
});
