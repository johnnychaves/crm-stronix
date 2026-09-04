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

  it('type continua sendo a fonte da verdade pro bucket de contrato — texto parecido não basta', () => {
    // Contrato real é SEMPRE gravado com type='status_change' (ver
    // contractsWrites.js). Um desfecho de agendamento cujo texto por
    // coincidência lembra uma matrícula não pode roubar o bucket — isso é
    // exatamente o bug do reagendamento de renovação (ver describe abaixo).
    expect(classifyInteraction({
      type: 'daily_goal_done', appointmentOutcome: 'attended', text: 'Matrícula fechada — Plano Anual'
    })).toBe('appointment');
  });

  it('matrícula/renovação real (status_change) continua indo para contrato', () => {
    expect(classifyInteraction({
      type: 'status_change', text: 'Matrícula realizada — Plano Anual (R$ 199,90). Vigência até 10/08/2027.'
    })).toBe('contract');
    expect(classifyInteraction({
      type: 'status_change', text: 'Renovação registrada — Plano Anual (R$ 199,90). Vigência até 10/08/2027.'
    })).toBe('contract');
  });
});

describe('classifyInteraction — reagendamento/perda de renovação (Meta Diária) não é contrato', () => {
  // Bug real: RenewalOutcomeModal grava a nota do consultor (type='note') e a
  // conclusão de sistema (type='daily_goal_done') com texto livre que
  // menciona "renovação"/"plano" — sem o gate por type, CONTRACT_RE roubava
  // essas interactions pro bucket de contrato e a timeline renderizava a
  // anotação do consultor como se fosse uma matrícula fechada.
  it('nota de reagendamento vai para nota, não para contrato', () => {
    expect(classifyInteraction({
      type: 'note',
      text: 'Motivo do reagendamento: cliente quer decidir entre os planos — próximo contato em 10/08/2026.'
    })).toBe('note');
  });

  it('conclusão de sistema do reagendamento vai para sistema, não para contrato', () => {
    expect(classifyInteraction({
      type: 'daily_goal_done',
      dailyGoalCategory: 'renovacao',
      text: '✅ Renovação — Meta Diária concluída (contato reagendado para 10/08/2026).'
    })).toBe('system');
  });

  it('nota de perda de renovação (não vai renovar) vai para nota, não para contrato', () => {
    expect(classifyInteraction({
      type: 'note',
      text: 'Motivo da perda de renovação: prefere academia mais perto de casa.'
    })).toBe('note');
  });

  it('conclusão de sistema de "não vai renovar" vai para sistema, não para contrato', () => {
    expect(classifyInteraction({
      type: 'daily_goal_done',
      dailyGoalCategory: 'renovacao',
      text: '✅ Renovação — Meta Diária concluída (não vai renovar).'
    })).toBe('system');
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

describe('eventos de indicação (type referral)', () => {
  it("bucket próprio, mesmo com 'matrícula' no texto (gate por type, não por regex)", () => {
    expect(classifyInteraction({ type: 'referral', text: '🎉 João que você indicou fechou matrícula' })).toBe('referral');
    expect(classifyInteraction({ type: 'referral', text: '🤝 Indicado por Maria' })).toBe('referral');
  });

  it('entra no filtro Marcos e não é sistema (não pode sumir do feed padrão)', () => {
    expect(matchesTimelineFilter('referral', 'milestone')).toBe(true);
    expect(matchesTimelineFilter('referral', 'note')).toBe(false);
  });

  it("rótulo da coluna: 'Indicação'", () => {
    expect(timelineTypeLabel({ _kind: 'referral', text: '🤝 Indicou João' })).toBe('Indicação');
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

describe('classifyInteraction: cadastro importado', () => {
  // O texto cita "Plano ..." e cairia no regex de contrato se o gate por type
  // não existisse. É evento de sistema: fica atrás do interruptor.
  it('type import é sistema mesmo mencionando plano e vigência', () => {
    expect(classifyInteraction({
      type: 'import',
      text: 'Cadastro importado do NextFit. Plano Trimestral, vigência até 12/11/2026.'
    })).toBe('system');
  });
});
