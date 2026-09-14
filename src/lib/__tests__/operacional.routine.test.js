import { describe, it, expect } from 'vitest';
import { metaDaysOfMonth } from '../operacional/month.js';
import {
  TASK_ROWS, OTHERS_ID, metaDaysSummary, pickMeta, metaCalendar, calendarGrid,
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

describe('grade da régua de dias (calendarGrid)', () => {
  // state (closed/today/future) não importa pra grade; corte bem no futuro
  // deixa todo mundo 'closed' e fora do caminho.
  const FUTURE_CUT = new Date(2099, 0, 1);
  const buildCells = (monthKey, metaWeekdays) =>
    metaCalendar({ metaDays: metaDaysOfMonth(monthKey, metaWeekdays, FUTURE_CUT), hitsBy: new Map() });

  it('dias úteis (Seg a Sex) em novembro de 2026: 5 colunas, sem espaço inicial', () => {
    const { columns, slots } = calendarGrid(buildCells('2026-11', [1, 2, 3, 4, 5]));
    expect(columns).toEqual([1, 2, 3, 4, 5]);
    expect(slots).toHaveLength(25); // 21 dias úteis + 4 de preenchimento no fim
    expect(slots.slice(0, 5).every((s) => s !== null)).toBe(true);
    expect(slots[0]).toMatchObject({ day: 2, weekday: 1 });
    expect(slots.filter(Boolean)).toHaveLength(21);
  });

  it('segunda a sábado em agosto de 2026, que começa num sábado: 6 colunas, sábado cai na 6ª', () => {
    const { columns, slots } = calendarGrid(buildCells('2026-08', [1, 2, 3, 4, 5, 6]));
    expect(columns).toEqual([1, 2, 3, 4, 5, 6]);
    expect(slots).toHaveLength(36); // 5 de espaço + 26 dias + 5 de preenchimento
    expect(slots.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(slots[5]).toMatchObject({ day: 1, weekday: 6 });
  });

  it('os 7 dias em novembro de 2026, que começa num domingo: 7 colunas, sem RangeError', () => {
    const { columns, slots } = calendarGrid(buildCells('2026-11', [0, 1, 2, 3, 4, 5, 6]));
    expect(columns).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(slots).toHaveLength(42); // 6 de espaço + 30 dias + 6 de preenchimento
    expect(slots.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(slots[6]).toMatchObject({ day: 1, weekday: 0 });
  });

  it('[1,3,5]: 3 colunas, primeiro dia (quarta) entra na 2ª coluna', () => {
    const { columns, slots } = calendarGrid(buildCells('2026-09', [1, 3, 5]));
    expect(columns).toEqual([1, 3, 5]);
    expect(slots).toHaveLength(15); // 1 de espaço + 13 dias + 1 de preenchimento
    expect(slots[0]).toBeNull();
    expect(slots[1]).toMatchObject({ day: 2, weekday: 3 });
    expect(slots.filter(Boolean)).toHaveLength(13);
  });

  it('cells vazio: cabeçalho padrão Seg a Sex, nenhum dia, sem erro', () => {
    expect(calendarGrid([])).toEqual({ columns: [1, 2, 3, 4, 5], slots: [] });
    expect(calendarGrid(undefined)).toEqual({ columns: [1, 2, 3, 4, 5], slots: [] });
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

  it('duas pessoas na mesma tarefa contam uma vez para cada uma, e a equipe é a soma', () => {
    const sameTask = [
      { type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', leadId: 'z', actorAuthUid: 'u-ana', createdAt: D(4) },
      { type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', leadId: 'z', actorAuthUid: 'u-marcos', createdAt: D(4, 15) },
      { type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', leadId: 'z', actorAuthUid: 'u-ana', createdAt: D(4, 18) } // ana de novo: não soma
    ];
    expect(tasksByType({ interactions: sameTask, users: USERS, ...range })).toMatchObject({ contatos: 2, total: 2 });
    expect(tasksByType({ interactions: sameTask, users: USERS, userId: 'ana', ...range })).toMatchObject({ contatos: 1, total: 1 });
    expect(tasksByType({ interactions: sameTask, users: USERS, userId: 'marcos', ...range })).toMatchObject({ contatos: 1, total: 1 });
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

describe('responsável fora da equipe', () => {
  it('atrasados de ex-consultor ou sem consultor ficam em OTHERS_ID e entram no total', () => {
    const liveLeads = [
      { consultantId: 'ana', status: 'Negociação', nextFollowUp: D(10) },
      { consultantId: 'ex', status: 'Negociação', nextFollowUp: D(9) },
      { consultantId: '', status: 'Novo', nextFollowUp: D(8) },
      { status: 'Novo', nextFollowUp: D(7) }
    ];
    const r = overdueNow({ liveLeads, users: USERS, now: NOW });
    expect(Object.fromEntries(r.byUser)).toEqual({ ana: 1, marcos: 0, [OTHERS_ID]: 3 });
    expect(r.total).toBe(4);
  });

  it('tarefas de OTHERS_ID são as de autor fora da equipe, inclusive sem autor', () => {
    const interactions = [
      { type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', leadId: 'a', actorAuthUid: 'u-ana', createdAt: D(2) },
      { type: 'daily_goal_done', dailyGoalCategory: 'contato_hoje', leadId: 'b', actorAuthUid: 'u-ex', createdAt: D(2) },
      { type: 'daily_goal_done', dailyGoalCategory: 'vencido', leadId: 'c', createdAt: D(3) }
    ];
    const range = { start: new Date(2026, 8, 1), end: NOW };
    expect(tasksByType({ interactions, users: USERS, userId: OTHERS_ID, ...range })).toMatchObject({ contatos: 1, vencidos: 1, total: 2 });
    expect(tasksByType({ interactions, users: USERS, ...range }).total).toBe(3);
  });
});
