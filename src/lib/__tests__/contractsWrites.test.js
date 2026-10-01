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

const { commitContractPatch, commitMatricula } = await import('../contractsWrites.js');

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
// A hora da gravação: 29/09/2026, às 10h. O contrato atual precisa estar em
// vigor para ser emendado ou encurtado, e isso depende do dia. Sem uma hora
// fixa, estes testes dependiam do relógio de verdade.
const AGORA = new Date(2026, 8, 29, 10, 0);

beforeEach(() => { m.writes.length = 0; m.seq = 0; m.batches = 0; m.commits = 0; });

describe('commitMatricula: renovação e o contrato atual', () => {
  it('sobreposta: encurta o atual no mesmo batch e guarda quem encurtou', async () => {
    const { contractId } = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 9, 28), mode: 'renovacao', renewedFromId: 'k1', previousContract: atual, now: AGORA });
    // update, e não set com merge: se o contrato não existir mais, o batch
    // inteiro falha em vez de criar um contrato fantasma só com datas.
    const encurtado = m.writes.find((w) => w.path === `${CONTRATOS}/k1`);
    expect(encurtado).toEqual({
      path: `${CONTRATOS}/k1`,
      data: { endsAt: D(2026, 9, 27), originalEndsAt: D(2026, 10, 11), shortenedById: contractId, updatedAt: 'TS' },
      op: 'update'
    });
    // Encurtado o atual, o novo começa no dia seguinte ao fim dele: emendado.
    const novo = m.writes.find((w) => w.path === `${CONTRATOS}/${contractId}`);
    expect(novo.data.seamless).toBe(true);
    const leadDoc = m.writes.find((w) => w.path === 'artifacts/acad/public/data/stronix_leads/l1');
    expect(leadDoc.data.currentContractSeamless).toBe(true);
    // Um batch só, gravado uma vez: o contrato novo e o encurtamento entram ou
    // ficam de fora juntos.
    expect(m.batches).toBe(1);
    expect(m.commits).toBe(1);
  });

  it('sobreposta sem o documento do contrato atual: grava a renovação e não encurta nada', async () => {
    const { contractId } = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 9, 28), mode: 'renovacao', renewedFromId: 'k1', previousContract: null, now: AGORA });
    expect(m.writes.some((w) => w.path === `${CONTRATOS}/k1`)).toBe(false);
    // Os dois valem juntos: o novo não é emendado.
    const novo = m.writes.find((w) => w.path === `${CONTRATOS}/${contractId}`);
    expect(novo.data.seamless).toBe(false);
    const leadDoc = m.writes.find((w) => w.path === 'artifacts/acad/public/data/stronix_leads/l1');
    expect(leadDoc.data.currentContractSeamless).toBe(false);
  });

  it('emendada: não toca no atual e o contrato novo leva a marca', async () => {
    const { contractId } = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 10, 12), mode: 'renovacao', renewedFromId: 'k1', previousContract: atual, now: AGORA });
    expect(m.writes.some((w) => w.path === `${CONTRATOS}/k1`)).toBe(false);
    const novo = m.writes.find((w) => w.path === `${CONTRATOS}/${contractId}`);
    expect(novo.data.seamless).toBe(true);
    const leadDoc = m.writes.find((w) => w.path === 'artifacts/acad/public/data/stronix_leads/l1');
    expect(leadDoc.data.currentContractSeamless).toBe(true);
  });

  // A hora da gravação chega à regra do contrato em vigor
  // (buildMatriculaWrites). Numa hora de antes do início do atual, ele ainda
  // não tinha começado: nada é encurtado e a renovação não leva a marca.
  it('a hora passada chega à regra: com o atual ainda sem começar, nada muda nele e nada é marcado', async () => {
    const antesDoInicio = D(2025, 10, 1);
    const sobreposta = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 9, 28), mode: 'renovacao', renewedFromId: 'k1', previousContract: atual, now: antesDoInicio });
    expect(m.writes.some((w) => w.path === `${CONTRATOS}/k1`)).toBe(false);
    expect(m.writes.find((w) => w.path === `${CONTRATOS}/${sobreposta.contractId}`).data.seamless).toBe(false);
    const emendada = await commitMatricula({ db: {}, lead, appUser, plan, value: 1308, startsAt: D(2026, 10, 12), mode: 'renovacao', renewedFromId: 'k1', previousContract: atual, now: antesDoInicio });
    expect(m.writes.find((w) => w.path === `${CONTRATOS}/${emendada.contractId}`).data.seamless).toBe(false);
  });
});

// Desfecho que mexe também no contrato renovado: cancelar a renovação que
// ainda não começou devolve o fim de antes ao contrato que ela encurtou.
describe('commitContractPatch: o contrato ligado no mesmo batch', () => {
  const base = {
    db: {}, lead, appUser, contractId: 'k2',
    contractPatch: { status: 'cancelado' },
    leadPatch: { currentContractId: 'k1' },
    interactionText: 'Renovação cancelada antes de começar: Plano Flow. O contrato Plano Start volta a valer até 11/10/2026.'
  };
  // O que o desfecho sempre gravou: contrato, resumo no lead e linha do tempo.
  const sempre = [
    { op: 'set', path: `${CONTRATOS}/k2`, data: { status: 'cancelado', updatedAt: 'TS' }, opts: { merge: true } },
    {
      op: 'set', path: 'artifacts/acad/public/data/stronix_leads/l1',
      data: { currentContractId: 'k1', lastInteractionAt: 'TS', interactionsCount: { increment: 1 } }, opts: { merge: true }
    },
    {
      op: 'set', path: 'artifacts/acad/public/data/stronix_interactions/novo1',
      data: {
        leadId: 'l1', consultantName: 'Bia', leadConsultantId: 'c1', leadConsultantAuthUid: 'u1',
        actorId: 'c1', actorAuthUid: 'u1', text: base.interactionText, type: 'status_change', createdAt: 'TS'
      }
    }
  ];

  it('sem o contrato renovado, grava o mesmo de antes', async () => {
    await commitContractPatch(base);
    expect(m.writes).toEqual(sempre);
    expect(m.batches).toBe(1);
    expect(m.commits).toBe(1);
  });

  it('só o id ou só o patch não grava o contrato renovado', async () => {
    await commitContractPatch({ ...base, linkedContractId: 'k1' });
    await commitContractPatch({ ...base, linkedContractPatch: { endsAt: D(2026, 10, 11) } });
    expect(m.writes.some((w) => w.path === `${CONTRATOS}/k1`)).toBe(false);
  });

  it('com o patch, atualiza o contrato renovado no mesmo batch', async () => {
    await commitContractPatch({
      ...base, linkedContractId: 'k1', linkedContractPatch: { endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null }
    });
    // update, e não set com merge: se o contrato não existir mais, o batch
    // inteiro falha em vez de criar um contrato fantasma só com datas.
    expect(m.writes.find((w) => w.path === `${CONTRATOS}/k1`)).toEqual({
      path: `${CONTRATOS}/k1`,
      data: { endsAt: D(2026, 10, 11), originalEndsAt: null, shortenedById: null, updatedAt: 'TS' },
      op: 'update'
    });
    expect(m.writes.filter((w) => w.path !== `${CONTRATOS}/k1`)).toEqual(sempre);
    // Um batch só, gravado uma vez: a renovação desfeita e o fim devolvido
    // entram ou ficam de fora juntos.
    expect(m.batches).toBe(1);
    expect(m.commits).toBe(1);
  });

  // O contrato ligado também pode ser o PRÓXIMO: cancelar o contrato em uso
  // tira a marca de emendada da renovação marcada.
  it('o cancelamento do contrato em uso tira a marca de emendada da renovação, no mesmo batch', async () => {
    await commitContractPatch({
      ...base, contractId: 'k1', leadPatch: { inUseContractStatus: 'cancelado', currentContractSeamless: false },
      linkedContractId: 'k2', linkedContractPatch: { seamless: false }
    });
    expect(m.writes.find((w) => w.path === `${CONTRATOS}/k2`)).toEqual({
      path: `${CONTRATOS}/k2`, data: { seamless: false, updatedAt: 'TS' }, op: 'update'
    });
    expect(m.batches).toBe(1);
    expect(m.commits).toBe(1);
  });
});
