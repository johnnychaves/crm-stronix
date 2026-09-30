// Gravação no histórico de aulas (stronix_aulas) usada pelo Remarcar da Meta
// Diária. Sem Firebase de verdade: firebase/firestore e ../firebase.js são
// falsos, e os registros vivem num Map em memória.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ docs: new Map(), updates: [], adds: [] }));

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
  updateDoc: async (ref, patch) => { m.updates.push({ id: ref.id, patch }); },
  addDoc: async (_col, data) => { m.adds.push(data); return { id: 'novo' }; },
  serverTimestamp: () => 'TS',
}));

const { upsertScheduledAppointment, closeOpenAppointment } = await import('../aulasWrites.js');

const DIA_VELHO = new Date('2026-10-01T21:00:00.000Z');
const DIA_NOVO = new Date('2026-10-06T21:00:00.000Z');
const lead = { id: 'lead-1', name: 'Mariana Souza', consultantId: 'u-ana', currentAulaId: 'a1' };

beforeEach(() => {
  m.docs.clear();
  m.updates.length = 0;
  m.adds.length = 0;
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
