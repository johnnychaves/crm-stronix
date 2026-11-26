import { describe, it, expect, vi } from 'vitest';

const m = vi.hoisted(() => ({ docs: [], filtros: [] }));
vi.mock('../firebase.js', () => ({ appId: 'acad', AULAS_PATH: 'stronix_aulas' }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => ({ path: p.join('/') }),
  doc: (col) => ({ path: `${col.path}/auto` }),
  query: (col, ...filtros) => ({ col, filtros }),
  where: (campo, op, valor) => ({ campo, op, valor }),
  getDocs: async (q) => { m.filtros = q.filtros; return { docs: m.docs.map(([id, d]) => ({ id, data: () => d })) }; },
  serverTimestamp: () => 'TS',
}));

const { readLeadAulas, extraAulaRecords, freepassAfterAulas } = await import('../freepassAgendaWrites.js');

const lead = { id: 'L1', name: 'Rafa', consultantId: 'u1', consultantAuthUid: 'a1', consultantName: 'Ana' };

describe('freepassAgendaWrites', () => {
  it('readLeadAulas consulta por leadId e junta o id', async () => {
    m.docs = [['x1', { leadId: 'L1', status: 'agendada' }]];
    const r = await readLeadAulas({}, 'L1');
    expect(m.filtros).toEqual([{ campo: 'leadId', op: '==', valor: 'L1' }]);
    expect(r).toEqual([{ id: 'x1', leadId: 'L1', status: 'agendada' }]);
  });

  it('extraAulaRecords devolve ref e dados sem gravar', () => {
    const at = new Date('2026-12-01T12:00:00Z');
    const r = extraAulaRecords({ db: {}, lead, freepassId: 'fp1', aulas: [{ scheduledFor: at, professorId: 'p1', professorName: 'Carla', soloTraining: false, modality: 'Pilates' }] });
    expect(r).toHaveLength(1);
    expect(r[0].ref.path).toContain('stronix_aulas');
    expect(r[0].data).toMatchObject({
      type: 'aula', leadId: 'L1', leadName: 'Rafa', consultantId: 'u1', consultantAuthUid: 'a1', consultantName: 'Ana',
      status: 'agendada', freepassId: 'fp1', professorId: 'p1', modality: 'Pilates', scheduledFor: at, createdAt: 'TS',
    });
  });

  it('freepassAfterAulas junta o patch no freepass', () => {
    const fp = { id: 'fp1', kind: 'aulas', total: 2, aulas: 0, endsAt: null };
    const records = [
      { freepassId: 'fp1', status: 'agendada', scheduledFor: new Date(2026, 11, 1, 10) },
      { freepassId: 'fp1', status: 'agendada', scheduledFor: new Date(2026, 11, 3, 10) },
    ];
    const r = freepassAfterAulas({ freepass: fp, records });
    expect(r.patch.aulas).toBe(2);
    expect(r.patch.endsAt).toEqual(new Date(2026, 11, 3));
    expect(r.freepass).toMatchObject({ id: 'fp1', total: 2, aulas: 2 });
  });
});
