// src/lib/__tests__/freepassWrites.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = [];
vi.mock('../firebase.js', () => ({ appId: 'acad', FREEPASS_PATH: 'stronix_freepass', INTERACTIONS_PATH: 'stronix_interactions', LEADS_PATH: 'stronix_leads' }));
vi.mock('firebase/firestore', () => {
  let n = 0;
  return {
    collection: (...p) => ({ path: p.slice(1).join('/') }),
    doc: (col, ...rest) => {
      const id = rest.length ? rest[rest.length - 1] : `auto${++n}`;
      const base = rest.length > 1 ? rest.slice(0, -1).join('/') : col.path;
      return { id, path: `${base}/${id}` };
    },
    serverTimestamp: () => 'TS',
    increment: (k) => ({ inc: k }),
    writeBatch: () => ({
      set: (ref, data, opts) => calls.push(['set', ref.path, data, opts]),
      update: (ref, data) => calls.push(['update', ref.path, data]),
      commit: async () => calls.push(['commit'])
    })
  };
});

const { writeFreepassLaunch, writeFreepassEnd } = await import('../freepassWrites.js');

const lead = { id: 'L1', name: 'Rafa', status: 'Novo', consultantId: 'u1', consultantName: 'Ana', consultantAuthUid: 'a1' };
const user = { id: 'u2', name: 'Bruno', authUid: 'a2' };
const tipo = { id: 't1', name: 'Muscu 7 dias', modalidadeId: 'm1', kind: 'dias', quantity: 7 };

beforeEach(() => { calls.length = 0; });

describe('writeFreepassLaunch', () => {
  it('grava o freepass, a interação e o resumo num commit só', async () => {
    const id = await writeFreepassLaunch({
      db: {}, lead, appUser: user, type: tipo, modalidadeName: 'Musculação',
      startsAt: new Date('2026-11-26T12:00:00'), existing: [], now: new Date('2026-11-26T12:00:00')
    });
    expect(calls.filter(c => c[0] === 'commit')).toHaveLength(1);
    const fp = calls.find(c => c[1].includes('stronix_freepass'));
    expect(fp[0]).toBe('set');
    expect(fp[2]).toMatchObject({ leadId: 'L1', status: 'correndo', createdAt: 'TS' });
    const inter = calls.find(c => c[1].includes('stronix_interactions'));
    expect(inter[2]).toMatchObject({ type: 'freepass', freepassId: id, text: 'Freepass lançado: Muscu 7 dias (Musculação), de 26/11 a 02/12.' });
    const leadSet = calls.find(c => c[1].includes('stronix_leads'));
    expect(leadSet[2]).toMatchObject({ freepassId: id, freepassKind: 'dias', freepassStatus: 'correndo' });
  });
});

describe('writeFreepassEnd', () => {
  it('encerra o freepass e passa o resumo para o próximo que ainda corre', async () => {
    const outro = { id: 'f2', kind: 'aulas', total: 2, status: 'correndo', endsAt: null, startsAt: new Date('2026-11-20'), typeName: 'Pilates 2 aulas', modalidadeName: 'Pilates', aulas: 0, contractAtStart: null };
    const fim = { id: 'f1', typeName: 'Muscu 7 dias' };
    await writeFreepassEnd({ db: {}, lead, appUser: user, freepass: fim, existing: [fim, outro], now: new Date('2026-11-26T12:00:00') });
    const up = calls.find(c => c[0] === 'update');
    expect(up[1]).toContain('stronix_freepass/f1');
    expect(up[2]).toMatchObject({ status: 'encerrado', endedAt: 'TS', endedById: 'u2', endedByName: 'Bruno' });
    const leadSet = calls.find(c => c[1].includes('stronix_leads'));
    expect(leadSet[2].freepassId).toBe('f2');
    const inter = calls.find(c => c[1].includes('stronix_interactions'));
    expect(inter[2].text).toBe('Freepass encerrado: Muscu 7 dias.');
  });
});
