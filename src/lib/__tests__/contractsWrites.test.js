// A gravação de contrato num batch só. Sem Firebase de verdade:
// firebase/firestore, ../firebase.js e ../aulasWrites.js são falsos.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({ sets: [], seq: 0 }));

vi.mock('../firebase.js', () => ({
  appId: 'acad',
  LEADS_PATH: 'stronix_leads',
  INTERACTIONS_PATH: 'stronix_interactions',
  CONTRACTS_PATH: 'stronix_contratos'
}));
vi.mock('../aulasWrites.js', () => ({ markConvertingAula: vi.fn(async () => {}) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, ...p) => ({ path: p.join('/') }),
  doc: (parent, ...p) => {
    if (p.length === 0) {
      m.seq += 1;
      const id = `novo${m.seq}`;
      return { id, path: `${parent.path}/${id}` };
    }
    return { id: p[p.length - 1], path: p.join('/') };
  },
  increment: (n) => ({ increment: n }),
  serverTimestamp: () => 'TS',
  writeBatch: () => ({
    set: (ref, data, opts) => { m.sets.push({ path: ref.path, data, opts }); },
    commit: async () => {}
  })
}));

const { commitMatricula } = await import('../contractsWrites.js');

const D = (y, mo, d) => new Date(y, mo - 1, d);
const CONTRATOS = 'artifacts/acad/public/data/stronix_contratos';
const appUser = { id: 'c1', name: 'Bia', authUid: 'u1' };
const plan = { id: 'p1', name: 'Anual', value: 1308, durationMonths: 12 };
const lead = {
  id: 'l1', name: 'Ana', consultantId: 'c1', consultantName: 'Bia', consultantAuthUid: 'u1',
  lifecycleStage: 'cliente', isConverted: true, status: 'Venda', clienteSince: D(2025, 10, 11),
  currentContractId: 'k1', currentContractStartsAt: D(2025, 10, 11), currentContractEndsAt: D(2026, 10, 11)
};

beforeEach(() => { m.sets.length = 0; m.seq = 0; });

describe('commitMatricula: renovação e o contrato atual', () => {
  it('sobreposta: encurta o atual no mesmo batch e guarda quem encurtou', async () => {
    const { contractId } = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 9, 28), mode: 'renovacao', renewedFromId: 'k1' });
    const atual = m.sets.find((s) => s.path === `${CONTRATOS}/k1`);
    expect(atual.data).toEqual({ endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: contractId, updatedAt: 'TS' });
    expect(atual.opts).toEqual({ merge: true });
  });

  it('emendada: não toca no atual e o contrato novo leva a marca', async () => {
    const { contractId } = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 10, 12), mode: 'renovacao', renewedFromId: 'k1' });
    expect(m.sets.some((s) => s.path === `${CONTRATOS}/k1`)).toBe(false);
    const novo = m.sets.find((s) => s.path === `${CONTRATOS}/${contractId}`);
    expect(novo.data.seamless).toBe(true);
    const leadDoc = m.sets.find((s) => s.path === 'artifacts/acad/public/data/stronix_leads/l1');
    expect(leadDoc.data.currentContractSeamless).toBe(true);
  });
});
