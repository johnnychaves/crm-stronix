// Testes das regras puras da LINHA DO TEMPO (registro 1b).
// Datas sempre em horário LOCAL, como o app grava.

import { describe, it, expect } from 'vitest';
import {
  matchesTimelineFilter,
  timelineTypeLabel,
  groupTimelineByDay,
  buildStageTransitions,
  classifyInteraction,
  TIMELINE_FILTERS
} from '../timeline.js';

describe('classifyInteraction — desfecho de agendamento', () => {
  // O desfecho é gravado com type='daily_goal_done' mas carrega
  // appointmentOutcome. Sem a regra ele caía no balde 'system' e sumia do feed
  // padrão (o interruptor nasce desligado) — justamente onde a aula precisa
  // aparecer com o selo COMPARECEU.
  it('desfecho vai para agendamento, não para sistema', () => {
    expect(classifyInteraction({
      type: 'daily_goal_done',
      appointmentOutcome: 'attended',
      text: '✅ Compareceu — Meta Diária (Aula experimental)'
    })).toBe('appointment');
  });

  it('faltou também é agendamento', () => {
    expect(classifyInteraction({
      type: 'daily_goal_done', appointmentOutcome: 'no_show', text: '🔔 Faltou — Meta Diária (Visita)'
    })).toBe('appointment');
  });

  it('evento da Meta SEM desfecho continua sendo sistema', () => {
    expect(classifyInteraction({
      type: 'daily_goal_done', text: '✅ Contato concluído — Meta Diária'
    })).toBe('system');
  });

  it('matrícula continua ganhando do desfecho (contrato vem primeiro)', () => {
    expect(classifyInteraction({
      type: 'daily_goal_done', appointmentOutcome: 'attended', text: 'Matrícula fechada — Plano Anual'
    })).toBe('contract');
  });
});

describe('TIMELINE_FILTERS — cinco destinos, sistema fora', () => {
  it('tem exatamente os cinco filtros do redesign', () => {
    expect(TIMELINE_FILTERS.map(f => f.id)).toEqual(['all', 'conversation', 'appointment', 'note', 'milestone']);
  });

  it('Sistema não é filtro (virou interruptor)', () => {
    expect(TIMELINE_FILTERS.some(f => f.id === 'system')).toBe(false);
  });
});

describe('matchesTimelineFilter', () => {
  it('"Tudo" aceita qualquer bucket', () => {
    ['conversation', 'status', 'contract', 'note', 'appointment', 'system']
      .forEach(k => expect(matchesTimelineFilter(k, 'all')).toBe(true));
  });

  it('"Marcos" funde mudanças de fase e contrato', () => {
    expect(matchesTimelineFilter('status', 'milestone')).toBe(true);
    expect(matchesTimelineFilter('contract', 'milestone')).toBe(true);
    expect(matchesTimelineFilter('note', 'milestone')).toBe(false);
    expect(matchesTimelineFilter('conversation', 'milestone')).toBe(false);
  });

  it('os demais filtros pegam só o próprio bucket', () => {
    expect(matchesTimelineFilter('conversation', 'conversation')).toBe(true);
    expect(matchesTimelineFilter('appointment', 'conversation')).toBe(false);
    expect(matchesTimelineFilter('note', 'note')).toBe(true);
  });

  it('filtro desconhecido não esconde nada (degrada aberto)', () => {
    expect(matchesTimelineFilter('note', 'inexistente')).toBe(true);
  });
});

describe('timelineTypeLabel — a coluna de versalete', () => {
  const l = (over) => timelineTypeLabel(over);

  it('separa ligação de WhatsApp dentro de conversas', () => {
    expect(l({ _kind: 'conversation', text: '📞 Ligação: sem resposta' })).toBe('Ligação');
    expect(l({ _kind: 'conversation', text: '📲 Mensagem WhatsApp enviada: oi' })).toBe('WhatsApp');
  });

  it('distingue nota fixada', () => {
    expect(l({ _kind: 'note', text: 'x' })).toBe('Nota');
    expect(l({ _kind: 'note', text: 'x', pinned: true })).toBe('Nota fixa');
  });

  it('separa aula de agendamento genérico', () => {
    expect(l({ _kind: 'appointment', text: '🔔 Aula agendada p/ 23/07' })).toBe('Aula');
    expect(l({ _kind: 'appointment', text: '🔔 Visita agendada p/ 23/07' })).toBe('Agenda');
  });

  it('fase e contrato têm rótulo próprio; o resto é sistema', () => {
    expect(l({ _kind: 'status', text: 'Movido para [Negociação]' })).toBe('Fase');
    expect(l({ _kind: 'contract', text: 'Matrícula fechada' })).toBe('Contrato');
    expect(l({ _kind: 'system', text: 'Lead criado' })).toBe('Sistema');
  });
});

describe('groupTimelineByDay — a sub-régua', () => {
  const ev = (id, y, m, d, h) => ({ id, createdAt: new Date(y, m, d, h, 0) });

  it('agrupa por dia local preservando a ordem de entrada', () => {
    const out = groupTimelineByDay([
      ev('a', 2026, 6, 27, 14),
      ev('b', 2026, 6, 27, 9),
      ev('c', 2026, 6, 26, 18),
    ]);
    expect(out.map(([, , evs]) => evs.map(e => e.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('23h e 00h do dia seguinte não caem no mesmo grupo', () => {
    const out = groupTimelineByDay([ev('a', 2026, 6, 27, 23), ev('b', 2026, 6, 28, 0)]);
    expect(out).toHaveLength(2);
  });

  it('ignora eventos sem data em vez de quebrar', () => {
    const out = groupTimelineByDay([{ id: 'x', createdAt: null }, ev('a', 2026, 6, 27, 10)]);
    expect(out).toHaveLength(1);
    expect(out[0][2].map(e => e.id)).toEqual(['a']);
  });
});

describe('buildStageTransitions — origem e tempo na etapa anterior', () => {
  const t = (id, day, stage) => ({ id, createdAt: new Date(2026, 6, day, 10, 0), text: `Movido para a etapa [${stage}] via Kanban.` });
  const CADASTRO = new Date(2026, 5, 25, 10, 0); // 25/06/2026

  it('a origem é o destino da transição anterior', () => {
    const out = buildStageTransitions([t('a', 1, 'Contato feito'), t('b', 27, 'Negociação')], CADASTRO);
    expect(out.a.from).toBe(null);
    expect(out.b.from).toBe('Contato feito');
    expect(out.b.days).toBe(26);
  });

  it('a primeira transição usa o cadastro como régua', () => {
    const out = buildStageTransitions([t('a', 1, 'Contato feito')], CADASTRO);
    expect(out.a).toEqual({ from: null, days: 6, fromCreation: true });
  });

  it('sem data de cadastro não inventa zero — devolve null', () => {
    const out = buildStageTransitions([t('a', 1, 'Contato feito')], null);
    expect(out.a.days).toBe(null);
    expect(out.a.fromCreation).toBe(false);
  });

  it('evento sem etapa entre colchetes não quebra a cadeia', () => {
    const perda = { id: 'p', createdAt: new Date(2026, 6, 10, 10, 0), text: 'Lead perdido. Motivo: Preço' };
    const out = buildStageTransitions([t('a', 1, 'Contato feito'), perda, t('c', 20, 'Negociação')], CADASTRO);
    // A perda não vira origem; 'Contato feito' segue valendo, e a contagem
    // continua a partir dela (01/07 → 20/07 = 19d).
    expect(out.c.from).toBe('Contato feito');
    expect(out.c.days).toBe(19);
  });

  it('ordena por data mesmo recebendo a lista fora de ordem', () => {
    const out = buildStageTransitions([t('b', 27, 'Negociação'), t('a', 1, 'Contato feito')], CADASTRO);
    expect(out.b.from).toBe('Contato feito');
  });

  it('nunca devolve duração negativa', () => {
    const out = buildStageTransitions([t('a', 1, 'Contato feito')], new Date(2026, 6, 5));
    expect(out.a.days).toBe(0);
  });

  it('lista vazia devolve mapa vazio', () => {
    expect(buildStageTransitions([], CADASTRO)).toEqual({});
    expect(buildStageTransitions(null, CADASTRO)).toEqual({});
  });
});
