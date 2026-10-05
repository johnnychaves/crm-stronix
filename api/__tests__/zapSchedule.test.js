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
  scheduleInteractionText, pickOpenVisitaId, isOpenAulaRecord, scheduleRecordChanges, buildScheduleWrites, alreadyScheduledBody
} from '../_zapSchedule.js';
import { aulaRecordFields } from '../../src/lib/aulas.js';
import { GUARDIAN_RELATIONSHIPS } from '../../src/lib/guardian.js';

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
    expect(new Date(2026, 8, 8, 18, 0).toISOString()).toBe('2026-09-08T18:00:00.000Z');
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(0);
    expect(['UTC', 'Etc/UTC']).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone);
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

  it('modalidade sem nome, professor sem nome e modalidadeIds malformado não quebram as listas', () => {
    const view = scheduleCatalogView({
      modalities: [{ id: 'm1', name: 'Musculação', order: 1 }, { id: 'm3', name: '   ', order: 2 }, { id: 'm4', order: 3 }],
      professors: [
        // Texto no lugar da lista: não vale como lista de ids.
        { id: 'p1', nome: 'Carla Dias', modalidadeIds: 'm1', order: 1 },
        // Na lista só valem os ids em texto.
        { id: 'p2', nome: 'Rafael Moura', modalidadeIds: ['m1', 7, null, { id: 'm1' }], order: 2 },
        // Sem o campo.
        { id: 'p3', nome: 'Paula Reis', order: 3 },
        // Sem nome: a lista do balão não mostra quem não tem nome.
        { id: 'p4', nome: '   ', modalidadeIds: ['m1'], order: 4 },
        { id: 'p5', modalidadeIds: ['m1'], order: 5 }
      ]
    });
    expect(view.modalities).toEqual([{ id: 'm1', name: 'Musculação' }]);
    expect(view.professors).toEqual([
      { id: 'p1', name: 'Carla Dias', modalityIds: [] },
      { id: 'p2', name: 'Rafael Moura', modalityIds: ['m1'] },
      { id: 'p3', name: 'Paula Reis', modalityIds: [] }
    ]);
  });

  it('dias da meta em lista vazia voltam a ser segunda a sexta, e é assim que o balão e a Meta os leem', () => {
    const vazia = { ...CATALOGOS, config: { metaWeekdays: [] } };
    expect(scheduleCatalogView(vazia).metaWeekdays).toEqual(SEG_A_SEX);
    // Numa terça, lista vazia não conta como "nenhum dia": a consultora conta na Meta.
    expect(buildScheduleOptions({ member: ANA, catalogs: vazia, now: AGORA }).actor.countsForMeta).toBe(true);
    // Num sábado, lista vazia não conta como "todos os dias": o balão começa na segunda.
    const sabado = buildScheduleOptions({ member: ANA, catalogs: vazia, now: brt('2026-10-03T10:00') });
    expect(sabado.days[0]).toEqual({ date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' });
    expect(sabado.actor.countsForMeta).toBe(false);
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

  // Numa segunda de manhã, as cinco segundas são o dia 0 e os dias 7, 14, 21 e
  // 28: a busca precisa de 29 dias, e o teto é de 90.
  it('meta só de segunda: as cinco segundas pedem 29 dias de busca, e cabem no teto', () => {
    expect(suggestedDays({ now: brt('2026-09-28T10:00'), metaWeekdays: [1] })).toEqual([
      { date: '2026-09-28', label: 'Hoje', defaultTime: '18:00' },
      { date: '2026-10-05', label: 'Segunda', defaultTime: '09:00' },
      { date: '2026-10-12', label: 'Segunda', defaultTime: '09:00' },
      { date: '2026-10-19', label: 'Segunda', defaultTime: '09:00' },
      { date: '2026-10-26', label: 'Segunda', defaultTime: '09:00' }
    ]);
  });

  it('dia da meta que nunca chega: a busca termina e devolve lista vazia', () => {
    expect(suggestedDays({ now: AGORA, metaWeekdays: [9] })).toEqual([]);
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

  // Parentesco novo na lista do cadastro sem o inverso aqui mandaria null para
  // o Stronizap em silêncio: este teste obriga a escrever o inverso.
  it('todo parentesco da lista do cadastro, menos "Outro", tem o inverso nos dois sexos', () => {
    for (const relationship of GUARDIAN_RELATIONSHIPS.filter((r) => r !== 'Outro')) {
      const masculino = wardRelationship(menor(relationship, 'Masculino'));
      const feminino = wardRelationship(menor(relationship, 'Feminino'));
      expect([relationship, typeof masculino, typeof feminino]).toEqual([relationship, 'string', 'string']);
      expect(masculino).not.toBe(feminino);
    }
  });

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'parentesco "%s" não é da lista: vai null, e nunca undefined',
    (relationship) => {
      expect(wardRelationship(menor(relationship, 'Masculino'))).toBeNull();
    }
  );
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

  it('unidade esquecida numa aula não aparece: unit e unitAddress saem null', () => {
    const lead = { ...PEDRO, appointmentUnit: 'Centro' };
    expect(appointmentDetailOf(lead, unidades)).toMatchObject({ type: 'aula_experimental', unit: null, unitAddress: null });
  });

  it.each([[2.5], [-1], [0]])('quantidade de aulas %s no lead não passa: sai null', (quantidade) => {
    expect(appointmentDetailOf({ ...PEDRO, trialClassesPlanned: quantidade }).quantity).toBeNull();
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

  // O de 1.001 caracteres está na lista de recusas abaixo.
  it('anotação com 1.000 caracteres exatos passa, e o espaço das pontas não conta', () => {
    expect(readScheduleBody(corpo({ note: ` ${'x'.repeat(1000)} ` })).value.schedule.note).toHaveLength(1000);
  });

  it('nome de quem agenda e canal são cortados nos tetos do cadastro, 120 e 80 caracteres', () => {
    const { value } = readScheduleBody(corpo({}, {
      actor: { email: 'ana@stronix.com.br', name: 'n'.repeat(200) }, channelName: 'c'.repeat(200)
    }));
    expect([value.actorName.length, value.channelName.length]).toEqual([120, 80]);
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
    ['leadId', corpo({ leadId: '__x__' })],
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

  // O Firestore reserva o padrão __x__ para id de documento e recusa a leitura
  // com erro. Barrado aqui, o pedido vira dados_invalidos.
  it('isDocId: o padrão __x__ é reservado pelo Firestore, e só começar ou só terminar com __ não é', () => {
    expect([isDocId('__x__'), isDocId('__lead__'), isDocId('____')]).toEqual([false, false, false]);
    expect([isDocId('__x'), isDocId('x__'), isDocId('_x_')]).toEqual([true, true, true]);
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
    ['repetido', ['L1', 'L1']], ['número', ['L1', 2]], ['com barra', ['a/b']], ['no padrão reservado', ['__x__']]
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

  // A lista do balão não mostra professor sem nome, então a conferência não o
  // aceita, mesmo ativo e dando a modalidade.
  it('professor ativo, da modalidade, mas sem nome é recusado', () => {
    const semNome = { ...CATALOGOS, professors: [...CATALOGOS.professors, { id: 'p4', nome: '  ', modalidadeIds: ['m2'], order: 4 }] };
    expect(checkScheduleCatalog(aula({ professorId: 'p4' }), semNome))
      .toEqual(gone('professorId', 'Esse professor não está mais disponível para essa modalidade. Escolha de novo.'));
  });

  // A conferência lê as mesmas listas normalizadas que o balão recebe: cadastro
  // malformado de um professor é recusa, e não erro da ação nem aceite por
  // acidente (um texto "contém" o id da modalidade).
  it('professor com modalidadeIds que não é lista é recusado, e os outros professores continuam passando', () => {
    const malformados = {
      ...CATALOGOS,
      professors: [
        ...CATALOGOS.professors,
        { id: 'p5', nome: 'Duda Lins', modalidadeIds: 7, order: 4 },
        { id: 'p6', nome: 'Edu Reis', modalidadeIds: 'm2', order: 5 },
        { id: 'p7', nome: 'Fabi Nunes', modalidadeIds: { m2: true }, order: 6 },
        { id: 'p8', nome: 'Gabi Lopes', order: 7 }
      ]
    };
    for (const professorId of ['p5', 'p6', 'p7', 'p8']) {
      expect(checkScheduleCatalog(aula({ professorId }), malformados))
        .toEqual(gone('professorId', 'Esse professor não está mais disponível para essa modalidade. Escolha de novo.'));
    }
    expect(checkScheduleCatalog(aula(), malformados)).toBeNull();
    expect(checkScheduleCatalog(aula({ professorId: 'p2', quantity: 3 }), malformados)).toBeNull();
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

  // Sem a guarda da chave, "sem chave" seria igual a "sem chave": o lead sem
  // zapMatchKey casaria com qualquer pedido sem chave, e o menor com
  // responsável e sem guardianZapMatchKey também.
  it('lead sem chave e pedido sem chave não casam', () => {
    expect(leadBelongsToNumber({ id: 'L9' }, undefined, AGORA)).toBe(false);
    expect(leadBelongsToNumber({ id: 'L9', zapMatchKey: '' }, '', AGORA)).toBe(false);
    const menorSemChave = { id: 'L9', zapMatchKey: '1187654321', isMinor: true, guardian: MAE };
    expect(leadBelongsToNumber(menorSemChave, undefined, AGORA)).toBe(false);
  });
});

// Só o pedido idêntico ao que o lead já tem é "o mesmo agendamento" (dois
// cliques, duas pessoas, o "Tentar de novo"). Qualquer diferença no mesmo
// horário é remarcação e grava, como o assistente da ficha.
describe('hasSameAppointment: o pedido idêntico ao agendamento que o lead já tem', () => {
  // A visita que a Mariana já tem, na quarta 30/09 às 18:00, sem anotação.
  const atVisita = brt('2026-09-30T18:00');
  const visita = (extra = {}) => ({
    leadId: 'L1', type: 'visita', unit: 'Centro', modality: null, professorId: null, soloTraining: false,
    quantity: null, note: null, ...extra
  });
  const pedidoVisita = (extra) => ({ type: 'visita', at: atVisita, schedule: visita(extra) });
  // A aula que o Pedro já tem, na sexta 02/10 às 19:00: pilates com a Carla, 2 aulas.
  const atAula = brt('2026-10-02T19:00');
  const aula = (extra = {}) => ({
    leadId: 'L2', type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', soloTraining: false,
    quantity: 2, note: null, ...extra
  });
  const pedidoAula = (extra) => ({ type: 'aula_experimental', at: atAula, schedule: aula(extra) });
  const PEDRO_SOZINHO = { ...PEDRO, appointmentProfessorId: null, appointmentProfessorName: null, appointmentSoloTraining: true };

  it('visita idêntica é o mesmo agendamento', () => {
    expect(hasSameAppointment(MARIANA, pedidoVisita())).toBe(true);
  });

  it('aula idêntica é o mesmo agendamento, com professor e com "Treina sozinho"', () => {
    expect(hasSameAppointment(PEDRO, pedidoAula())).toBe(true);
    expect(hasSameAppointment(PEDRO_SOZINHO, pedidoAula({ professorId: null, soloTraining: true }))).toBe(true);
  });

  it('academia sem unidade: a visita sem unidade, repetida, é a mesma', () => {
    expect(hasSameAppointment({ ...MARIANA, appointmentUnit: null }, pedidoVisita({ unit: null }))).toBe(true);
  });

  it('a mesma anotação é a mesma, escrita ou em branco', () => {
    const comNota = { ...MARIANA, nextFollowUpNote: 'Vem depois do trabalho.' };
    expect(hasSameAppointment(comNota, pedidoVisita({ note: 'Vem depois do trabalho.' }))).toBe(true);
    expect(hasSameAppointment({ ...MARIANA, nextFollowUpNote: null }, pedidoVisita({ note: null }))).toBe(true);
  });

  it('mesmo horário com outra unidade é remarcação, e não o mesmo agendamento', () => {
    expect(hasSameAppointment(MARIANA, pedidoVisita({ unit: 'Zona Sul' }))).toBe(false);
    expect(hasSameAppointment({ ...MARIANA, appointmentUnit: null }, pedidoVisita({ unit: 'Centro' }))).toBe(false);
  });

  // O balão do Stronizap não recebe a anotação que o lead já tem: pedido sem
  // anotação quer dizer "não digitei", e não "apague". Anotação escrita e
  // diferente da do lead é edição, e grava.
  it('mesma visita com anotação escrita e diferente é remarcação, e sem anotação é o pedido repetido', () => {
    const comNota = { ...MARIANA, nextFollowUpNote: 'Vem depois do trabalho.' };
    expect(hasSameAppointment(comNota, pedidoVisita({ note: 'Vem de manhã.' }))).toBe(false);
    expect(hasSameAppointment(MARIANA, pedidoVisita({ note: 'Vem depois do trabalho.' }))).toBe(false);
    expect(hasSameAppointment(comNota, pedidoVisita({ note: null }))).toBe(true);
  });

  it('a regra da anotação vale também para a aula', () => {
    const comNota = { ...PEDRO, nextFollowUpNote: 'Traz tênis.' };
    expect(hasSameAppointment(comNota, pedidoAula({ note: null }))).toBe(true);
    expect(hasSameAppointment(comNota, pedidoAula({ note: 'Traz tênis.' }))).toBe(true);
    expect(hasSameAppointment(comNota, pedidoAula({ note: 'Traz garrafa.' }))).toBe(false);
  });

  it.each([
    ['outro professor', { professorId: 'p2' }],
    ['"Treina sozinho" no lugar do professor', { professorId: null, soloTraining: true }],
    ['outra modalidade', { modality: 'Musculação' }],
    ['outra quantidade de aulas', { quantity: 3 }],
    ['outra anotação', { note: 'Traz tênis.' }]
  ])('aula no mesmo horário com %s é remarcação', (_, extra) => {
    expect(hasSameAppointment(PEDRO, pedidoAula(extra))).toBe(false);
  });

  it('quem treinava sozinho e agora tem professor é remarcação', () => {
    expect(hasSameAppointment(PEDRO_SOZINHO, pedidoAula())).toBe(false);
  });

  // Aula de antes do "Treina sozinho": sem professor e sem a marca. Pedir a
  // marca no mesmo horário muda o agendamento, mesmo com o professor em null
  // dos dois lados.
  it('aula antiga, sem professor e sem a marca, que agora pede "Treina sozinho" é remarcação', () => {
    const antiga = { ...PEDRO_SOZINHO, appointmentSoloTraining: false };
    expect(hasSameAppointment(antiga, pedidoAula({ professorId: null, soloTraining: true }))).toBe(false);
  });

  it('outro horário, outro tipo, agendamento cancelado ou lead sem agendamento não é o mesmo', () => {
    expect(hasSameAppointment(MARIANA, { ...pedidoVisita(), at: brt('2026-09-30T18:30') })).toBe(false);
    expect(hasSameAppointment(MARIANA, { ...pedidoAula(), at: atVisita })).toBe(false);
    expect(hasSameAppointment({ ...MARIANA, appointmentOutcome: 'cancelled' }, pedidoVisita())).toBe(false);
    expect(hasSameAppointment({ id: 'L9', name: 'Sem agenda' }, pedidoVisita())).toBe(false);
  });

  // O desfecho pode ser marcado no mesmo dia, antes do horário (Agenda de hoje,
  // "Marcar desfecho" ou correção do desfecho). Quem já tem desfecho não tem
  // mais agendamento em aberto: o pedido idêntico grava, e o buildSchedulePatch
  // zera o desfecho.
  it.each([
    ['"Não compareceu"', 'no_show'],
    ['"Compareceu"', 'attended']
  ])('pedido idêntico a um agendamento com o desfecho %s não é o repetido', (_, appointmentOutcome) => {
    expect(hasSameAppointment({ ...MARIANA, appointmentOutcome }, pedidoVisita())).toBe(false);
    expect(hasSameAppointment({ ...PEDRO, appointmentOutcome }, pedidoAula())).toBe(false);
  });

  // "rescheduled" só existe em dado antigo e o cartão o lê como sem desfecho
  // (appointmentOutcomeOf): o lead já está com a data nova, em aberto.
  it('agendamento sem desfecho continua sendo o repetido, inclusive com o "rescheduled" de dado antigo', () => {
    expect(hasSameAppointment({ ...MARIANA, appointmentOutcome: null }, pedidoVisita())).toBe(true);
    expect(hasSameAppointment({ ...PEDRO, appointmentOutcome: null }, pedidoAula())).toBe(true);
    expect(hasSameAppointment({ ...MARIANA, appointmentOutcome: 'rescheduled' }, pedidoVisita())).toBe(true);
  });

  // Academia sem unidade: a visita pedida vai com unit null, e a aula também
  // não tem unidade. Só o tipo separa os dois no mesmo horário.
  it('visita sem unidade no horário de uma aula é outro tipo, e não o mesmo agendamento', () => {
    expect(hasSameAppointment(PEDRO, { ...pedidoVisita({ unit: null }), at: atAula })).toBe(false);
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

  // A api/ grava com poder de admin: o registro que o currentAulaId aponta só é
  // reaproveitado se for mesmo uma aula ainda agendada deste lead.
  it('isOpenAulaRecord: só a aula ainda agendada e do próprio lead', () => {
    expect(isOpenAulaRecord({ status: 'agendada', leadId: 'L1' }, 'L1')).toBe(true);
    // Registro sem `type` é aula (isAulaRecord), e com `type: 'aula'` também.
    expect(isOpenAulaRecord({ status: 'agendada', type: 'aula', leadId: 'L1' }, 'L1')).toBe(true);
    expect(isOpenAulaRecord({ status: 'attended', leadId: 'L1' }, 'L1')).toBe(false);
    expect(isOpenAulaRecord({ status: 'cancelled', leadId: 'L1' }, 'L1')).toBe(false);
    expect(isOpenAulaRecord(null, 'L1')).toBe(false);
  });

  it('isOpenAulaRecord: registro de outro lead, de visita ou sem dono não é reaproveitado', () => {
    expect(isOpenAulaRecord({ status: 'agendada', leadId: 'L9' }, 'L1')).toBe(false);
    expect(isOpenAulaRecord({ status: 'agendada', type: 'visita', leadId: 'L1' }, 'L1')).toBe(false);
    expect(isOpenAulaRecord({ status: 'agendada' }, 'L1')).toBe(false);
    expect(isOpenAulaRecord({ status: 'agendada', leadId: null }, 'L1')).toBe(false);
    // Sem o id do lead, dois "sem dono" não se igualam.
    expect(isOpenAulaRecord({ status: 'agendada' })).toBe(false);
    expect(isOpenAulaRecord({ status: 'agendada', leadId: 'L1' })).toBe(false);
  });
});

// Agendar de novo depois de um desfecho: o registro do agendamento que teve
// "Compareceu" ou "Não veio" fecha com esse desfecho antes de o agendamento
// novo abrir outro, como no assistente da ficha (recordNewAppointment). Os
// registros chegam como a consulta por leadId devolve, com a data em Timestamp.
describe('scheduleRecordChanges: o registro que fecha e o que é reaproveitado', () => {
  const ts = (d) => ({ toDate: () => d });
  // A visita da Mariana na segunda, 28/09, às 18:00, e a data nova, quinta, 01/10, às 18:00.
  const SEG = brt('2026-09-28T18:00');
  const QUI = brt('2026-10-01T18:00');
  const lead = (extra = {}) => ({
    id: 'L1', appointmentType: 'visita', appointmentScheduledFor: SEG, appointmentUnit: 'Centro', currentAulaId: null, ...extra
  });
  const visita = (id, extra = {}) => ({ id, type: 'visita', leadId: 'L1', status: 'agendada', scheduledFor: ts(SEG), ...extra });
  const aula = (id, extra = {}) => ({ id, type: 'aula', leadId: 'L1', status: 'agendada', scheduledFor: ts(SEG), ...extra });
  const VISITA = { type: 'visita' };
  const AULA = { type: 'aula_experimental' };
  const mudancas = (l, schedule, records, at = QUI) => scheduleRecordChanges({ lead: l, schedule, at, records });

  it('visita sem desfecho remarcada: nada fecha, e o registro em aberto é reaproveitado', () => {
    expect(mudancas(lead(), VISITA, [visita('v1')])).toEqual({ close: null, openRecordId: 'v1' });
  });

  it.each([
    ['"Não veio"', 'no_show'],
    ['"Compareceu"', 'attended']
  ])('visita com %s e outra visita em outro dia: o registro fecha com o desfecho, e nasce outro', (_, appointmentOutcome) => {
    expect(mudancas(lead({ appointmentOutcome }), VISITA, [visita('v1')]))
      .toEqual({ close: { id: 'v1', status: appointmentOutcome }, openRecordId: null });
  });

  it('o mesmo instante com o desfecho marcado antes da hora: nada fecha, e o registro continua o mesmo', () => {
    expect(mudancas(lead({ appointmentOutcome: 'no_show' }), VISITA, [visita('v1')], SEG)).toEqual({ close: null, openRecordId: 'v1' });
  });

  it('visita trocada por aula: a visita fecha como cancelada, e a aula aberta do currentAulaId é reaproveitada', () => {
    expect(mudancas(lead({ currentAulaId: 'a1' }), AULA, [visita('v1'), aula('a1', { scheduledFor: ts(brt('2026-09-20T10:00')) })]))
      .toEqual({ close: { id: 'v1', status: 'cancelled' }, openRecordId: 'a1' });
  });

  it('visita com "Compareceu" trocada por aula: fecha como compareceu, e não como cancelada', () => {
    expect(mudancas(lead({ appointmentOutcome: 'attended' }), AULA, [visita('v1')]))
      .toEqual({ close: { id: 'v1', status: 'attended' }, openRecordId: null });
  });

  it('aula trocada por visita: a aula do currentAulaId fecha como cancelada, e a visita em aberto é reaproveitada', () => {
    const comAula = lead({ appointmentType: 'aula_experimental', currentAulaId: 'a1' });
    expect(mudancas(comAula, VISITA, [aula('a1'), visita('v0', { scheduledFor: ts(brt('2026-09-10T18:00')) })]))
      .toEqual({ close: { id: 'a1', status: 'cancelled' }, openRecordId: 'v0' });
  });

  it('aula com "Não veio" que não chegou ao registro fecha como falta; a que já fechou fica como está', () => {
    const comAula = lead({ appointmentType: 'aula_experimental', currentAulaId: 'a1', appointmentOutcome: 'no_show' });
    expect(mudancas(comAula, AULA, [aula('a1')])).toEqual({ close: { id: 'a1', status: 'no_show' }, openRecordId: null });
    expect(mudancas(comAula, AULA, [aula('a1', { status: 'no_show' })])).toEqual({ close: null, openRecordId: null });
  });

  it('registro em aberto de outra data não fecha, como no closeOpenAppointment, e continua sendo o reaproveitado', () => {
    const antigo = visita('v1', { scheduledFor: ts(brt('2026-09-20T18:00')) });
    expect(mudancas(lead({ appointmentOutcome: 'no_show' }), VISITA, [antigo])).toEqual({ close: null, openRecordId: 'v1' });
  });

  it('duas visitas em aberto: fecha a do agendamento e reaproveita a outra, como o assistente, que fecha antes de procurar', () => {
    const outra = visita('v2', { scheduledFor: ts(brt('2026-09-10T18:00')) });
    expect(mudancas(lead({ appointmentOutcome: 'no_show' }), VISITA, [visita('v1'), outra]))
      .toEqual({ close: { id: 'v1', status: 'no_show' }, openRecordId: 'v2' });
  });

  it('o registro de outro lead no currentAulaId não fecha nem é reaproveitado', () => {
    const comAula = lead({ appointmentType: 'aula_experimental', currentAulaId: 'a9', appointmentOutcome: 'no_show' });
    expect(mudancas(comAula, AULA, [aula('a9', { leadId: 'L9' })])).toEqual({ close: null, openRecordId: null });
  });

  it('lead sem agendamento, ou com o agendamento cancelado, não fecha nada', () => {
    expect(mudancas({ id: 'L1' }, VISITA, [visita('v1')])).toEqual({ close: null, openRecordId: 'v1' });
    const cancelado = lead({ appointmentType: null, appointmentScheduledFor: null, appointmentOutcome: 'cancelled' });
    expect(mudancas(cancelado, VISITA, [visita('v1')])).toEqual({ close: null, openRecordId: 'v1' });
  });

  it('lead antigo com "Visita" no tipo também fecha', () => {
    expect(mudancas(lead({ appointmentType: 'Visita', appointmentOutcome: 'no_show' }), VISITA, [visita('v1')]))
      .toEqual({ close: { id: 'v1', status: 'no_show' }, openRecordId: null });
  });

  it('sem registros, nada fecha e nada é reaproveitado', () => {
    expect(mudancas(lead({ appointmentOutcome: 'no_show' }), VISITA, [])).toEqual({ close: null, openRecordId: null });
    expect(mudancas(lead({ appointmentOutcome: 'no_show' }), VISITA, undefined)).toEqual({ close: null, openRecordId: null });
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
      currentAulaId: 'aula-velha',
      // A Ana agenda no próprio lead: a tarefa fica com a dona, e o null
      // explícito não deixa o agendamento herdar quem recebeu o anterior.
      appointmentOwnerId: null,
      appointmentOwnerName: null
    });
  });

  it('visita remarcada: o registro em aberto só troca a unidade e a data', () => {
    const { record } = gravar({ schedule: VISITA, at: atVisita, openRecordId: 'visita-aberta', newRecordId: 'rec-novo' });
    expect(record).toEqual({ id: 'visita-aberta', update: { unit: 'Centro', scheduledFor: atVisita } });
  });

  it('com o registro a fechar: ele leva o status e a hora do servidor, e sem ele nada fecha', () => {
    const { closed, record } = gravar({ schedule: VISITA, at: atVisita, close: { id: 'visita-velha', status: 'no_show' }, newRecordId: 'rec-novo' });
    expect(closed).toEqual({ id: 'visita-velha', update: { status: 'no_show', outcomeAt: HORA } });
    expect(record.id).toBe('rec-novo');
    expect(gravar({ schedule: VISITA, at: atVisita, newRecordId: 'rec-novo' }).closed).toBeNull();
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

  // Os campos de consultor do registro são os do dono do lead, como no
  // assistente: com o gestor agendando, o consultor do registro continua a Ana.
  it('o registro novo leva os campos de consultor do dono do lead, e não os de quem agendou', () => {
    const { record } = gravar({ actor: JOHNNY, schedule: VISITA, at: atVisita, newRecordId: 'rec-novo' });
    expect(record.create).toMatchObject({ consultantId: 'u-ana', consultantAuthUid: 'auth-ana', consultantName: 'Ana Souza' });
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
