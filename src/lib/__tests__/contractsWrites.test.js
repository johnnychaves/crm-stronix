// A gravação de contrato num batch só. Sem Firebase de verdade:
// firebase/firestore, ../firebase.js e ../aulasWrites.js são falsos.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// writes guarda cada gravação do batch com o tipo (set ou update). batches e
// commits contam as chamadas: é assim que o teste prova que o encurtamento vai
// no mesmo batch da renovação.
const m = vi.hoisted(() => ({ writes: [], seq: 0, batches: 0, commits: 0 }));

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
  writeBatch: () => {
    m.batches += 1;
    return {
      set: (ref, data, opts) => { m.writes.push({ path: ref.path, data, opts, op: 'set' }); },
      update: (ref, data) => { m.writes.push({ path: ref.path, data, op: 'update' }); },
      commit: async () => { m.commits += 1; }
    };
  }
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
// O documento do contrato atual, como chega da coleção de contratos.
const atual = { id: 'k1', startsAt: D(2025, 10, 11), endsAt: D(2026, 10, 11) };

beforeEach(() => { m.writes.length = 0; m.seq = 0; m.batches = 0; m.commits = 0; });

describe('commitMatricula: renovação e o contrato atual', () => {
  it('sobreposta: encurta o atual no mesmo batch e guarda quem encurtou', async () => {
    const { contractId } = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 9, 28), mode: 'renovacao', renewedFromId: 'k1', previousContract: atual });
    // update, e não set com merge: se o contrato não existir mais, o batch
    // inteiro falha em vez de criar um contrato fantasma só com datas.
    const encurtado = m.writes.find((w) => w.path === `${CONTRATOS}/k1`);
    expect(encurtado).toEqual({
      path: `${CONTRATOS}/k1`,
      data: { endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: contractId, updatedAt: 'TS' },
      op: 'update'
    });
    expect(m.writes.some((w) => w.path === `${CONTRATOS}/${contractId}`)).toBe(true);
    // Um batch só, gravado uma vez: o contrato novo e o encurtamento entram ou
    // ficam de fora juntos.
    expect(m.batches).toBe(1);
    expect(m.commits).toBe(1);
  });

  it('sobreposta sem o documento do contrato atual: grava a renovação e não encurta nada', async () => {
    const { contractId } = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 9, 28), mode: 'renovacao', renewedFromId: 'k1', previousContract: null });
    expect(m.writes.some((w) => w.path === `${CONTRATOS}/k1`)).toBe(false);
    expect(m.writes.some((w) => w.path === `${CONTRATOS}/${contractId}`)).toBe(true);
  });

  it('emendada: não toca no atual e o contrato novo leva a marca', async () => {
    const { contractId } = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 10, 12), mode: 'renovacao', renewedFromId: 'k1', previousContract: atual });
    expect(m.writes.some((w) => w.path === `${CONTRATOS}/k1`)).toBe(false);
    const novo = m.writes.find((w) => w.path === `${CONTRATOS}/${contractId}`);
    expect(novo.data.seamless).toBe(true);
    const leadDoc = m.writes.find((w) => w.path === 'artifacts/acad/public/data/stronix_leads/l1');
    expect(leadDoc.data.currentContractSeamless).toBe(true);
  });
});
