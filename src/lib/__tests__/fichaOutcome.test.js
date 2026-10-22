import { describe, it, expect } from 'vitest';
import { DAILY_GOAL_CATEGORIES } from '../leads.js';
import { outcomeOptionsFor, schedulePresetOf } from '../fichaOutcome.js';

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
