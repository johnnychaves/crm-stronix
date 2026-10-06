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
  zapSignupPillText,
  zapSignupDetailText,
  originLastOnTies,
  zapScheduleTitle,
  appointmentOriginText,
  isAppointmentReschedule,
  parseAppointment,
  extractStageNameFromInteractionText,
  isOwnerChangeText,
  ownerChangeText,
  TIMELINE_FILTERS
} from '../timeline.js';
import { taskOwnerText } from '../schedulePatch.js';
import { ownerChangeNote } from '../clientRegistration.js';
import {
  buildContractActivate,
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

  it('ativação antes da data marcada: linha comum do tipo Contrato, com o plano e o valor', () => {
    const { interactionText } = buildContractActivate({
      contract: { id: 'k2', planId: 'p2', planName: 'Flow', value: 1788, listValue: 1788, durationMonths: 12, startsAt: D(2026, 10, 12), endsAt: D(2027, 10, 12) },
      previous: null,
      now: D(2026, 9, 30)
    });
    expect(interactionText).toBe('Contrato ativado antes da data marcada — Plano Flow (R$ 1.788,00), vigência 30/09/2026 → 30/09/2027.');
    expect(classifyInteraction({ type: 'status_change', text: interactionText })).toBe('contract');
    expect(contractEventOf(interactionText)).toEqual({ kind: 'ativacao', planName: 'Flow', value: 1788 });
  });

  it('cancelamento do contrato em uso com a renovação marcada: cancelamento, com o plano do contrato cancelado', () => {
    const emUso = { id: 'k1', status: 'ativo', endsAt: D(2026, 10, 11) };
    const proximo = { id: 'k2', planName: 'Flow', startsAt: D(2026, 10, 12), seamless: true };
    const comMotivo = buildContractCancel({ planName: 'Start', cancelledAt: D(2026, 9, 30), reason: 'Financeiro', role: 'inUse', contract: emUso, next: proximo }).interactionText;
    expect(comMotivo).toBe('Contrato cancelado — Plano Start — Financeiro. Encerrado em 30/09/2026. A renovação continua marcada para 12/10/2026.');
    expect(contractEventOf(comMotivo)).toEqual({ kind: 'cancelamento', planName: 'Start', value: null });
    // Sem motivo, o plano para no ponto.
    const semMotivo = buildContractCancel({ planName: 'Start', cancelledAt: D(2026, 9, 30), role: 'inUse', contract: emUso, next: proximo }).interactionText;
    expect(contractEventOf(semMotivo)).toEqual({ kind: 'cancelamento', planName: 'Start', value: null });
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
      buildRenewalCancel({ contract: { ...renovacao, planName: null }, previous: { ...anterior, planName: null }, cancelledAt: D(2026, 9, 29) }).interactionText,
      buildContractActivate({ contract: { id: 'k2', planName: 'Flow', value: 1788, durationMonths: 12, startsAt: D(2026, 10, 12) }, previous: null, now: D(2026, 9, 30) }).interactionText,
      buildContractCancel({ planName: 'Anual', cancelledAt: D(2026, 5, 14), reason: 'Financeiro', role: 'inUse', contract: { id: 'k1' }, next: { id: 'k2', startsAt: D(2026, 6, 1) } }).interactionText,
      buildContractCancel({ cancelledAt: D(2026, 5, 14), role: 'inUse', contract: { id: 'k1' }, next: { id: 'k2', startsAt: D(2026, 6, 1) } }).interactionText,
      buildContractCancel({ planName: 'Flow', cancelledAt: D(2026, 10, 20), reason: 'Financeiro', replacement: anterior }).interactionText,
      buildContractCancel({ cancelledAt: D(2026, 10, 20), replacement: { ...anterior, planName: null } }).interactionText
    ];
    textos.forEach((text) => {
      expect(classifyInteraction({ type: 'status_change', text }), text).toBe('contract');
      expect(contractEventOf(text), text).not.toBeNull();
    });
  });

  // Decisão do Johnny (01/10/2026): cancelado o último contrato com outro em
  // uso, o texto ganha a frase do contrato que continua. O plano lido é o do
  // contrato cancelado, nunca o do que continua, e sem plano no cancelado o
  // leitor não pega o "Plano" da frase nova.
  it('cancelamento com outro contrato em uso: o plano lido é o do contrato cancelado', () => {
    const outro = { id: 'k1', planName: 'Start', status: 'ativo', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };
    const comPlano = buildContractCancel({ planName: 'Flow', cancelledAt: D(2026, 10, 20), reason: 'Financeiro', replacement: outro }).interactionText;
    expect(comPlano).toBe('Contrato cancelado — Plano Flow — Financeiro. Encerrado em 20/10/2026. O cliente continua com o contrato Plano Start.');
    expect(contractEventOf(comPlano)).toEqual({ kind: 'cancelamento', planName: 'Flow', value: null });
    const semMotivo = buildContractCancel({ planName: 'Flow', cancelledAt: D(2026, 10, 20), replacement: outro }).interactionText;
    expect(contractEventOf(semMotivo)).toEqual({ kind: 'cancelamento', planName: 'Flow', value: null });
    const semPlano = buildContractCancel({ cancelledAt: D(2026, 10, 20), replacement: outro }).interactionText;
    expect(semPlano).toBe('Contrato cancelado. Encerrado em 20/10/2026. O cliente continua com o contrato Plano Start.');
    expect(contractEventOf(semPlano)).toEqual({ kind: 'cancelamento', planName: null, value: null });
    const outroSemPlano = buildContractCancel({ planName: 'Flow', cancelledAt: D(2026, 10, 20), replacement: { ...outro, planName: null } }).interactionText;
    expect(outroSemPlano).toBe('Contrato cancelado — Plano Flow. Encerrado em 20/10/2026. O cliente continua com o outro contrato.');
    expect(contractEventOf(outroSemPlano).planName).toBe('Flow');
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

describe('marco de início do cadastro pelo Stronizap (type zap_signup)', () => {
  const MARCO = {
    type: 'zap_signup',
    text: 'Cadastrado pelo Stronizap por Johnny. Consultor responsável: Ana Souza. Canal Recepção.',
    consultantName: 'Johnny',
    ownerName: 'Ana Souza',
    zapChannelName: 'Recepção',
    createdAt: new Date(2026, 8, 28, 14, 32)
  };

  it('tem bucket próprio, decidido pelo type', () => {
    expect(classifyInteraction(MARCO)).toBe('origin');
    // Nem o texto de conversa leva o marco para outro bucket.
    expect(classifyInteraction({ ...MARCO, text: '📲 Mensagem WhatsApp enviada: oi' })).toBe('origin');
  });

  it('entra em Marcos e em Tudo, e não em Anotações', () => {
    expect(matchesTimelineFilter('origin', 'milestone')).toBe(true);
    expect(matchesTimelineFilter('origin', 'all')).toBe(true);
    expect(matchesTimelineFilter('origin', 'note')).toBe(false);
  });

  it("rótulo da coluna: 'Início'", () => {
    expect(timelineTypeLabel({ _kind: 'origin' })).toBe('Início');
  });

  it('pílula: quem cadastrou, o dia e a hora', () => {
    expect(zapSignupPillText(MARCO)).toBe('cadastrado pelo Stronizap por Johnny em 28/09 às 14:32');
    expect(zapSignupPillText({ ...MARCO, consultantName: '' })).toBe('cadastrado pelo Stronizap em 28/09 às 14:32');
    expect(zapSignupPillText({ ...MARCO, createdAt: null })).toBe('cadastrado pelo Stronizap por Johnny');
  });

  it('linha de baixo: o consultor responsável só quando é outra pessoa, e o canal', () => {
    expect(zapSignupDetailText(MARCO)).toBe('Consultor responsável Ana Souza · canal Recepção');
    expect(zapSignupDetailText({ ...MARCO, ownerName: undefined })).toBe('Canal Recepção');
    expect(zapSignupDetailText({ ...MARCO, zapChannelName: null })).toBe('Consultor responsável Ana Souza');
    expect(zapSignupDetailText({ ...MARCO, ownerName: null, zapChannelName: '' })).toBeNull();
  });
});

describe('originLastOnTies: o marco de início embaixo de quem tem o mesmo horário', () => {
  const as = (h, m) => new Date(2026, 8, 29, h, m);
  const MARCO = { id: 'z1', _kind: 'origin', createdAt: as(14, 32) };
  const NOTA = { id: 'n1', _kind: 'note', createdAt: as(14, 32) };
  const DEPOIS = { id: 'd1', _kind: 'note', createdAt: as(15, 10) };
  const ANTES = { id: 'a1', _kind: 'status', createdAt: as(9, 0) };

  it('mesmo horário: a observação do cadastro fica acima do marco, venha na ordem que vier', () => {
    expect(originLastOnTies([MARCO, NOTA]).map((i) => i.id)).toEqual(['n1', 'z1']);
    expect(originLastOnTies([NOTA, MARCO]).map((i) => i.id)).toEqual(['n1', 'z1']);
  });

  it('horários diferentes seguem como vieram, do mais novo para o mais antigo', () => {
    expect(originLastOnTies([DEPOIS, MARCO, NOTA, ANTES]).map((i) => i.id)).toEqual(['d1', 'n1', 'z1', 'a1']);
  });

  it('sem data não se junta a ninguém, e a lista original não muda', () => {
    const semData = { id: 's1', _kind: 'note', createdAt: null };
    const lista = [MARCO, semData, NOTA];
    expect(originLastOnTies(lista).map((i) => i.id)).toEqual(['z1', 's1', 'n1']);
    expect(lista.map((i) => i.id)).toEqual(['z1', 's1', 'n1']);
  });
});

describe('agendamento feito pelo Stronizap', () => {
  it('zapScheduleTitle: o detalhe do autor, com o canal quando ele veio', () => {
    expect(zapScheduleTitle({ via: 'stronizap', zapChannelName: 'Recepção' })).toBe('Agendado pelo Stronizap, canal Recepção');
    expect(zapScheduleTitle({ via: 'stronizap', zapChannelName: '  ' })).toBe('Agendado pelo Stronizap');
    expect(zapScheduleTitle({ via: 'stronizap' })).toBe('Agendado pelo Stronizap');
  });

  it('zapScheduleTitle: agendamento que não veio do Stronizap não tem detalhe', () => {
    expect(zapScheduleTitle({ zapChannelName: 'Recepção' })).toBeNull();
    expect(zapScheduleTitle({ via: 'outro' })).toBeNull();
    expect(zapScheduleTitle(null)).toBeNull();
  });

  it('appointmentOriginText: o rodapé do desfecho, com o Stronizap quando o agendamento veio de lá', () => {
    const at = new Date(2026, 8, 29, 15, 42);
    expect(appointmentOriginText({ at, by: 'Ana Souza', via: 'stronizap' })).toBe('Agendada em 29/09 por Ana Souza, pelo Stronizap');
    expect(appointmentOriginText({ at, by: 'Ana Souza' })).toBe('Agendada em 29/09 por Ana Souza');
    expect(appointmentOriginText({ at, via: 'stronizap' })).toBe('Agendada em 29/09, pelo Stronizap');
    expect(appointmentOriginText({ at: new Date('x') })).toBe('');
  });
});

describe('isAppointmentReschedule: o Remarcar da Meta Diária', () => {
  const quando = new Date(2026, 9, 3, 18, 0);

  it('visita ou aula marcada de novo, com o rescheduledFor e o volumeKind do tipo, é Remarcar', () => {
    expect(isAppointmentReschedule({ type: 'note', volumeKind: 'visita', rescheduledFor: quando })).toBe(true);
    expect(isAppointmentReschedule({ type: 'note', volumeKind: 'aula_experimental', rescheduledFor: quando })).toBe(true);
  });

  it('o Remarcar de outro dia, que leva o desfecho "rescheduled" na mesma linha, também é', () => {
    expect(isAppointmentReschedule({
      type: 'daily_goal_done', appointmentOutcome: 'rescheduled', volumeKind: 'visita', rescheduledFor: quando
    })).toBe(true);
  });

  // O próximo contato e o contato reagendado também gravam o rescheduledFor,
  // mas com o volumeKind do contato. Só o rescheduledFor contaria os dois.
  it.each(['mensagem', 'ligacao', undefined])('o rescheduledFor com o volumeKind %s não é agendamento', (volumeKind) => {
    expect(isAppointmentReschedule({ type: 'note', volumeKind, rescheduledFor: quando })).toBe(false);
  });

  // O agendamento do assistente e o da ponte já são linha de agendamento pelo
  // texto (🔔), e não levam rescheduledFor.
  it('sem o rescheduledFor não é Remarcar', () => {
    expect(isAppointmentReschedule({ type: 'note', volumeKind: 'visita', via: 'stronizap' })).toBe(false);
    expect(isAppointmentReschedule({ type: 'note' })).toBe(false);
    expect(isAppointmentReschedule(null)).toBe(false);
    expect(isAppointmentReschedule(undefined)).toBe(false);
  });
});

// Quando a tarefa do dia fica com outra pessoa, o texto do agendamento termina
// com " · tarefa de <nome>" (taskOwnerText, em schedulePatch.js), na visita e
// na aula agendadas no lead de outro consultor e no contato delegado. É assim
// que o dono do lead fica sabendo pela ficha, e o parser entrega o nome para o
// cartão do agendamento. Os textos aqui saem do mesmo taskOwnerText.
describe('parseAppointment: de quem é a tarefa', () => {
  const agendamento = (text) => ({ type: 'note', text });

  it('visita agendada por outra pessoa, com a anotação depois', () => {
    const i = agendamento(`🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00${taskOwnerText('Bruno Lima')}. Obs: Vem depois do trabalho.`);
    expect(parseAppointment(i)).toEqual({
      kind: 'visit', label: 'Visita à unidade', when: new Date(2026, 9, 1, 18, 0),
      location: 'Unidade Centro', note: 'Vem depois do trabalho.', taskOwner: 'Bruno Lima'
    });
  });

  it('aula com professor: o " · " do professor não é o dono da tarefa', () => {
    const i = agendamento(`🔔 Aula Experimental agendada (Pilates · 1 aula) · Carla Dias p/ 02/10/2026, 19:00${taskOwnerText('Ana Souza')}.`);
    expect(parseAppointment(i)).toMatchObject({ kind: 'class', when: new Date(2026, 9, 2, 19, 0), note: null, taskOwner: 'Ana Souza' });
  });

  it('contato delegado', () => {
    const i = agendamento(`🔔 Mensagem agendada p/ 08/10/2026, 10:00${taskOwnerText('Bia')}.`);
    expect(parseAppointment(i)).toMatchObject({ kind: 'message', when: new Date(2026, 9, 8, 10, 0), taskOwner: 'Bia' });
  });

  it('nome com ponto e o texto de reserva, sem nome', () => {
    expect(parseAppointment(agendamento(`🔔 Visita agendada p/ 01/10/2026, 18:00${taskOwnerText('Ana C. Souza')}.`)).taskOwner)
      .toBe('Ana C. Souza');
    expect(parseAppointment(agendamento(`🔔 Visita agendada p/ 01/10/2026, 18:00${taskOwnerText(null)}.`)).taskOwner)
      .toBe('outro consultor');
  });

  it('agendamento que ficou com o dono do lead não tem dono de tarefa', () => {
    expect(parseAppointment(agendamento('🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Traz a toalha.')).taskOwner)
      .toBeNull();
    expect(parseAppointment(agendamento('Retorno agendado (Ligação) p/ 01/10, 18:00')).taskOwner).toBeNull();
  });

  it('"tarefa de" escrito na anotação não conta', () => {
    const i = agendamento('🔔 Visita agendada p/ 01/10/2026, 18:00. Obs: avisar · tarefa de Carla.');
    expect(parseAppointment(i)).toMatchObject({ note: 'avisar · tarefa de Carla.', taskOwner: null });
  });
});

// A troca de responsável é gravada como status_change com dois colchetes,
// "Responsável alterado de [Ana] para [Bruno]." (ownerChangeNote, em
// clientRegistration.js). O texto não muda, porque o Dashboard CRM a reconhece
// pelo começo (src/lib/crm/contact.js) e as trocas antigas já estão gravadas
// assim. Quem precisa saber que ela não é mudança de fase é a leitura: o nome
// de quem saía virava etapa no chip da ficha e origem da fase seguinte.
describe('troca de responsável na linha do tempo', () => {
  const troca = ownerChangeNote({ fromName: 'Ana Souza', toName: 'Bruno Lima' });

  it('o texto que a ficha grava é reconhecido como troca de responsável', () => {
    expect(isOwnerChangeText(troca)).toBe(true);
    expect(isOwnerChangeText(ownerChangeNote({ fromName: 'sem responsável', toName: 'Bruno Lima' }))).toBe(true);
  });

  it('mudança de fase não é troca de responsável', () => {
    expect(isOwnerChangeText('Movido para a etapa [Negociação] via Kanban.')).toBe(false);
    expect(isOwnerChangeText('Fase alterada para [Negociação].')).toBe(false);
    expect(isOwnerChangeText('')).toBe(false);
    expect(isOwnerChangeText(undefined)).toBe(false);
  });

  it('a troca de responsável não tem etapa', () => {
    expect(extractStageNameFromInteractionText(troca)).toBe('');
  });

  it('a mudança de fase continua com a etapa do colchete', () => {
    expect(extractStageNameFromInteractionText('Movido para a etapa [Negociação] via Kanban.')).toBe('Negociação');
    expect(extractStageNameFromInteractionText('Fase voltou para [Contato feito] após correção do desfecho.')).toBe('Contato feito');
  });

  it('não entra na cadeia de fases: a fase seguinte vem da etapa anterior', () => {
    const fase = (id, day, stage) => ({ id, createdAt: new Date(2026, 6, day, 10, 0), text: `Movido para a etapa [${stage}] via Kanban.` });
    const doDono = { id: 'r', createdAt: new Date(2026, 6, 5, 10, 0), text: troca };
    const out = buildStageTransitions([fase('a', 2, 'Contato feito'), doDono, fase('c', 9, 'Negociação')], new Date(2026, 5, 25, 10, 0));
    expect(out.c.from).toBe('Contato feito');
    expect(out.c.days).toBe(7);
  });

  it('a coluna de tipo diz Responsável, e não Fase', () => {
    expect(timelineTypeLabel({ _kind: 'status', text: troca })).toBe('Responsável');
    expect(timelineTypeLabel({ _kind: 'status', text: 'Movido para a etapa [Negociação] via Kanban.' })).toBe('Fase');
  });

  it('o texto da linha sai sem os colchetes', () => {
    expect(ownerChangeText(troca)).toBe('Responsável alterado de Ana Souza para Bruno Lima.');
  });

  it('segue nos Marcos, como hoje', () => {
    expect(classifyInteraction({ type: 'status_change', text: troca })).toBe('status');
  });
});
