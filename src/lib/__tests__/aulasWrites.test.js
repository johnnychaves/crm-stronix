// Gravação no histórico de aulas (stronix_aulas) usada pelo Remarcar da Meta
// Diária e pelo assistente de agendamento da ficha. Sem Firebase de verdade:
// firebase/firestore e ../firebase.js são falsos, e os registros vivem num Map
// em memória. As gravações ficam anotadas em `updates` e `adds` e também valem
// no Map, para o teste do Dashboard CRM ler os registros como ficaram.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appointmentsOf } from '../crm/appointments.js';
import { buildSchedulePatch } from '../schedulePatch.js';

const m = vi.hoisted(() => ({ docs: new Map(), updates: [], adds: [], recusar: false }));

vi.mock('../firebase.js', () => ({ appId: 'acad', AULAS_PATH: 'stronix_aulas', LEADS_PATH: 'stronix_leads' }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => ({ path: p.join('/') }),
  doc: (_db, ...p) => ({ path: p.join('/'), id: p[p.length - 1] }),
  query: (col, ...filtros) => ({ col, filtros }),
  where: (campo, op, valor) => ({ campo, op, valor }),
  getDoc: async (ref) => {
    const d = m.docs.get(ref.id);
    return { exists: () => Boolean(d), data: () => d };
  },
  getDocs: async (q) => {
    const leadId = q.filtros.find((f) => f.campo === 'leadId')?.valor;
    const docs = [...m.docs.entries()]
      .filter(([, d]) => d.leadId === leadId)
      .map(([id, d]) => ({ id, data: () => d }));
    return { docs };
  },
  updateDoc: async (ref, patch) => {
    if (m.recusar) throw new Error('permission-denied');
    m.updates.push({ id: ref.id, patch });
    m.docs.set(ref.id, { ...m.docs.get(ref.id), ...patch });
  },
  addDoc: async (_col, data) => {
    if (m.recusar) throw new Error('permission-denied');
    m.adds.push(data);
    const id = m.adds.length === 1 ? 'novo' : `novo-${m.adds.length}`;
    m.docs.set(id, data);
    return { id };
  },
  serverTimestamp: () => 'TS',
}));

const { upsertScheduledAppointment, closeOpenAppointment, recordNewAppointment } = await import('../aulasWrites.js');

const DIA_VELHO = new Date('2026-10-01T21:00:00.000Z');
const DIA_NOVO = new Date('2026-10-06T21:00:00.000Z');
const lead = { id: 'lead-1', name: 'Mariana Souza', consultantId: 'u-ana', currentAulaId: 'a1' };

beforeEach(() => {
  m.docs.clear();
  m.updates.length = 0;
  m.adds.length = 0;
  m.recusar = false;
});

describe('upsertScheduledAppointment (visita)', () => {
  it('sem unidade no pedido, muda a data da visita aberta e mantém a unidade do registro', async () => {
    m.docs.set('v1', { type: 'visita', leadId: 'lead-1', status: 'agendada', unit: 'Centro', scheduledFor: DIA_VELHO });

    const id = await upsertScheduledAppointment({ db: {}, lead, type: 'visita', fields: { scheduledFor: DIA_NOVO } });

    expect(id).toBe('v1');
    expect(m.updates).toEqual([{ id: 'v1', patch: { scheduledFor: DIA_NOVO } }]);
    expect(m.adds).toEqual([]);
  });

  it('com unidade no pedido, grava a unidade junto, como o assistente da ficha', async () => {
    m.docs.set('v1', { type: 'visita', leadId: 'lead-1', status: 'agendada', unit: 'Centro', scheduledFor: DIA_VELHO });

    await upsertScheduledAppointment({ db: {}, lead, type: 'visita', fields: { unit: 'Zona Sul', scheduledFor: DIA_NOVO } });

    expect(m.updates).toEqual([{ id: 'v1', patch: { unit: 'Zona Sul', scheduledFor: DIA_NOVO } }]);
  });

  it('sem visita aberta, cria o registro, com unidade nula quando o pedido não traz', async () => {
    m.docs.set('v0', { type: 'visita', leadId: 'lead-1', status: 'no_show', scheduledFor: DIA_VELHO });

    const id = await upsertScheduledAppointment({ db: {}, lead, type: 'visita', fields: { scheduledFor: DIA_NOVO } });

    expect(id).toBe('novo');
    expect(m.updates).toEqual([]);
    expect(m.adds).toHaveLength(1);
    expect(m.adds[0]).toMatchObject({ type: 'visita', leadId: 'lead-1', status: 'agendada', unit: null, scheduledFor: DIA_NOVO, createdAt: 'TS' });
  });
});

describe('closeOpenAppointment', () => {
  it('fecha a visita aberta do lead com o status pedido e a hora do servidor', async () => {
    m.docs.set('v1', { type: 'visita', leadId: 'lead-1', status: 'agendada', scheduledFor: DIA_VELHO });

    const id = await closeOpenAppointment({ db: {}, lead, type: 'visita', status: 'no_show' });

    expect(id).toBe('v1');
    expect(m.updates).toEqual([{ id: 'v1', patch: { status: 'no_show', outcomeAt: 'TS' } }]);
  });

  it('não mexe em visita já resolvida nem na aula do lead', async () => {
    m.docs.set('v1', { type: 'visita', leadId: 'lead-1', status: 'attended', scheduledFor: DIA_VELHO });
    m.docs.set('a1', { type: 'aula', leadId: 'lead-1', status: 'agendada', scheduledFor: DIA_VELHO });

    const id = await closeOpenAppointment({ db: {}, lead, type: 'visita', status: 'cancelled' });

    expect(id).toBeNull();
    expect(m.updates).toEqual([]);
  });

  it('não fecha registro aberto de outra data: pode ser histórico antigo, como no applyOutcomeToAula', async () => {
    const leadDoDia = { ...lead, appointmentScheduledFor: DIA_NOVO };
    m.docs.set('v1', { type: 'visita', leadId: 'lead-1', status: 'agendada', scheduledFor: DIA_VELHO });
    m.docs.set('a1', { type: 'aula', leadId: 'lead-1', status: 'agendada', scheduledFor: DIA_VELHO });

    expect(await closeOpenAppointment({ db: {}, lead: leadDoDia, type: 'visita', status: 'no_show' })).toBeNull();
    expect(await closeOpenAppointment({ db: {}, lead: leadDoDia, type: 'aula', status: 'cancelled' })).toBeNull();
    expect(m.updates).toEqual([]);

    m.docs.set('v1', { type: 'visita', leadId: 'lead-1', status: 'agendada', scheduledFor: DIA_NOVO });
    expect(await closeOpenAppointment({ db: {}, lead: leadDoDia, type: 'visita', status: 'no_show' })).toBe('v1');
  });

  it('fecha a aula do currentAulaId só quando ela ainda está agendada', async () => {
    m.docs.set('a1', { type: 'aula', leadId: 'lead-1', status: 'agendada', scheduledFor: DIA_VELHO });
    expect(await closeOpenAppointment({ db: {}, lead, type: 'aula', status: 'cancelled' })).toBe('a1');
    expect(m.updates).toEqual([{ id: 'a1', patch: { status: 'cancelled', outcomeAt: 'TS' } }]);

    m.updates.length = 0;
    m.docs.set('a1', { type: 'aula', leadId: 'lead-1', status: 'no_show', scheduledFor: DIA_VELHO });
    expect(await closeOpenAppointment({ db: {}, lead, type: 'aula', status: 'no_show' })).toBeNull();
    expect(m.updates).toEqual([]);
  });
});

// O assistente de agendamento da ficha (handleWizardConfirm) grava o registro
// por aqui, na regra do Remarcar da Meta Diária (recordPlanFor, em aulas.js).
describe('recordNewAppointment: o registro do agendamento novo do assistente', () => {
  // Setembro e outubro no horário local, como o Dashboard CRM conta.
  const SET_28 = new Date(2026, 8, 28, 18, 0);
  const OUT_06 = new Date(2026, 9, 6, 18, 0);
  const comVisita = (extra = {}) => ({
    ...lead, appointmentType: 'visita', appointmentScheduledFor: SET_28, appointmentUnit: 'Centro', ...extra,
  });
  const visita = (extra = {}) => ({ type: 'visita', leadId: 'lead-1', status: 'agendada', unit: 'Centro', scheduledFor: SET_28, ...extra });
  const novaVisita = { unit: 'Centro', scheduledFor: OUT_06 };
  const novaAula = { professorId: 'p1', professorName: 'Carla Dias', soloTraining: false, modality: 'Pilates', scheduledFor: OUT_06 };

  it('visita com "Não veio" e outra visita em outro dia: a que faltou fecha como falta, e a data nova abre outro registro', async () => {
    m.docs.set('v1', visita());

    const aulaId = await recordNewAppointment({ db: {}, lead: comVisita({ appointmentOutcome: 'no_show' }), appointmentType: 'visita', fields: novaVisita });

    expect(m.updates).toEqual([{ id: 'v1', patch: { status: 'no_show', outcomeAt: 'TS' } }]);
    expect(m.adds).toHaveLength(1);
    expect(m.adds[0]).toMatchObject({ type: 'visita', leadId: 'lead-1', status: 'agendada', unit: 'Centro', scheduledFor: OUT_06 });
    expect(m.docs.get('v1')).toMatchObject({ status: 'no_show', scheduledFor: SET_28 });
    // A visita não mexe no ponteiro da aula.
    expect(aulaId).toBe('a1');
  });

  it('visita com "Compareceu" e outra visita: a que aconteceu fecha como compareceu', async () => {
    m.docs.set('v1', visita());

    await recordNewAppointment({ db: {}, lead: comVisita({ appointmentOutcome: 'attended' }), appointmentType: 'visita', fields: novaVisita });

    expect(m.docs.get('v1')).toMatchObject({ status: 'attended', scheduledFor: SET_28 });
    expect(m.adds).toHaveLength(1);
  });

  it('visita sem desfecho remarcada: o registro em aberto só muda de data, como antes', async () => {
    m.docs.set('v1', visita());

    await recordNewAppointment({ db: {}, lead: comVisita(), appointmentType: 'visita', fields: novaVisita });

    expect(m.updates).toEqual([{ id: 'v1', patch: { unit: 'Centro', scheduledFor: OUT_06 } }]);
    expect(m.adds).toEqual([]);
  });

  it('o mesmo horário com o desfecho marcado antes da hora: o registro continua em aberto e é o mesmo', async () => {
    m.docs.set('v1', visita());

    await recordNewAppointment({
      db: {}, lead: comVisita({ appointmentOutcome: 'no_show' }), appointmentType: 'visita', fields: { unit: 'Centro', scheduledFor: new Date(SET_28) },
    });

    expect(m.docs.get('v1')).toMatchObject({ status: 'agendada' });
    expect(m.adds).toEqual([]);
  });

  it('visita trocada por aula: a visita fecha como cancelada, e o lead passa a apontar para a aula nova', async () => {
    m.docs.set('v1', visita());

    const aulaId = await recordNewAppointment({ db: {}, lead: comVisita({ currentAulaId: null }), appointmentType: 'aula_experimental', fields: novaAula });

    expect(m.docs.get('v1')).toMatchObject({ status: 'cancelled' });
    expect(aulaId).toBe('novo');
    expect(m.docs.get('novo')).toMatchObject({ type: 'aula', status: 'agendada', professorId: 'p1', modality: 'Pilates', scheduledFor: OUT_06 });
  });

  it('visita com "Compareceu" trocada por aula: a visita fecha como compareceu, e não como cancelada', async () => {
    m.docs.set('v1', visita());

    await recordNewAppointment({
      db: {}, lead: comVisita({ appointmentOutcome: 'attended', currentAulaId: null }), appointmentType: 'aula_experimental', fields: novaAula,
    });

    expect(m.docs.get('v1')).toMatchObject({ status: 'attended' });
  });

  it('aula trocada por visita: a aula do currentAulaId fecha como cancelada, e o ponteiro continua o do lead', async () => {
    m.docs.set('a1', { type: 'aula', leadId: 'lead-1', status: 'agendada', scheduledFor: SET_28 });
    const comAula = { ...lead, appointmentType: 'aula_experimental', appointmentScheduledFor: SET_28 };

    const aulaId = await recordNewAppointment({ db: {}, lead: comAula, appointmentType: 'visita', fields: novaVisita });

    expect(m.docs.get('a1')).toMatchObject({ status: 'cancelled' });
    expect(m.adds[0]).toMatchObject({ type: 'visita', scheduledFor: OUT_06 });
    expect(aulaId).toBe('a1');
  });

  it('aula com "Não veio" que não chegou ao registro: fecha como falta, e a aula nova nasce noutro registro', async () => {
    m.docs.set('a1', { type: 'aula', leadId: 'lead-1', status: 'agendada', scheduledFor: SET_28 });
    const comAula = { ...lead, appointmentType: 'aula_experimental', appointmentScheduledFor: SET_28, appointmentOutcome: 'no_show' };

    const aulaId = await recordNewAppointment({ db: {}, lead: comAula, appointmentType: 'aula_experimental', fields: novaAula });

    expect(m.docs.get('a1')).toMatchObject({ status: 'no_show', scheduledFor: SET_28 });
    expect(aulaId).toBe('novo');
  });

  it('mensagem e ligação não mexem em registro', async () => {
    m.docs.set('v1', visita());

    expect(await recordNewAppointment({ db: {}, lead: comVisita({ appointmentOutcome: 'no_show' }), appointmentType: null, fields: { scheduledFor: OUT_06 } }))
      .toBe('a1');
    expect(m.updates).toEqual([]);
    expect(m.adds).toEqual([]);
  });

  it('gravação recusada não derruba o agendamento: cada falha vai para o console e o ponteiro da aula fica o do lead', async () => {
    m.docs.set('v1', visita());
    m.recusar = true;
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(recordNewAppointment({
      db: {}, lead: comVisita({ appointmentOutcome: 'no_show' }), appointmentType: 'aula_experimental', fields: novaAula,
    })).resolves.toBe('a1');
    expect(erro.mock.calls.map(([texto]) => texto)).toEqual(['closeOpenAppointment falhou', 'upsertScheduledAula falhou']);
    erro.mockRestore();
  });

  // O que o Johnny pediu: agendar de novo depois de um desfecho não apaga o
  // desfecho do painel. O lead depois do assistente é o do buildSchedulePatch,
  // e os registros chegam ao painel como o useCrmSources entrega.
  it.each([
    ['a falta', 'no_show', { missed: 1, came: 0 }],
    ['o comparecimento', 'attended', { missed: 0, came: 1 }]
  ])('Dashboard CRM: %s de setembro continua em setembro depois de agendar de novo em outubro', async (_, appointmentOutcome, setembro) => {
    m.docs.set('v1', visita());
    const antes = comVisita({ appointmentOutcome });

    const currentAulaId = await recordNewAppointment({ db: {}, lead: antes, appointmentType: 'visita', fields: novaVisita });
    const depois = { ...antes, ...buildSchedulePatch({ typeLabel: 'Visita', date: OUT_06, unidade: 'Centro', currentAulaId }) };

    const registros = [...m.docs.entries()].map(([id, d]) => ({ id, ...d }));
    const noMes = (start, end) => appointmentsOf(registros, { start, end, leadOf: () => depois, inScope: () => true });
    expect(noMes(new Date(2026, 8, 1), new Date(2026, 9, 1))).toMatchObject({ total: 1, pending: 0, ...setembro });
    expect(noMes(new Date(2026, 9, 1), new Date(2026, 10, 1))).toMatchObject({ total: 1, missed: 0, came: 0, pending: 1 });
  });
});
