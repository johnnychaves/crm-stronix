// Testes das regras puras da LINHA DO TEMPO (registro 1b).
// Datas sempre em horário LOCAL, como o app grava.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  matchesTimelineFilter,
  timelineTypeLabel,
  groupTimeline,
  timelineStamp,
  buildStageTransitions,
  classifyInteraction,
  contractEventOf,
  TIMELINE_FILTERS
} from '../timeline.js';
import {
  buildContractCancel,
  buildContractEdit,
  buildContractPause,
  buildContractResume,
  buildMatriculaInteractionText,
  buildRenewalCancel
} from '../contracts.js';

const D = (y, m, d) => new Date(y, m - 1, d);

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

  it('eventos do funil Upgrade são marcos (status), não contrato', () => {
    expect(classifyInteraction({ type: 'status_change', text: 'Upgrade: entrou na etapa Aguardando contato.' })).toBe('status');
    expect(classifyInteraction({ type: 'status_change', text: 'Upgrade: não quis. Motivo: Preço.' })).toBe('status');
  });

  it('evento do Upgrade cuja etapa ou nota cita plano/renovação continua marco de status', () => {
    expect(classifyInteraction({ type: 'status_change', text: 'Upgrade: entrou na etapa Plano apresentado.' })).toBe('status');
    expect(classifyInteraction({ type: 'status_change', text: 'Upgrade: movido para a etapa Em contato. Obs: quer renovação antecipada' })).toBe('status');
    // Matrícula de verdade continua contrato.
    expect(classifyInteraction({ type: 'status_change', text: 'Matrícula realizada — Plano Gold (R$ 249,00). Vigência até 01/01/2027.' })).toBe('contract');
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

describe('groupTimeline: blocos por mês, com o nome e o ano', () => {
  // Relógio parado numa sexta, 25/09/2026 às 15h. Com os blocos antigos, os
  // eventos do primeiro teste caíam em Hoje, Ontem, Esta semana e Este mês, e
  // uma nota sozinha no bloco ficava sem o dia.
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 25, 15, 0)); });
  afterEach(() => { vi.useRealTimers(); });

  const ev = (id, y, m, d, h) => ({ id, createdAt: new Date(y, m, d, h, 0) });
  const labels = (groups) => groups.map(([label]) => label);
  const ids = (groups) => groups.map(([, evs]) => evs.map(e => e.id));

  it('o mês corrente sai com o nome e o ano, sem Hoje, Ontem, Esta semana ou Este mês', () => {
    const out = groupTimeline([
      ev('hoje', 2026, 8, 25, 14),
      ev('ontem', 2026, 8, 24, 10),
      ev('semana', 2026, 8, 22, 9),
      ev('mes', 2026, 8, 3, 18),
    ]);
    expect(labels(out)).toEqual(['Setembro de 2026']);
    expect(ids(out)).toEqual([['hoje', 'ontem', 'semana', 'mes']]);
  });

  it('cada mês vira um bloco, na ordem em que os eventos chegam', () => {
    const out = groupTimeline([
      ev('a', 2026, 8, 25, 14),
      ev('b', 2026, 8, 2, 9),
      ev('c', 2026, 7, 30, 16),
      ev('d', 2026, 6, 15, 11),
    ]);
    expect(labels(out)).toEqual(['Setembro de 2026', 'Agosto de 2026', 'Julho de 2026']);
    expect(ids(out)).toEqual([['a', 'b'], ['c'], ['d']]);
  });

  it('o mesmo mês de anos diferentes não se mistura', () => {
    const out = groupTimeline([ev('a', 2026, 8, 3, 10), ev('b', 2025, 8, 20, 10)]);
    expect(labels(out)).toEqual(['Setembro de 2026', 'Setembro de 2025']);
  });

  it('a virada do mês segue o horário local: 23h do dia 31 fica no mês de antes', () => {
    const out = groupTimeline([ev('a', 2026, 8, 1, 0), ev('b', 2026, 7, 31, 23)]);
    expect(labels(out)).toEqual(['Setembro de 2026', 'Agosto de 2026']);
    expect(ids(out)).toEqual([['a'], ['b']]);
  });

  it('ignora evento sem data, ou com data inválida, em vez de quebrar', () => {
    const out = groupTimeline([
      { id: 'x', createdAt: null },
      { id: 'y', createdAt: new Date('não é data') },
      ev('a', 2026, 8, 10, 10),
    ]);
    expect(labels(out)).toEqual(['Setembro de 2026']);
    expect(ids(out)).toEqual([['a']]);
  });
});

describe('timelineStamp: o dia e a hora de cada linha', () => {
  it('dia/mês e hora:minuto, com zero à esquerda', () => {
    expect(timelineStamp(new Date(2026, 8, 5, 9, 7))).toBe('05/09 09:07');
  });

  it('meia-noite sai 00:00', () => {
    expect(timelineStamp(new Date(2026, 8, 28, 0, 0))).toBe('28/09 00:00');
  });

  it('sem data válida devolve vazio', () => {
    expect(timelineStamp(null)).toBe('');
    expect(timelineStamp(undefined)).toBe('');
    expect(timelineStamp(new Date('não é data'))).toBe('');
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

  it('evento do funil Upgrade (sem colchetes) não vira origem nem quebra a cadeia', () => {
    const upgrade = { id: 'u', createdAt: new Date(2026, 6, 10, 10, 0), text: 'Upgrade: entrou na etapa Aguardando contato.' };
    const out = buildStageTransitions([t('a', 1, 'Contato feito'), upgrade, t('c', 20, 'Negociação')], CADASTRO);
    expect(out.c.from).toBe('Contato feito');
    expect(out.c.days).toBe(19);
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

describe('contractEventOf: o tipo, o plano e o valor do próprio evento', () => {
  it('matrícula, com o valor gravado no texto', () => {
    const text = buildMatriculaInteractionText({ planName: 'Clube + Start', value: 1308, endsAt: D(2027, 9, 1), isRenewal: false });
    expect(contractEventOf(text)).toEqual({ kind: 'matricula', planName: 'Clube + Start', value: 1308 });
  });

  it('renovação', () => {
    const text = buildMatriculaInteractionText({ planName: 'Anual', value: 1177.2, endsAt: D(2027, 9, 1), isRenewal: true });
    expect(contractEventOf(text)).toEqual({ kind: 'renovacao', planName: 'Anual', value: 1177.2 });
  });

  it('matrícula antiga, com o valor sem centavos', () => {
    expect(contractEventOf('Matrícula realizada — Plano Mensal (R$ 149). Vigência até 01/08/2026.'))
      .toEqual({ kind: 'matricula', planName: 'Mensal', value: 149 });
  });

  it('plano com parênteses no nome', () => {
    expect(contractEventOf('Matrícula realizada — Plano Anual (12m) (R$ 1.308,00). Vigência até 01/09/2027.'))
      .toEqual({ kind: 'matricula', planName: 'Anual (12m)', value: 1308 });
  });

  it('cancelamento', () => {
    const { interactionText } = buildContractCancel({ planName: 'Anual', cancelledAt: D(2026, 5, 14), reason: 'Mudou de cidade' });
    expect(contractEventOf(interactionText)).toEqual({ kind: 'cancelamento', planName: 'Anual', value: null });
  });

  it('trancamento', () => {
    const { interactionText } = buildContractPause({ planName: 'Clube + Start', pausedAt: D(2026, 9, 10), reason: 'Viagem' });
    expect(contractEventOf(interactionText)).toEqual({ kind: 'trancamento', planName: 'Clube + Start', value: null });
  });

  it('reativação', () => {
    const { interactionText } = buildContractResume({
      contract: { pausedAt: D(2026, 9, 1), endsAt: D(2027, 1, 1) },
      resumedAt: D(2026, 9, 13)
    });
    expect(contractEventOf(interactionText)).toEqual({ kind: 'reativacao', planName: null, value: null });
  });

  it('correção', () => {
    const { interactionText } = buildContractEdit({
      contract: { planId: 'p1', planName: 'Mensal', value: 149, durationMonths: 1, startsAt: D(2026, 7, 1), endsAt: D(2026, 8, 1) },
      plan: { id: 'p2', name: 'Anual', value: 1390, durationMonths: 12 },
      value: 1240,
      startsAt: D(2026, 7, 1)
    });
    expect(contractEventOf(interactionText)).toEqual({ kind: 'correcao', planName: 'Anual', value: 1240 });
  });

  it('renovação cancelada antes de começar é cancelamento, não renovação', () => {
    expect(contractEventOf('Renovação cancelada antes de começar: Plano Clube + Flow, motivo Financeiro. O contrato Plano Clube + Start volta a valer até 11/10/2026.'))
      .toEqual({ kind: 'cancelamento', planName: 'Clube + Flow', value: null });
  });

  it('texto que não é de contrato devolve null', () => {
    expect(contractEventOf('Fase alterada para [Plano apresentado].')).toBeNull();
    expect(contractEventOf('')).toBeNull();
  });

  it.each([
    ['Matrícula realizada — Plano Anual (R$ 1.308). Vigência até 01/09/2027.', { kind: 'matricula', planName: 'Anual', value: 1308 }],
    ['Renovação registrada — Plano Anual (R$ 1.177,2). Vigência até 01/09/2027.', { kind: 'renovacao', planName: 'Anual', value: 1177.2 }],
    ['Matrícula realizada — Plano Mensal. Vigência até 01/08/2026.', { kind: 'matricula', planName: 'Mensal', value: null }],
    ['Contrato cancelado — Plano Anual.', { kind: 'cancelamento', planName: 'Anual', value: null }],
    ['Contrato cancelado — Plano Mensal, 2x. Encerrado em 14/05/2026.', { kind: 'cancelamento', planName: 'Mensal, 2x', value: null }],
    ['Contrato trancado a partir de 10/09/2026 — Plano Clube + Start.', { kind: 'trancamento', planName: 'Clube + Start', value: null }],
    ['Renovação cancelada antes de começar: renovação. O contrato Plano Start volta a valer até 11/10/2026.', { kind: 'cancelamento', planName: null, value: null }],
    ['Renovação cancelada antes de começar: Plano Clube + Flow. O contrato Plano Clube + Start volta a valer até 11/10/2026.', { kind: 'cancelamento', planName: 'Clube + Flow', value: null }]
  ])('lê textos antigos e variações: %s', (text, expected) => {
    expect(contractEventOf(text)).toEqual(expected);
  });

  it('todo texto de contrato gravado pelo app cai no balde de contrato e é lido', () => {
    const renovacao = { id: 'k2', planName: 'Flow', renewedFromId: 'k1', status: 'ativo', startsAt: D(2026, 10, 12) };
    const anterior = { id: 'k1', planName: 'Start', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
    const textos = [
      buildMatriculaInteractionText({ planName: 'Anual', value: 1308, endsAt: D(2027, 9, 1), isRenewal: false }),
      buildMatriculaInteractionText({ planName: 'Anual', value: 1308, endsAt: D(2027, 9, 1), isRenewal: true }),
      buildContractCancel({ planName: 'Anual', cancelledAt: D(2026, 5, 14), reason: 'Financeiro' }).interactionText,
      buildContractCancel({ cancelledAt: D(2026, 5, 14) }).interactionText,
      buildContractPause({ planName: 'Anual', pausedAt: D(2026, 9, 10), reason: 'Viagem' }).interactionText,
      buildContractPause({ pausedAt: D(2026, 9, 10) }).interactionText,
      buildContractResume({ contract: { pausedAt: D(2026, 9, 1), endsAt: D(2027, 1, 1) }, resumedAt: D(2026, 9, 13) }).interactionText,
      buildContractEdit({ contract: { planName: 'Mensal', value: 149, durationMonths: 1, startsAt: D(2026, 7, 1) }, plan: { id: 'p2', name: 'Anual', value: 1390, durationMonths: 12 }, value: 1390, startsAt: D(2026, 7, 1) }).interactionText,
      buildRenewalCancel({ contract: renovacao, previous: anterior, cancelledAt: D(2026, 9, 29), reason: 'Financeiro' }).interactionText,
      buildRenewalCancel({ contract: { ...renovacao, planName: null }, previous: { ...anterior, planName: null }, cancelledAt: D(2026, 9, 29) }).interactionText
    ];
    textos.forEach((text) => {
      expect(classifyInteraction({ type: 'status_change', text }), text).toBe('contract');
      expect(contractEventOf(text), text).not.toBeNull();
    });
  });

  // Os dois jeitos de o texto terminar (o contrato renovado volta a valer, ou
  // já tinha vencido), com e sem motivo. O plano lido é o da renovação.
  it('renovação cancelada gravada pelo app: cancelamento, com o plano da renovação', () => {
    const renovacao = { id: 'k2', planName: 'Flow', renewedFromId: 'k1', status: 'ativo', startsAt: D(2026, 10, 12) };
    const emUso = { id: 'k1', planName: 'Start', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
    const vencido = { ...emUso, endsAt: D(2026, 9, 10) };
    const textos = [
      buildRenewalCancel({ contract: renovacao, previous: emUso, cancelledAt: D(2026, 9, 29), reason: 'Financeiro' }).interactionText,
      buildRenewalCancel({ contract: renovacao, previous: emUso, cancelledAt: D(2026, 9, 29) }).interactionText,
      buildRenewalCancel({ contract: renovacao, previous: vencido, cancelledAt: D(2026, 9, 29), reason: 'Financeiro' }).interactionText,
      buildRenewalCancel({ contract: renovacao, previous: vencido, cancelledAt: D(2026, 9, 29) }).interactionText
    ];
    expect(textos.filter((t) => t.includes('volta a valer até'))).toHaveLength(2);
    expect(textos.filter((t) => t.includes('que venceu em'))).toHaveLength(2);
    textos.forEach((text) => {
      expect(classifyInteraction({ type: 'status_change', text }), text).toBe('contract');
      expect(contractEventOf(text), text).toEqual({ kind: 'cancelamento', planName: 'Flow', value: null });
    });
  });
});

describe('classifyInteraction: todo evento de contrato vai para o balde de contrato', () => {
  it('reativação', () => {
    expect(classifyInteraction({ type: 'status_change', text: 'Contrato reativado após 12 dias trancado. Vigência estendida até 13/09/2027.' }))
      .toBe('contract');
  });

  it('trancamento sem plano no texto', () => {
    expect(classifyInteraction({ type: 'status_change', text: 'Contrato trancado a partir de 10/09/2026 — Viagem.' }))
      .toBe('contract');
  });
});
