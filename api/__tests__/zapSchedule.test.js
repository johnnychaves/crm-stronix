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
  wardRelationship, appointmentDetailOf, scheduleTargets, readScheduleOptionsBody, buildScheduleOptions,
  isDocId, readScheduleBody, readStatusBody, checkScheduleCatalog, checkFuture, leadBelongsToNumber, hasSameAppointment,
  scheduleInteractionText, pickOpenVisitaId, isOpenAulaRecord, buildScheduleWrites, alreadyScheduledBody
} from '../_zapSchedule.js';
import { aulaRecordFields } from '../../src/lib/aulas.js';

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

describe('readScheduleBody: só o formato do pedido', () => {
  const VISITA = {
    leadId: 'L1', type: 'visita', unit: 'Centro', modality: null, professorId: null, soloTraining: false,
    quantity: null, date: '2026-10-01', time: '18:00', note: '  Vem depois do trabalho.  '
  };
  const AULA = {
    leadId: 'L2', type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', soloTraining: false,
    quantity: 1, date: '2026-10-02', time: '19:00', note: null
  };
  const corpo = (schedule = {}, extra = {}) => ({
    phone: '5551998124471', actor: { email: ' Ana@Stronix.com.br ', name: ' Ana ' }, channelName: ' Recepção ',
    schedule: { ...VISITA, ...schedule }, ...extra
  });
  const recusa = (b) => readScheduleBody(b).refusal;

  it('visita: número normalizado, e-mail, canal e o instante no horário de Brasília', () => {
    expect(readScheduleBody(corpo())).toEqual({
      value: {
        phone: '51998124471', matchKey: '5198124471', email: 'ana@stronix.com.br', actorName: 'Ana', channelName: 'Recepção',
        at: new Date('2026-10-01T21:00:00.000Z'),
        schedule: {
          leadId: 'L1', type: 'visita', unit: 'Centro', modality: null, professorId: null, soloTraining: false,
          quantity: null, note: 'Vem depois do trabalho.'
        }
      }
    });
  });

  it('aula: modalidade, professor e quantidade; unidade fica null', () => {
    expect(readScheduleBody(corpo(AULA)).value.schedule).toEqual({
      leadId: 'L2', type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', soloTraining: false,
      quantity: 1, note: null
    });
  });

  it('aula de quem treina sozinho: sem professor', () => {
    expect(readScheduleBody(corpo({ ...AULA, professorId: null, soloTraining: true })).value.schedule)
      .toMatchObject({ professorId: null, soloTraining: true });
  });

  it('anotação e canal em branco viram null', () => {
    const { value } = readScheduleBody(corpo({ note: '   ' }, { channelName: '  ' }));
    expect(value.schedule.note).toBeNull();
    expect(value.channelName).toBeNull();
  });

  it.each([
    ['phone', corpo({}, { phone: '123' })],
    ['actor', corpo({}, { actor: { email: 'sem-arroba' } })],
    ['channelName', corpo({}, { channelName: 42 })],
    ['schedule', corpo({}, { schedule: null })],
    ['schedule', corpo({}, { schedule: [] })],
    ['leadId', corpo({ leadId: '' })],
    ['leadId', corpo({ leadId: 'a/b' })],
    ['leadId', corpo({ leadId: 5 })],
    ['type', corpo({ type: 'ligacao' })],
    ['unit', corpo({ unit: 3 })],
    ['note', corpo({ note: 3 })],
    ['quantity', corpo({ ...AULA, quantity: '2' })],
    ['quantity', corpo({ ...AULA, quantity: 1.5 })],
    ['quantity', corpo({ ...AULA, quantity: 0 })],
    ['professorId', corpo({ ...AULA, soloTraining: 'sim' })],
    ['modality', corpo({ modality: 'Pilates' })],
    ['professorId', corpo({ professorId: 'p1' })],
    ['professorId', corpo({ soloTraining: true })],
    ['quantity', corpo({ quantity: 1 })],
    ['unit', corpo({ ...AULA, unit: 'Centro' })],
    ['professorId', corpo({ ...AULA, soloTraining: true })],
    ['date', corpo({ date: '2026-02-30' })],
    ['date', corpo({ date: '01/10/2026' })],
    ['time', corpo({ time: '24:00' })],
    ['time', corpo({ time: '9:00' })],
    ['note', corpo({ note: 'x'.repeat(1001) })]
  ])('formato errado no campo %s é recusado com 400', (field, b) => {
    expect(recusa(b)).toMatchObject({ status: 400, body: { error: 'dados_invalidos', field } });
    expect(typeof recusa(b).body.message).toBe('string');
  });

  it('os textos da tela para dia, horário e anotação', () => {
    expect(recusa(corpo({ date: '2026-02-30' })).body.message).toBe('Escolha o dia.');
    expect(recusa(corpo({ time: '24:00' })).body.message).toBe('Escolha o horário.');
    expect(recusa(corpo({ note: 'x'.repeat(1001) })).body.message).toBe('Anotação longa demais. Use até 1000 caracteres.');
  });

  it('isDocId: texto, sem barra, nem "." nem ".."', () => {
    expect(isDocId('L1')).toBe(true);
    expect([isDocId(''), isDocId('a/b'), isDocId('.'), isDocId('..'), isDocId(7), isDocId('x'.repeat(129))])
      .toEqual([false, false, false, false, false, false]);
  });
});

describe('readStatusBody: de 1 a 30 leads, sem repetir', () => {
  it('lista válida passa como veio', () => {
    expect(readStatusBody({ leadIds: ['L1', 'L2'] })).toEqual({ value: { leadIds: ['L1', 'L2'] } });
    const trinta = Array.from({ length: 30 }, (_, i) => `L${i}`);
    expect(readStatusBody({ leadIds: trinta }).value.leadIds).toHaveLength(30);
  });

  it.each([
    ['ausente', undefined], ['vazia', []], ['31 ids', Array.from({ length: 31 }, (_, i) => `L${i}`)],
    ['repetido', ['L1', 'L1']], ['número', ['L1', 2]], ['com barra', ['a/b']]
  ])('lista %s é recusada no campo leadIds', (_, leadIds) => {
    expect(readStatusBody({ leadIds }).refusal).toEqual({
      status: 400, body: { error: 'dados_invalidos', field: 'leadIds', message: 'Envie de 1 a 30 leads, sem repetir.' }
    });
  });
});

describe('checkScheduleCatalog: o que foi escolhido ainda existe no Stronilead', () => {
  const visita = (unit) => ({ type: 'visita', unit });
  const aula = (extra = {}) => ({ type: 'aula_experimental', modality: 'Pilates', professorId: 'p1', soloTraining: false, quantity: 1, ...extra });
  const gone = (field, message) => ({ status: 422, body: { error: 'catalogo_mudou', field, message } });
  const pick = (field, message) => ({ status: 400, body: { error: 'dados_invalidos', field, message } });

  it('visita numa unidade que existe passa', () => {
    expect(checkScheduleCatalog(visita('Centro'), CATALOGOS)).toBeNull();
  });

  it('com unidade cadastrada, a unidade é obrigatória e precisa existir', () => {
    expect(checkScheduleCatalog(visita(null), CATALOGOS)).toEqual(pick('unit', 'Escolha a unidade.'));
    expect(checkScheduleCatalog(visita('Unidade Antiga'), CATALOGOS))
      .toEqual(gone('unit', 'Essa unidade não existe mais no Stronilead. Escolha de novo.'));
  });

  it('academia sem unidade: visita sem unidade passa, e uma unidade que não existe é recusada', () => {
    const semUnidade = { ...CATALOGOS, units: [] };
    expect(checkScheduleCatalog(visita(null), semUnidade)).toBeNull();
    expect(checkScheduleCatalog(visita('Centro'), semUnidade)).toMatchObject({ status: 422, body: { field: 'unit' } });
  });

  it('aula com modalidade, professor que dá a modalidade e quantidade da academia passa', () => {
    expect(checkScheduleCatalog(aula(), CATALOGOS)).toBeNull();
    expect(checkScheduleCatalog(aula({ professorId: 'p2', quantity: 3 }), CATALOGOS)).toBeNull();
  });

  it('"Treina sozinho" dispensa o professor', () => {
    expect(checkScheduleCatalog(aula({ professorId: null, soloTraining: true }), CATALOGOS)).toBeNull();
  });

  it('modalidade em branco é campo a escolher; modalidade que sumiu é recusada', () => {
    expect(checkScheduleCatalog(aula({ modality: null }), CATALOGOS)).toEqual(pick('modality', 'Escolha a modalidade.'));
    expect(checkScheduleCatalog(aula({ modality: 'Crossfit' }), CATALOGOS))
      .toEqual(gone('modality', 'Essa modalidade não existe mais no Stronilead. Escolha de novo.'));
  });

  it('sem professor e sem "Treina sozinho" é campo a escolher', () => {
    expect(checkScheduleCatalog(aula({ professorId: null }), CATALOGOS))
      .toEqual(pick('professorId', 'Escolha o professor ou "Treina sozinho".'));
  });

  it.each([
    ['desligado', aula({ professorId: 'p3' })],
    ['que não dá a modalidade', aula({ modality: 'Musculação', professorId: 'p1' })],
    ['apagado', aula({ professorId: 'p9' })]
  ])('professor %s é recusado', (_, schedule) => {
    expect(checkScheduleCatalog(schedule, CATALOGOS))
      .toEqual(gone('professorId', 'Esse professor não está mais disponível para essa modalidade. Escolha de novo.'));
  });

  it('quantidade em branco é campo a escolher; fora das opções da academia é recusada', () => {
    expect(checkScheduleCatalog(aula({ quantity: null }), CATALOGOS)).toEqual(pick('quantity', 'Escolha quantas aulas.'));
    expect(checkScheduleCatalog(aula({ quantity: 4 }), CATALOGOS))
      .toEqual(gone('quantity', 'Essa quantidade de aulas não existe mais no Stronilead. Escolha de novo.'));
    expect(checkScheduleCatalog(aula({ quantity: 3 }), { ...CATALOGOS, config: { trialClassOptions: [1, 2] } }))
      .toMatchObject({ status: 422, body: { field: 'quantity' } });
  });
});

describe('checkFuture: horário que já passou não é aceito', () => {
  it('um minuto depois de agora passa; agora e antes, não', () => {
    expect(checkFuture(brt('2026-09-29T15:41'), AGORA)).toBeNull();
    const recusa = { status: 422, body: { error: 'horario_passado', message: 'Esse horário já passou. Escolha outro.' } };
    expect(checkFuture(brt('2026-09-29T15:40'), AGORA)).toEqual(recusa);
    expect(checkFuture(brt('2026-09-28T18:00'), AGORA)).toEqual(recusa);
  });
});

describe('leadBelongsToNumber: o lead é deste número', () => {
  const NUMERO = '5198124471';

  it('o cadastro do próprio número e o menor de quem o número é responsável', () => {
    expect(leadBelongsToNumber(MARIANA, NUMERO, AGORA)).toBe(true);
    expect(leadBelongsToNumber(PEDRO, NUMERO, AGORA)).toBe(true);
  });

  it('quem fez 18 com WhatsApp próprio deixa de ser do número do responsável; sem WhatsApp próprio, continua', () => {
    const adulto = { ...PEDRO, birthDate: new Date('2000-01-10T03:00:00.000Z') };
    expect(leadBelongsToNumber({ ...adulto, whatsapp: '(51) 9 9555-4444' }, NUMERO, AGORA)).toBe(false);
    expect(leadBelongsToNumber(adulto, NUMERO, AGORA)).toBe(true);
  });

  it('outro número, lead ausente ou chave ausente: não', () => {
    expect(leadBelongsToNumber(MARIANA, '1187654321', AGORA)).toBe(false);
    expect(leadBelongsToNumber(null, NUMERO, AGORA)).toBe(false);
    expect(leadBelongsToNumber(MARIANA, null, AGORA)).toBe(false);
  });
});

describe('hasSameAppointment: o mesmo agendamento já gravado', () => {
  const at = brt('2026-09-30T18:00');

  it('mesmo tipo, mesmo dia e mesmo horário', () => {
    expect(hasSameAppointment(MARIANA, { type: 'visita', at })).toBe(true);
  });

  it('outro horário, outro tipo ou agendamento cancelado não é o mesmo', () => {
    expect(hasSameAppointment(MARIANA, { type: 'visita', at: brt('2026-09-30T18:30') })).toBe(false);
    expect(hasSameAppointment(MARIANA, { type: 'aula_experimental', at })).toBe(false);
    expect(hasSameAppointment({ ...MARIANA, appointmentOutcome: 'cancelled' }, { type: 'visita', at })).toBe(false);
  });
});

describe('scheduleInteractionText: o texto do assistente, no horário de Brasília', () => {
  const visita = { type: 'visita', unit: 'Centro', at: brt('2026-10-01T18:00'), note: 'Vem depois do trabalho.' };
  const aula = { type: 'aula_experimental', modality: 'Pilates', quantity: 1, professorId: 'p1', professorName: 'Carla Dias', at: brt('2026-10-02T19:00') };

  it('visita com unidade e anotação', () => {
    expect(scheduleInteractionText(visita)).toBe('🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho.');
  });

  it('visita sem unidade e sem anotação', () => {
    expect(scheduleInteractionText({ ...visita, unit: null, note: null })).toBe('🔔 Visita agendada p/ 01/10/2026, 18:00.');
  });

  it('aula de uma aula, com professor', () => {
    expect(scheduleInteractionText(aula)).toBe('🔔 Aula Experimental agendada (Pilates · 1 aula) · Carla Dias p/ 02/10/2026, 19:00.');
  });

  it('aula de várias aulas', () => {
    expect(scheduleInteractionText({ ...aula, quantity: 2 })).toBe('🔔 Aula Experimental agendada (Pilates · 2 aulas) · Carla Dias p/ 02/10/2026, 19:00.');
  });

  it('aula de quem treina sozinho, com anotação', () => {
    expect(scheduleInteractionText({ ...aula, professorId: null, professorName: null, soloTraining: true, note: 'Traz tênis.' }))
      .toBe('🔔 Aula Experimental agendada (Pilates · 1 aula) · Treina sozinho p/ 02/10/2026, 19:00. Obs: Traz tênis.');
  });

  it('anotação só com espaço não entra', () => {
    expect(scheduleInteractionText({ ...visita, note: '   ' })).toBe('🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00.');
  });

  it('com o processo em UTC, 23:30 de Brasília continua no mesmo dia', () => {
    expect(scheduleInteractionText({ ...visita, at: brt('2026-10-01T23:30'), note: null }))
      .toBe('🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 23:30.');
  });
});

describe('registro em aberto que o assistente reaproveita', () => {
  it('pickOpenVisitaId: a primeira visita agendada; aula (com ou sem type) e visita resolvida não contam', () => {
    const registros = [
      { id: 'a1', status: 'agendada' },
      { id: 'a2', type: 'aula', status: 'agendada' },
      { id: 'v1', type: 'visita', status: 'no_show' },
      { id: 'v2', type: 'visita', status: 'agendada' },
      { id: 'v3', type: 'visita', status: 'agendada' }
    ];
    expect(pickOpenVisitaId(registros)).toBe('v2');
    expect(pickOpenVisitaId(registros.slice(0, 3))).toBeNull();
    expect(pickOpenVisitaId(undefined)).toBeNull();
  });

  it('isOpenAulaRecord: só a aula ainda agendada', () => {
    expect(isOpenAulaRecord({ status: 'agendada' })).toBe(true);
    expect(isOpenAulaRecord({ status: 'attended' })).toBe(false);
    expect(isOpenAulaRecord(null)).toBe(false);
  });
});

describe('buildScheduleWrites: o que o assistente grava, numa gravação só', () => {
  const HORA = Object.freeze({ horaDoServidor: true });
  const MAIS_UM = Object.freeze({ incremento: 1 });
  // A Mariana antes do agendamento: lead da Ana, com uma aula antiga já resolvida.
  const LEAD = {
    id: 'L1', name: 'Mariana Lima', status: 'Primeiro contato', consultantId: 'u-ana', consultantName: 'Ana Souza',
    consultantAuthUid: 'auth-ana', currentAulaId: 'aula-velha', appointmentOutcome: 'no_show'
  };
  const VISITA = { leadId: 'L1', type: 'visita', unit: 'Centro', modality: null, professorId: null, soloTraining: false, quantity: null, note: 'Vem depois do trabalho.' };
  const AULA = { leadId: 'L1', type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', soloTraining: false, quantity: 2, note: null };
  const atVisita = brt('2026-10-01T18:00');
  const atAula = brt('2026-10-02T19:00');
  const gravar = (extra) => buildScheduleWrites({
    lead: LEAD, actor: ANA, professors: CATALOGOS.professors, channelName: 'Recepção', serverTime: HORA, increment: MAIS_UM, ...extra
  });

  it('visita nova: o registro, a interação e o patch do lead, valor por valor', () => {
    const { record, interaction, leadPatch } = gravar({ schedule: VISITA, at: atVisita, newRecordId: 'rec-novo' });
    expect(record).toEqual({
      id: 'rec-novo',
      create: {
        ...aulaRecordFields({
          type: 'visita', leadId: 'L1', leadName: 'Mariana Lima', consultantId: 'u-ana', consultantAuthUid: 'auth-ana',
          consultantName: 'Ana Souza', status: 'agendada', unit: 'Centro', scheduledFor: atVisita
        }),
        createdAt: HORA
      }
    });
    expect(record.create).toMatchObject({ type: 'visita', unit: 'Centro', professorId: null, status: 'agendada', converted: false });
    expect(interaction).toEqual({
      leadId: 'L1',
      leadName: 'Mariana Lima',
      consultantName: 'Ana Souza',
      leadConsultantId: 'u-ana',
      leadConsultantAuthUid: 'auth-ana',
      actorId: 'u-ana',
      actorAuthUid: 'auth-ana',
      createdAt: HORA,
      text: '🔔 Visita agendada (Unidade Centro) p/ 01/10/2026, 18:00. Obs: Vem depois do trabalho.',
      type: 'note',
      volumeKind: 'visita',
      via: 'stronizap',
      zapChannelName: 'Recepção'
    });
    expect(leadPatch).toEqual({
      lastInteractionAt: HORA,
      interactionsCount: MAIS_UM,
      nextFollowUp: atVisita,
      nextFollowUpType: 'Visita',
      nextFollowUpNote: 'Vem depois do trabalho.',
      appointmentModality: null,
      appointmentProfessorId: null,
      appointmentProfessorName: null,
      appointmentSoloTraining: false,
      trialClassesPlanned: null,
      appointmentUnit: 'Centro',
      appointmentType: 'visita',
      appointmentScheduledFor: atVisita,
      appointmentOutcome: null,
      appointmentOutcomeAt: null,
      appointmentOutcomeBy: null,
      // A visita não mexe no ponteiro da aula, como no assistente.
      currentAulaId: 'aula-velha'
    });
  });

  it('visita remarcada: o registro em aberto só troca a unidade e a data', () => {
    const { record } = gravar({ schedule: VISITA, at: atVisita, openRecordId: 'visita-aberta', newRecordId: 'rec-novo' });
    expect(record).toEqual({ id: 'visita-aberta', update: { unit: 'Centro', scheduledFor: atVisita } });
  });

  it('aula nova: o registro leva o professor e o lead passa a apontar para ele', () => {
    const { record, interaction, leadPatch } = gravar({ schedule: AULA, at: atAula, newRecordId: 'rec-novo' });
    expect(record.create).toMatchObject({
      type: 'aula', unit: null, professorId: 'p1', professorName: 'Carla Dias', soloTraining: false, modality: 'Pilates',
      scheduledFor: atAula, status: 'agendada'
    });
    expect(interaction).toMatchObject({
      text: '🔔 Aula Experimental agendada (Pilates · 2 aulas) · Carla Dias p/ 02/10/2026, 19:00.',
      volumeKind: 'aula_experimental'
    });
    expect(leadPatch).toMatchObject({
      nextFollowUpType: 'Aula Experimental', nextFollowUpNote: null, appointmentType: 'aula_experimental',
      appointmentModality: 'Pilates', appointmentProfessorId: 'p1', appointmentProfessorName: 'Carla Dias',
      appointmentSoloTraining: false, trialClassesPlanned: 2, appointmentUnit: null, currentAulaId: 'rec-novo'
    });
  });

  it('aula no registro ainda agendada: atualiza professor, modalidade e data, e o ponteiro continua', () => {
    const { record, leadPatch } = gravar({ schedule: AULA, at: atAula, openRecordId: 'aula-aberta', newRecordId: 'rec-novo' });
    expect(record).toEqual({
      id: 'aula-aberta',
      update: { professorId: 'p1', professorName: 'Carla Dias', soloTraining: false, modality: 'Pilates', scheduledFor: atAula }
    });
    expect(leadPatch.currentAulaId).toBe('aula-aberta');
  });

  it('quem treina sozinho: sem professor no registro, no lead e no texto', () => {
    const { record, interaction, leadPatch } = gravar({ schedule: { ...AULA, professorId: null, soloTraining: true, quantity: 1 }, at: atAula, newRecordId: 'rec-novo' });
    expect(record.create).toMatchObject({ professorId: null, professorName: null, soloTraining: true });
    expect(leadPatch).toMatchObject({ appointmentProfessorId: null, appointmentProfessorName: null, appointmentSoloTraining: true });
    expect(interaction.text).toBe('🔔 Aula Experimental agendada (Pilates · 1 aula) · Treina sozinho p/ 02/10/2026, 19:00.');
  });

  it('o gestor agenda no lead da Ana: ele é o autor, e a Ana continua dona', () => {
    const { interaction } = gravar({ actor: JOHNNY, schedule: VISITA, at: atVisita, newRecordId: 'rec-novo' });
    expect(interaction).toMatchObject({
      consultantName: 'Johnny', actorId: 'u-johnny', actorAuthUid: 'auth-johnny',
      leadConsultantId: 'u-ana', leadConsultantAuthUid: 'auth-ana'
    });
  });

  it('sem canal, zapChannelName vai null; agendar não muda a etapa; nada vai como undefined', () => {
    const { record, interaction, leadPatch } = gravar({ schedule: VISITA, at: atVisita, newRecordId: 'rec-novo', channelName: null });
    expect(interaction.zapChannelName).toBeNull();
    expect('status' in leadPatch).toBe(false);
    for (const gravado of [record.create, interaction, leadPatch]) expect(Object.values(gravado)).not.toContain(undefined);
  });
});

describe('alreadyScheduledBody: a resposta do ja_agendado', () => {
  it('leva o cartão, o agendamento que já existia e o texto', () => {
    expect(alreadyScheduledBody({ card: { found: true }, appointment: { leadId: 'L1' } })).toEqual({
      error: 'ja_agendado', message: 'Esse agendamento já estava no Stronilead.', card: { found: true }, appointment: { leadId: 'L1' }
    });
  });
});
