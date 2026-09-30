// O agendamento feito pelo Stronizap precisa ser lido pelo Stronilead como um
// agendamento do assistente da ficha. Este teste pega o que a ponte grava
// (buildScheduleWrites, em api/_zapSchedule.js) e passa pelas regras que leem
// o agendamento: a linha do tempo (parseAppointment, classifyInteraction), o
// "Já interagido hoje" (hasActiveInteractionToday) e a Meta Diária (volume de
// quem agendou e tarefa do dono no dia). Se uma delas deixar de reconhecer o
// registro, a ficha ou a Meta mudam sem ninguém perceber.
//
// As datas do app são locais; o texto que a ponte grava sai no horário de
// Brasília. Os horários daqui ficam longe da meia-noite, então o teste vale no
// fuso da máquina e no UTC do CI.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildScheduleWrites } from '../../../api/_zapSchedule.js';
import { parseAppointment, classifyInteraction, timelineTypeLabel } from '../timeline.js';
import { hasActiveInteractionToday, ZAP_VIA } from '../leads.js';
import { computeDailyVolume, computeDailyGoalSlots, buildInteractionsByLead } from '../dailyGoal.js';

// 01/10/2026 às 18:00 e 02/10/2026 às 19:00 de Brasília.
const VISITA_EM = new Date('2026-10-01T21:00:00.000Z');
const AULA_EM = new Date('2026-10-02T22:00:00.000Z');

const ANA = { id: 'u-ana', name: 'Ana Souza', authUid: 'auth-ana', role: 'consultant' };
const BRUNO = { id: 'u-bruno', name: 'Bruno Lima', authUid: 'auth-bruno', role: 'consultant' };
// Lead do Bruno, atrasado desde ontem.
const lead = () => ({
  id: 'L1', name: 'Mariana Lima', status: 'Primeiro contato', lifecycleStage: 'lead',
  consultantId: 'u-bruno', consultantName: 'Bruno Lima', consultantAuthUid: 'auth-bruno',
  createdAt: new Date(2026, 8, 1, 10, 0), nextFollowUp: new Date(2026, 8, 30, 10, 0), nextFollowUpType: 'Ligação'
});
const PROFESSORES = [{ id: 'p1', nome: 'Carla Dias', modalidadeIds: ['m2'] }];

// O que a ponte grava quando a Ana agenda, com as datas como o Firestore
// devolve: a hora do servidor vira agora.
function agendar(schedule, at) {
  const { interaction, leadPatch } = buildScheduleWrites({
    lead: lead(), actor: ANA, schedule, at, professors: PROFESSORES, channelName: 'Recepção',
    newRecordId: 'rec-1', serverTime: 'HORA', increment: 'MAIS_UM'
  });
  const agora = new Date();
  const gravada = { id: 'i1', ...interaction, createdAt: agora };
  const patch = { ...leadPatch, lastInteractionAt: agora, interactionsCount: 1 };
  return { interaction: gravada, lead: { ...lead(), ...patch } };
}

const VISITA = { type: 'visita', unit: 'Centro', modality: null, professorId: null, soloTraining: false, quantity: null, note: 'Vem depois do trabalho.' };
const AULA = { type: 'aula_experimental', unit: null, modality: 'Pilates', professorId: 'p1', soloTraining: false, quantity: 1, note: null };

describe('o agendamento da ponte na linha do tempo', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 1, 10, 0)); });
  afterEach(() => { vi.useRealTimers(); });

  it('visita: parseAppointment lê tipo, dia, hora, unidade e anotação', () => {
    const { interaction } = agendar(VISITA, VISITA_EM);
    expect(parseAppointment(interaction)).toEqual({
      kind: 'visit', label: 'Visita à unidade', when: new Date(2026, 9, 1, 18, 0),
      location: 'Unidade Centro', note: 'Vem depois do trabalho.'
    });
  });

  it('aula: parseAppointment lê tipo, dia e hora, sem inventar local', () => {
    const { interaction } = agendar(AULA, AULA_EM);
    expect(parseAppointment(interaction)).toEqual({
      kind: 'class', label: 'Aula experimental', when: new Date(2026, 9, 2, 19, 0), location: null, note: null
    });
  });

  it('entra no filtro Agendamentos, com a coluna Agenda ou Aula, e leva a origem', () => {
    const visita = agendar(VISITA, VISITA_EM).interaction;
    const aula = agendar(AULA, AULA_EM).interaction;
    expect(classifyInteraction(visita)).toBe('appointment');
    expect(timelineTypeLabel({ ...visita, _kind: 'appointment' })).toBe('Agenda');
    expect(timelineTypeLabel({ ...aula, _kind: 'appointment' })).toBe('Aula');
    expect(visita).toMatchObject({ type: 'note', via: ZAP_VIA, zapChannelName: 'Recepção' });
  });
});

describe('o agendamento da ponte na Meta Diária', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 1, 10, 0)); });
  afterEach(() => { vi.useRealTimers(); });

  const hoje = () => new Date(2026, 9, 1);

  it('acende o "Já interagido hoje"', () => {
    const { interaction, lead: agendado } = agendar(VISITA, VISITA_EM);
    expect(hasActiveInteractionToday(agendado, [interaction], hoje())).toBe(true);
  });

  it('o ponto de volume vai para quem agendou, não para o dono do lead', () => {
    const { interaction, lead: agendado } = agendar(VISITA, VISITA_EM);
    expect(interaction.volumeKind).toBe('visita');
    expect(computeDailyVolume([agendado], [interaction], ANA.id, ANA.authUid).agendamentos).toBe(1);
    expect(computeDailyVolume([agendado], [interaction], BRUNO.id, BRUNO.authUid).agendamentos).toBe(0);
  });

  it('no dia, a visita vira tarefa do dono do lead e ele sai dos Atrasados', () => {
    const antes = computeDailyGoalSlots([lead()], new Map(), BRUNO.id);
    expect(antes.map((l) => l.categorySlugs)).toEqual([['atrasado']]);
    const { interaction, lead: agendado } = agendar(VISITA, VISITA_EM);
    const depois = computeDailyGoalSlots([agendado], buildInteractionsByLead([interaction]), BRUNO.id);
    expect(depois.map((l) => l.categorySlugs)).toEqual([['visita_hoje']]);
    expect(depois[0].hasOtherActivityToday).toBe(true);
    expect(computeDailyGoalSlots([agendado], buildInteractionsByLead([interaction]), ANA.id)).toEqual([]);
  });

  it('no dia da aula, ela vira tarefa de Aulas exp. do dono', () => {
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0));
    const { interaction, lead: agendado } = agendar(AULA, AULA_EM);
    const slots = computeDailyGoalSlots([agendado], buildInteractionsByLead([interaction]), BRUNO.id);
    expect(slots.map((l) => l.categorySlugs)).toEqual([['aula_hoje']]);
  });
});
