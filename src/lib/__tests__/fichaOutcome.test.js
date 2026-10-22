import { describe, it, expect } from 'vitest';
import { appointmentTaskOwnerId, DAILY_GOAL_CATEGORIES, hasGoalDoneTodayFor, isClientLead } from '../leads.js';
import { outcomeOptionsFor, outcomeRuleFor, schedulePresetOf } from '../fichaOutcome.js';

const D = (m, d, h = 0, mi = 0) => new Date(2026, m - 1, d, h, mi);
const AGORA = D(10, 16, 10, 20);
const LEAD = { id: 'l1', consultantId: 'ana', status: 'Em contato' };
const CLIENTE = { id: 'l2', consultantId: 'ana', lifecycleStage: 'cliente', status: 'Venda' };

const visita = { id: 'appointment', type: 'visita' };
const aula = { id: 'appointment', type: 'aula_experimental' };
const ligacao = { id: 'contact', type: 'ligacao' };

const marca = (extra = {}) => ({
  leadId: 'l1', type: 'daily_goal_done', dailyGoalCategory: DAILY_GOAL_CATEGORIES.VISITA_HOJE,
  goalOwnerId: 'ana', createdAt: D(10, 16, 9), ...extra,
});

describe('outcomeOptionsFor', () => {
  it('visita e aula usam a categoria da Meta Diária correspondente', () => {
    expect(outcomeOptionsFor(visita, { lead: LEAD, now: AGORA }).categorySlug).toBe(DAILY_GOAL_CATEGORIES.VISITA_HOJE);
    expect(outcomeOptionsFor(aula, { lead: LEAD, now: AGORA }).categorySlug).toBe(DAILY_GOAL_CATEGORIES.AULA_HOJE);
  });

  it('lead promove a etapa e grava a marca do dia', () => {
    expect(outcomeOptionsFor(visita, { lead: LEAD, now: AGORA })).toEqual({
      categorySlug: DAILY_GOAL_CATEGORIES.VISITA_HOJE,
      promote: true, writeGoalDone: true, sourceLabel: 'Ficha',
    });
  });

  it('cliente não promove a etapa, como na Agenda de hoje', () => {
    expect(outcomeOptionsFor(aula, { lead: CLIENTE, now: AGORA })).toMatchObject({ promote: false, writeGoalDone: true });
  });

  it('não grava a marca de novo quando o dono da tarefa já tem a de hoje', () => {
    expect(outcomeOptionsFor(visita, { lead: LEAD, interactions: [marca()], now: AGORA }).writeGoalDone).toBe(false);
  });

  it('a marca de ontem, de outra categoria ou de outra pessoa não conta', () => {
    const outras = [
      marca({ createdAt: D(10, 15, 9) }),
      marca({ dailyGoalCategory: DAILY_GOAL_CATEGORIES.AULA_HOJE }),
      marca({ goalOwnerId: 'bruno' }),
    ];
    expect(outcomeOptionsFor(visita, { lead: LEAD, interactions: outras, now: AGORA }).writeGoalDone).toBe(true);
  });

  it('a visita agendada por outro consultor confere a marca de quem tem a tarefa', () => {
    const lead = { ...LEAD, appointmentOwnerId: 'bruno' };
    expect(outcomeOptionsFor(visita, { lead, interactions: [marca()], now: AGORA }).writeGoalDone).toBe(true);
    expect(outcomeOptionsFor(visita, { lead, interactions: [marca({ goalOwnerId: 'bruno' })], now: AGORA }).writeGoalDone).toBe(false);
  });

  it('contato e item vazio não têm desfecho', () => {
    expect(outcomeOptionsFor(ligacao, { lead: LEAD, now: AGORA })).toBeNull();
    expect(outcomeOptionsFor(null, { lead: LEAD, now: AGORA })).toBeNull();
  });
});

describe('schedulePresetOf', () => {
  it('diz o tipo que o Agendar abre escolhido', () => {
    expect(schedulePresetOf(visita)).toBe('visita');
    expect(schedulePresetOf(aula)).toBe('aula');
    expect(schedulePresetOf(ligacao)).toBe('ligacao');
    expect(schedulePresetOf({ type: 'mensagem' })).toBe('mensagem');
  });

  it('item desconhecido ou vazio não escolhe tipo', () => {
    expect(schedulePresetOf({ type: 'xyz' })).toBeNull();
    expect(schedulePresetOf(null)).toBeNull();
  });
});

// A regra que a Agenda de hoje tinha escrita à mão no markAgendaPresence,
// copiada aqui como era, para provar que o outcomeRuleFor grava igual nos
// casos que importam.
const regraDaAgendaAntiga = (row, categorySlug, interactions, now) => ({
  promote: !isClientLead(row),
  writeGoalDone: !hasGoalDoneTodayFor(
    row, categorySlug, interactions.filter((i) => i.leadId === row.id),
    new Date(now.getFullYear(), now.getMonth(), now.getDate()), appointmentTaskOwnerId(row)
  ),
});

describe('outcomeRuleFor, a regra da Agenda de hoje num lugar só', () => {
  const VISITA = DAILY_GOAL_CATEGORIES.VISITA_HOJE;
  const AULA = DAILY_GOAL_CATEGORIES.AULA_HOJE;
  const casos = [
    ['lead comum, sem marca', LEAD, VISITA, []],
    ['cliente', CLIENTE, AULA, [marca({ leadId: 'l2', dailyGoalCategory: AULA, goalOwnerId: 'bruno' })]],
    ['lead em Perda', { ...LEAD, status: 'Perda' }, VISITA, []],
    ['marca de hoje do dono da tarefa de agora', LEAD, VISITA, [marca()]],
    ['marca de hoje de outro dono', LEAD, VISITA, [marca({ goalOwnerId: 'bruno' })]],
    ['marca de outro dono na visita agendada por ele', { ...LEAD, appointmentOwnerId: 'bruno' }, VISITA, [marca({ goalOwnerId: 'bruno' })]],
    ['marca de outro lead', LEAD, VISITA, [marca({ leadId: 'outro' })]],
    ['marca de ontem', LEAD, VISITA, [marca({ createdAt: D(10, 15, 20) })]],
  ];

  it.each(casos)('%s: igual à regra que a Agenda tinha', (_nome, lead, categorySlug, interactions) => {
    expect(outcomeRuleFor(lead, categorySlug, { interactions, now: AGORA })).toEqual(regraDaAgendaAntiga(lead, categorySlug, interactions, AGORA));
  });

  it('cliente não promove, e a marca do dono atual não se repete', () => {
    expect(outcomeRuleFor(CLIENTE, AULA, { now: AGORA })).toEqual({ promote: false, writeGoalDone: true });
    expect(outcomeRuleFor(LEAD, VISITA, { interactions: [marca()], now: AGORA })).toEqual({ promote: true, writeGoalDone: false });
  });
});
