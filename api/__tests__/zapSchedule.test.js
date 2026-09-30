import { describe, it, expect, vi, afterAll } from 'vitest';

// O agendamento pelo Stronizap roda numa função da Vercel, com o processo em
// UTC (lá o TZ é variável reservada). Como em zapFuso.test.js, o processo vai
// para UTC antes de importar as regras, e o primeiro teste confere que a
// troca pegou: na máquina de desenvolvimento, que fica em Brasília, um erro
// de fuso não apareceria.
const fusoDaMaquina = vi.hoisted(() => {
  const antes = process.env.TZ;
  process.env.TZ = 'UTC';
  return antes;
});

import {
  SCHEDULE_LIMIT, LEAD_IDS_MAX, ZAP_SCHEDULE_MESSAGES, unitsView, scheduleCatalogView, suggestedDays, countsForMeta,
  wardRelationship, appointmentDetailOf, scheduleTargets, readScheduleOptionsBody, buildScheduleOptions
} from '../_zapSchedule.js';

afterAll(() => {
  if (fusoDaMaquina === undefined) delete process.env.TZ;
  else process.env.TZ = fusoDaMaquina;
});

// Instante escrito no horário de Brasília: brt('2026-09-29T15:40').
const brt = (s) => new Date(`${s}:00-03:00`);
// Terça, 29/09/2026, às 15:40 de Brasília, como nos mockups.
const AGORA = brt('2026-09-29T15:40');
const SEG_A_SEX = [1, 2, 3, 4, 5];

// Equipe como mora em stronix_users. O id é o do documento.
const ANA = { id: 'u-ana', name: 'Ana Souza', email: 'ana@stronix.com.br', authUid: 'auth-ana', role: 'consultant' };
const JOHNNY = { id: 'u-johnny', name: 'Johnny', email: 'johnny@stronix.com.br', authUid: 'auth-johnny', role: 'admin' };

// Os catálogos do agendamento, como a rota lê: unidades, modalidades,
// professores e a config geral da academia.
const CATALOGOS = {
  units: [
    { id: 'un2', name: 'Zona Sul', address: '   ', order: 2 },
    { id: 'un1', name: 'Centro', address: ' Rua Garibaldi, 1200 ', order: 1 },
    { id: 'un3', name: '', order: 3 }
  ],
  modalities: [{ id: 'm2', name: 'Pilates', order: 2 }, { id: 'm1', name: 'Musculação', order: 1 }],
  professors: [
    { id: 'p2', nome: 'Rafael Moura', modalidadeIds: ['m2', 'm1'], order: 2 },
    { id: 'p1', nome: 'Carla Dias', modalidadeIds: ['m2'], order: 1 },
    { id: 'p3', nome: 'Paula Reis', modalidadeIds: ['m2'], ativo: false, order: 3 }
  ],
  config: null
};

// Mariana, lead da Ana, com visita marcada para quarta, 30/09, às 18:00.
const MARIANA = {
  id: 'L1', name: 'Mariana Lima', consultantId: 'u-ana', consultantName: 'Ana Souza', consultantAuthUid: 'auth-ana',
  zapMatchKey: '5198124471', appointmentType: 'visita', appointmentScheduledFor: brt('2026-09-30T18:00'),
  appointmentUnit: 'Centro', nextFollowUpType: 'Visita'
};
// Pedro, filho da Mariana, com aula experimental de pilates marcada.
const MAE = { name: 'Mariana Lima', phone: '(51) 9 9812-4471', relationship: 'Mãe' };
const PEDRO = {
  id: 'L2', name: 'Pedro Lima', isMinor: true, guardian: MAE, sexo: 'Masculino', guardianZapMatchKey: '5198124471',
  appointmentType: 'aula_experimental', appointmentScheduledFor: brt('2026-10-02T19:00'), appointmentModality: 'Pilates',
  appointmentProfessorId: 'p1', appointmentProfessorName: 'Carla Dias', appointmentSoloTraining: false, trialClassesPlanned: 2
};
const LAURA = { id: 'L3', name: 'Laura Lima', isMinor: true, guardian: MAE, sexo: 'Feminino', guardianZapMatchKey: '5198124471' };

describe('processo em UTC, como a função da Vercel', () => {
  it('o fuso do processo é UTC de verdade', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
  });
});

describe('limites e textos', () => {
  it('o limite é de 60 agendamentos por hora, e o appointment-status aceita até 30 leads', () => {
    expect(SCHEDULE_LIMIT).toEqual({ limit: 60, windowMs: 3600000 });
    expect(LEAD_IDS_MAX).toBe(30);
  });

  it('o texto de ids inválidos cita o teto', () => {
    expect(ZAP_SCHEDULE_MESSAGES.leadIds).toBe('Envie de 1 a 30 leads, sem repetir.');
  });
});

describe('scheduleCatalogView: as listas do balão', () => {
  it('na ordem da academia, sem item sem nome e sem professor desligado', () => {
    expect(scheduleCatalogView(CATALOGOS)).toEqual({
      units: [{ name: 'Centro', address: 'Rua Garibaldi, 1200' }, { name: 'Zona Sul', address: null }],
      modalities: [{ id: 'm1', name: 'Musculação' }, { id: 'm2', name: 'Pilates' }],
      professors: [
        { id: 'p1', name: 'Carla Dias', modalityIds: ['m2'] },
        { id: 'p2', name: 'Rafael Moura', modalityIds: ['m2', 'm1'] }
      ],
      trialClassOptions: [1, 2, 3],
      metaWeekdays: SEG_A_SEX
    });
  });

  it('a quantidade de aulas e os dias da meta vêm da config geral, com a normalização do App.jsx', () => {
    const view = scheduleCatalogView({ ...CATALOGOS, config: { trialClassOptions: [2, 1, 2, 'x'], metaWeekdays: [1, 2, 3, 4, 5, 6] } });
    expect(view.trialClassOptions).toEqual([1, 2]);
    expect(view.metaWeekdays).toEqual([1, 2, 3, 4, 5, 6]);
    expect(scheduleCatalogView({ config: { maxTrialClasses: 4 } }).trialClassOptions).toEqual([1, 2, 3, 4]);
  });

  it('unitsView sozinha: lista ausente vira lista vazia', () => {
    expect(unitsView(undefined)).toEqual([]);
  });
});

describe('suggestedDays: os cinco dias no horário de Brasília', () => {
  it('terça às 15:40: começa hoje, só de segunda a sexta', () => {
    expect(suggestedDays({ now: AGORA, metaWeekdays: SEG_A_SEX })).toEqual([
      { date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' },
      { date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' },
      { date: '2026-10-01', label: 'Quinta', defaultTime: '09:00' },
      { date: '2026-10-02', label: 'Sexta', defaultTime: '09:00' },
      { date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' }
    ]);
  });

  it('a partir das 18h de Brasília, começa amanhã', () => {
    expect(suggestedDays({ now: brt('2026-09-29T18:00'), metaWeekdays: SEG_A_SEX }).map((d) => d.date))
      .toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06']);
  });

  it('às 22:30 de Brasília, quando em UTC já é o dia seguinte, amanhã continua sendo o dia 30', () => {
    expect(suggestedDays({ now: brt('2026-09-29T22:30'), metaWeekdays: SEG_A_SEX })[0])
      .toEqual({ date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' });
  });

  it('meia-noite e meia de Brasília ainda é antes das 18h: começa hoje', () => {
    expect(suggestedDays({ now: brt('2026-09-30T00:30'), metaWeekdays: SEG_A_SEX })[0])
      .toEqual({ date: '2026-09-30', label: 'Hoje', defaultTime: '18:00' });
  });

  it('no sábado, com meta de segunda a sexta, hoje e amanhã ficam de fora', () => {
    expect(suggestedDays({ now: brt('2026-10-03T10:00'), metaWeekdays: SEG_A_SEX })).toEqual([
      { date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' },
      { date: '2026-10-06', label: 'Terça', defaultTime: '09:00' },
      { date: '2026-10-07', label: 'Quarta', defaultTime: '09:00' },
      { date: '2026-10-08', label: 'Quinta', defaultTime: '09:00' },
      { date: '2026-10-09', label: 'Sexta', defaultTime: '09:00' }
    ]);
  });

  it('vira o mês e o ano no calendário de Brasília', () => {
    expect(suggestedDays({ now: brt('2026-12-30T10:00'), metaWeekdays: [0, 1, 2, 3, 4, 5, 6] })).toEqual([
      { date: '2026-12-30', label: 'Hoje', defaultTime: '18:00' },
      { date: '2026-12-31', label: 'Amanhã', defaultTime: '09:00' },
      { date: '2027-01-01', label: 'Sexta', defaultTime: '09:00' },
      { date: '2027-01-02', label: 'Sábado', defaultTime: '09:00' },
      { date: '2027-01-03', label: 'Domingo', defaultTime: '09:00' }
    ]);
  });

  it('lista de dias vazia vale todos os dias, como no assistente', () => {
    expect(suggestedDays({ now: brt('2026-10-03T10:00'), metaWeekdays: [] }).map((d) => d.label))
      .toEqual(['Hoje', 'Amanhã', 'Segunda', 'Terça', 'Quarta']);
  });
});

describe('countsForMeta: agendar hoje conta na Meta diária', () => {
  it('consultora em dia de meta conta; gestor nunca', () => {
    expect(countsForMeta({ member: ANA, metaWeekdays: SEG_A_SEX, now: AGORA })).toBe(true);
    expect(countsForMeta({ member: JOHNNY, metaWeekdays: SEG_A_SEX, now: AGORA })).toBe(false);
  });

  it('no sábado só conta se a academia tem meta no sábado', () => {
    const sabado = brt('2026-10-03T10:00');
    expect(countsForMeta({ member: ANA, metaWeekdays: SEG_A_SEX, now: sabado })).toBe(false);
    expect(countsForMeta({ member: ANA, metaWeekdays: [1, 2, 3, 4, 5, 6], now: sabado })).toBe(true);
  });

  it('sexta às 23:30 de Brasília, quando em UTC já é sábado, ainda é sexta', () => {
    expect(countsForMeta({ member: ANA, metaWeekdays: SEG_A_SEX, now: brt('2026-10-02T23:30') })).toBe(true);
  });
});

describe('wardRelationship: o parentesco do menor visto de quem escreve', () => {
  const menor = (relationship, sexo) => ({ guardian: { ...MAE, relationship }, sexo });

  it.each([
    ['Mãe', 'Masculino', 'Filho'], ['Mãe', 'Feminino', 'Filha'], ['Pai', 'Masculino', 'Filho'],
    ['Avó', 'Feminino', 'Neta'], ['Avô', 'Masculino', 'Neto'], ['Tia', 'Masculino', 'Sobrinho'], ['Tio', 'Feminino', 'Sobrinha']
  ])('%s de alguém do sexo %s: %s', (relationship, sexo, esperado) => {
    expect(wardRelationship(menor(relationship, sexo))).toBe(esperado);
  });

  it('sem sexo, com sexo "Outro", com parentesco "Outro" ou sem responsável, não adivinha', () => {
    expect(wardRelationship(menor('Mãe', null))).toBeNull();
    expect(wardRelationship(menor('Mãe', 'Outro'))).toBeNull();
    expect(wardRelationship(menor('Outro', 'Masculino'))).toBeNull();
    expect(wardRelationship({ name: 'Sem responsável' })).toBeNull();
  });
});

describe('appointmentDetailOf: o agendamento que a ficha, o cartão e a Meta mostram', () => {
  const unidades = unitsView(CATALOGOS.units);

  it('visita: a unidade com o endereço de agora', () => {
    expect(appointmentDetailOf(MARIANA, unidades)).toEqual({
      leadId: 'L1', leadName: 'Mariana Lima', type: 'visita', at: '2026-09-30T21:00:00.000Z',
      unit: 'Centro', unitAddress: 'Rua Garibaldi, 1200', modality: null, professorName: null,
      soloTraining: false, quantity: null, outcome: null
    });
  });

  it('aula: modalidade, professor e quantidade', () => {
    expect(appointmentDetailOf(PEDRO, unidades)).toEqual({
      leadId: 'L2', leadName: 'Pedro Lima', type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z',
      unit: null, unitAddress: null, modality: 'Pilates', professorName: 'Carla Dias',
      soloTraining: false, quantity: 2, outcome: null
    });
  });

  it('aula de quem treina sozinho: sem professor', () => {
    const sozinho = { ...PEDRO, appointmentProfessorId: null, appointmentProfessorName: null, appointmentSoloTraining: true };
    expect(appointmentDetailOf(sozinho)).toMatchObject({ professorName: null, soloTraining: true });
  });

  it('unidade que saiu da lista fica sem endereço; campo de aula esquecido numa visita não aparece', () => {
    const lead = { ...MARIANA, appointmentUnit: 'Unidade Antiga', appointmentModality: 'Pilates', trialClassesPlanned: 3 };
    expect(appointmentDetailOf(lead, unidades)).toMatchObject({ unit: 'Unidade Antiga', unitAddress: null, modality: null, quantity: null });
  });

  it('tipo gravado no formato antigo ("Visita") sai no formato do contrato', () => {
    expect(appointmentDetailOf({ ...MARIANA, appointmentType: 'Visita' }).type).toBe('visita');
  });

  it('agendamento antigo, só com nextFollowUp e nextFollowUpType, também vale, como no cartão', () => {
    const antigo = { id: 'L9', name: 'Antigo', nextFollowUpType: 'Aula Experimental', nextFollowUp: brt('2026-10-01T09:00') };
    expect(appointmentDetailOf(antigo)).toMatchObject({ type: 'aula_experimental', at: '2026-10-01T12:00:00.000Z' });
  });

  it('sem agendamento, null', () => {
    expect(appointmentDetailOf({ id: 'L9', name: 'Sem agenda' })).toBeNull();
    expect(appointmentDetailOf(null)).toBeNull();
  });

  it('desfecho: compareceu e faltou aparecem, remarcado não, e cancelado some inteiro', () => {
    expect(appointmentDetailOf({ ...MARIANA, appointmentOutcome: 'attended' }).outcome).toBe('attended');
    expect(appointmentDetailOf({ ...MARIANA, appointmentOutcome: 'no_show' }).outcome).toBe('no_show');
    expect(appointmentDetailOf({ ...MARIANA, appointmentOutcome: 'rescheduled' }).outcome).toBeNull();
    expect(appointmentDetailOf({ ...MARIANA, appointmentOutcome: 'cancelled' })).toBeNull();
  });
});

describe('scheduleTargets: os cadastros do número', () => {
  it('primeiro o do próprio número, depois os menores em ordem de nome, com o parentesco e o agendamento', () => {
    expect(scheduleTargets({ owner: MARIANA, wards: [PEDRO, LAURA] })).toEqual([
      { leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: { type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: null } },
      { leadId: 'L3', name: 'Laura Lima', relationship: 'Filha', appointment: null },
      { leadId: 'L2', name: 'Pedro Lima', relationship: 'Filho', appointment: { type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z', outcome: null } }
    ]);
  });

  it('número sem cadastro: lista vazia', () => {
    expect(scheduleTargets({ owner: null, wards: [] })).toEqual([]);
  });

  it('agendamento que já aconteceu leva o desfecho, pela regra do cartão', () => {
    expect(scheduleTargets({ owner: { ...MARIANA, appointmentOutcome: 'attended' } })[0].appointment)
      .toEqual({ type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: 'attended' });
  });

  it('remarcado não é desfecho, e cancelado tira o agendamento', () => {
    expect(scheduleTargets({ owner: { ...MARIANA, appointmentOutcome: 'rescheduled' } })[0].appointment)
      .toEqual({ type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: null });
    expect(scheduleTargets({ owner: { ...MARIANA, appointmentOutcome: 'cancelled' } })[0].appointment).toBeNull();
  });
});

describe('readScheduleOptionsBody', () => {
  it('lê o número da conversa e o e-mail de quem pede', () => {
    expect(readScheduleOptionsBody({ phone: '5551998124471', actor: { email: ' ANA@stronix.com.br ' } })).toEqual({
      value: { phone: '51998124471', matchKey: '5198124471', email: 'ana@stronix.com.br' }
    });
  });

  it('número que não é WhatsApp com DDD e pedido sem e-mail são recusados no campo', () => {
    expect(readScheduleOptionsBody({ phone: '123', actor: { email: ANA.email } }).refusal).toEqual({
      status: 400, body: { error: 'dados_invalidos', field: 'phone', message: 'O número desta conversa não é um WhatsApp com DDD.' }
    });
    expect(readScheduleOptionsBody({ phone: '5551998124471' }).refusal).toEqual({
      status: 400, body: { error: 'dados_invalidos', field: 'actor', message: 'Não deu para saber quem está agendando.' }
    });
  });
});

describe('buildScheduleOptions: a resposta do schedule-options', () => {
  it('consultora em dia de meta, com a Mariana e o Pedro no número', () => {
    expect(buildScheduleOptions({ member: ANA, catalogs: CATALOGOS, owner: MARIANA, wards: [PEDRO], now: AGORA })).toEqual({
      actor: { id: 'u-ana', name: 'Ana Souza', role: 'consultor', countsForMeta: true },
      targets: [
        { leadId: 'L1', name: 'Mariana Lima', relationship: null, appointment: { type: 'visita', at: '2026-09-30T21:00:00.000Z', outcome: null } },
        { leadId: 'L2', name: 'Pedro Lima', relationship: 'Filho', appointment: { type: 'aula_experimental', at: '2026-10-02T22:00:00.000Z', outcome: null } }
      ],
      units: [{ name: 'Centro', address: 'Rua Garibaldi, 1200' }, { name: 'Zona Sul', address: null }],
      modalities: [{ id: 'm1', name: 'Musculação' }, { id: 'm2', name: 'Pilates' }],
      professors: [
        { id: 'p1', name: 'Carla Dias', modalityIds: ['m2'] },
        { id: 'p2', name: 'Rafael Moura', modalityIds: ['m2', 'm1'] }
      ],
      trialClassOptions: [1, 2, 3],
      days: [
        { date: '2026-09-29', label: 'Hoje', defaultTime: '18:00' },
        { date: '2026-09-30', label: 'Amanhã', defaultTime: '09:00' },
        { date: '2026-10-01', label: 'Quinta', defaultTime: '09:00' },
        { date: '2026-10-02', label: 'Sexta', defaultTime: '09:00' },
        { date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' }
      ]
    });
  });

  it('gestor: papel gestor, fora da Meta', () => {
    expect(buildScheduleOptions({ member: JOHNNY, catalogs: CATALOGOS, now: AGORA }).actor)
      .toEqual({ id: 'u-johnny', name: 'Johnny', role: 'gestor', countsForMeta: false });
  });

  it('os dias seguem a meta da academia', () => {
    const catalogs = { ...CATALOGOS, config: { metaWeekdays: [1, 2, 3, 4, 5, 6] } };
    expect(buildScheduleOptions({ member: ANA, catalogs, now: AGORA }).days.map((d) => d.label))
      .toEqual(['Hoje', 'Amanhã', 'Quinta', 'Sexta', 'Sábado']);
  });
});
