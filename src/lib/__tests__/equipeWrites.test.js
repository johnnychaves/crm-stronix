// src/lib/__tests__/equipeWrites.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

const chamadas = vi.hoisted(() => ({ set: [], update: [], lotes: [] }));
vi.mock('firebase/firestore', () => ({
  doc: (_db, ...partes) => ({ caminho: partes.join('/') }),
  setDoc: async (ref, dados, opcoes) => { chamadas.set.push({ caminho: ref.caminho, dados, opcoes }); },
  updateDoc: async (ref, dados) => { chamadas.update.push({ caminho: ref.caminho, dados }); },
  serverTimestamp: () => 'agora',
  collection: (_db, ...partes) => ({ caminho: partes.join('/') }),
  query: (c, f) => ({ ...c, f }),
  where: (campo, op, valor) => ({ campo, op, valor }),
  getDocs: async () => ({ empty: false, docs: [{ id: 'lead-1' }] }),
}));
vi.mock('firebase/storage', () => ({ ref: () => ({}), uploadBytes: async () => {}, getDownloadURL: async () => 'u', deleteObject: async () => {} }));
vi.mock('../firebase.js', () => ({
  appId: 'acad', EQUIPE_PATH: 'stronix_equipe', USERS_PATH: 'stronix_users',
  PROFESSORS_PATH: 'stronix_professores', LEADS_PATH: 'stronix_leads', storage: {},
}));
vi.mock('../funnels.js', () => ({ commitOpsInChunks: async (_db, ops) => { chamadas.lotes.push(ops); } }));
vi.mock('../settingsLeads.js', () => ({ leadsWhere: async () => [{ id: 'lead-2' }] }));

const { gravarBloco, renomearPessoa } = await import('../equipe/equipeWrites.js');

beforeEach(() => { chamadas.set = []; chamadas.update = []; chamadas.lotes = []; });

describe('gravarBloco', () => {
  it('a primeira gravação cria a ficha com os vínculos, a função e o nome', async () => {
    const pessoa = { id: 'p-marina', ficha: null, user: null, professor: { id: 'p-marina' }, funcao: 'professor', nome: 'Marina' };
    await gravarBloco({}, pessoa, { celular: '51999990000' }, { id: 'g1' });
    expect(chamadas.set).toEqual([{
      caminho: 'artifacts/acad/public/data/stronix_equipe/p-marina',
      dados: {
        celular: '51999990000', userId: null, professorId: 'p-marina', funcao: 'professor', nome: 'Marina',
        status: 'ativo', createdAt: 'agora', updatedAt: 'agora', updatedBy: 'g1',
      },
      opcoes: { merge: true },
    }]);
  });
  it('depois, grava só o bloco', async () => {
    const pessoa = { id: 'f1', ficha: { id: 'f1' }, user: null, professor: null, funcao: 'consultor', nome: 'Ana' };
    await gravarBloco({}, pessoa, { rg: '1' }, { id: 'g1' });
    expect(chamadas.set[0].dados).toEqual({ rg: '1', updatedAt: 'agora', updatedBy: 'g1' });
  });
});

describe('renomearPessoa', () => {
  it('leva o nome ao login e ao professor, com as cópias dos leads', async () => {
    const pessoa = { id: 'u1', user: { id: 'u1', name: 'Di' }, professor: { id: 'p1', nome: 'Di' } };
    const mudou = await renomearPessoa({}, pessoa, 'Diego Viana');
    expect(mudou).toBe(true);
    expect(chamadas.update).toEqual([{ caminho: 'artifacts/acad/public/data/stronix_users/u1', dados: { name: 'Diego Viana' } }]);
    expect(chamadas.set[0]).toMatchObject({ caminho: 'artifacts/acad/public/data/stronix_professores/p1', dados: { nome: 'Diego Viana', updatedAt: 'agora' } });
    expect(chamadas.lotes.map((ops) => ops.map((o) => o.data))).toEqual([
      [{ consultantName: 'Diego Viana' }],
      [{ appointmentProfessorName: 'Diego Viana' }],
    ]);
  });
  it('nome igual não grava nada', async () => {
    expect(await renomearPessoa({}, { id: 'u1', user: { id: 'u1', name: 'Ana' }, professor: null }, 'Ana')).toBe(false);
    expect(chamadas.update).toEqual([]);
  });
});
