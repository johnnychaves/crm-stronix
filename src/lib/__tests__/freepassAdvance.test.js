// @vitest-environment jsdom
// A aula da vez do freepass anda no dia da aula seguinte (useFreepassAdvance):
// o plano puro (advancePlan) e o hook, com um Firestore de mentira.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';

const banco = vi.hoisted(() => ({ aulas: [], leads: {}, freepass: {}, gravados: [], consultas: 0 }));
vi.mock('../firebase.js', () => ({ appId: 'acad', AULAS_PATH: 'aulas', LEADS_PATH: 'leads', FREEPASS_PATH: 'freepass' }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => ({ path: p.join('/') }),
  doc: (col, id) => ({ col: col.path.split('/').pop(), id }),
  where: (campo, op, valor) => ({ campo, op, valor }),
  query: (col, ...filtros) => ({ col, filtros }),
  getDocs: async ({ filtros }) => {
    banco.consultas += 1;
    const [de, ate] = filtros.map((f) => f.valor);
    const docs = banco.aulas
      .filter((a) => a.scheduledFor >= de && a.scheduledFor <= ate)
      .map(({ id, ...d }) => ({ id, data: () => d }));
    return { docs };
  },
  getDoc: async ({ col, id }) => {
    const d = banco[col === 'leads' ? 'leads' : 'freepass'][id];
    return { exists: () => Boolean(d), data: () => d };
  },
  updateDoc: async ({ col, id }, patch) => { banco.gravados.push({ col, id, patch }); },
}));

const { advancePlan, useFreepassAdvance } = await import('../../hooks/useFreepassAdvance.js');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const at = (dias, hora) => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(hora, 0, 0, 0); return d; };
const NOW = at(0, 8);
const FP = { id: 'fp1', status: 'correndo', kind: 'aulas', total: 2, aulas: 2, endsAt: at(0, 0), contractAtStart: null };
const LEAD = { id: 'ana', appointmentScheduledFor: at(-7, 18), appointmentOutcome: 'attended', currentAulaId: 'a1', appointmentOwnerId: 'bruno' };
const AULA = { id: 'a2', leadId: 'ana', freepassId: 'fp1', status: 'agendada', scheduledFor: at(0, 18), modality: 'Pilates', professorId: 'p1', professorName: 'Léo', soloTraining: false };

const plan = (over = {}) => advancePlan({
  records: [AULA],
  leadsById: new Map([['ana', LEAD]]),
  freepassesById: new Map([['fp1', FP]]),
  now: NOW,
  ...over,
});

describe('advancePlan', () => {
  it('aula de hoje de freepass com o agendamento de antes: passa para ela', () => {
    const [{ leadId, patch }] = plan();
    expect(leadId).toBe('ana');
    expect(patch).toMatchObject({
      appointmentType: 'aula_experimental', appointmentScheduledFor: AULA.scheduledFor, nextFollowUp: AULA.scheduledFor,
      appointmentModality: 'Pilates', appointmentProfessorId: 'p1', appointmentProfessorName: 'Léo',
      currentAulaId: 'a2', appointmentOutcome: null,
    });
  });

  it('contato de verdade de hoje em diante fica', () => {
    const lead = { ...LEAD, nextFollowUp: at(1, 9), nextFollowUpType: 'Mensagem', nextFollowUpNote: 'confirmar', nextFollowUpOwnerId: 'carla' };
    const [{ patch }] = plan({ leadsById: new Map([['ana', lead]]) });
    for (const k of ['nextFollowUp', 'nextFollowUpType', 'nextFollowUpNote', 'nextFollowUpOwnerId', 'nextFollowUpOwnerName']) {
      expect(patch).not.toHaveProperty(k);
    }
    expect(patch).toMatchObject({ currentAulaId: 'a2', appointmentScheduledFor: AULA.scheduledFor });
  });

  it('contato de verdade já vencido e o eco do agendamento são sobrescritos', () => {
    const vencido = { ...LEAD, nextFollowUp: at(-1, 9), nextFollowUpType: 'Ligação', nextFollowUpOwnerId: 'carla' };
    const eco = { ...LEAD, nextFollowUp: at(2, 9), nextFollowUpType: 'Aula Experimental' };
    for (const lead of [vencido, eco]) {
      const [{ patch }] = plan({ leadsById: new Map([['ana', lead]]) });
      expect(patch).toMatchObject({ nextFollowUp: AULA.scheduledFor, nextFollowUpType: 'Aula Experimental', nextFollowUpOwnerId: null });
    }
  });

  it('não mexe no dono da tarefa', () => {
    const [{ patch }] = plan();
    expect(patch).not.toHaveProperty('appointmentOwnerId');
    expect(patch).not.toHaveProperty('appointmentOwnerName');
  });

  it('agendamento de hoje sem desfecho fica', () => {
    const lead = { ...LEAD, appointmentScheduledFor: at(0, 7), appointmentOutcome: null };
    expect(plan({ leadsById: new Map([['ana', lead]]) })).toEqual([]);
  });

  it('freepass que não existe ou que foi encerrado: nada', () => {
    expect(plan({ freepassesById: new Map() })).toEqual([]);
    expect(plan({ freepassesById: new Map([['fp1', { ...FP, status: 'encerrado' }]]) })).toEqual([]);
  });

  it('freepass de outro contrato (houve matrícula): nada', () => {
    expect(plan({ leadsById: new Map([['ana', { ...LEAD, currentContractId: 'c9' }]]) })).toEqual([]);
  });

  it('registro cancelado: nada', () => {
    expect(plan({ records: [{ ...AULA, status: 'cancelled' }] })).toEqual([]);
  });

  it('lead que não existe mais: nada', () => {
    expect(plan({ leadsById: new Map() })).toEqual([]);
  });
});

describe('useFreepassAdvance', () => {
  let root = null;
  const DB = {};
  const Hook = (props) => { useFreepassAdvance(props); return null; };
  const render = async (props) => {
    await act(async () => { root.render(h(Hook, props)); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  };

  beforeEach(() => {
    banco.aulas = [AULA, { ...AULA, id: 'avulsa', freepassId: null }];
    banco.leads = { ana: LEAD };
    banco.freepass = { fp1: FP };
    banco.gravados = [];
    banco.consultas = 0;
    root = createRoot(document.createElement('div'));
  });
  afterEach(async () => { await act(async () => { root.unmount(); }); });

  it('grava o agendamento novo no lead, uma vez por dia', async () => {
    await render({ db: DB, enabled: true, dayKey: 's:2026-11-26' });
    expect(banco.gravados).toHaveLength(1);
    expect(banco.gravados[0]).toMatchObject({ col: 'leads', id: 'ana', patch: { currentAulaId: 'a2' } });
    await render({ db: DB, enabled: false, dayKey: 's:2026-11-26' });
    await render({ db: DB, enabled: true, dayKey: 's:2026-11-26' });
    expect(banco.consultas).toBe(1);
    await render({ db: DB, enabled: true, dayKey: 's:2026-11-27' });
    expect(banco.consultas).toBe(2);
  });

  it('desligado não lê nada', async () => {
    await render({ db: DB, enabled: false, dayKey: 's:2026-11-26' });
    expect(banco.consultas).toBe(0);
    expect(banco.gravados).toEqual([]);
  });
});
