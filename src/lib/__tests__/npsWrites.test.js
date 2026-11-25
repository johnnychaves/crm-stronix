// A abertura da pesquisa (plano 2026-11-25-perfil-do-professor-04, tarefa 5):
// grava a turma e a situação, recusa o que não é mais rascunho e recusa quando
// outra pesquisa está aberta pela conta (a vencida não trava).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({ docs: {}, updates: [] }));
vi.mock('../firebase.js', () => ({ appId: 'acad', NPS_PESQUISAS_PATH: 'stronix_nps_pesquisas', PROFESSORS_PATH: 'stronix_professores' }));
vi.mock('firebase/firestore', () => ({
  collection: (...partes) => ({ path: partes.slice(1).join('/') }),
  doc: (col, ...ids) => ({ path: [col.path, ...ids].join('/'), id: ids.at(-1) }),
  serverTimestamp: () => 'AGORA',
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(async (ref, dados) => { s.updates.push({ id: ref.id, dados }); }),
  runTransaction: async (_db, fn) => fn({
    get: async (ref) => {
      const data = s.docs[ref.id];
      return { ref, exists: () => Boolean(data), data: () => data };
    },
    update: (ref, dados) => s.updates.push({ id: ref.id, dados }),
  }),
}));

const { abrirPesquisa, gerarNovoLink } = await import('../npsWrites.js');

const PERGUNTAS = [{ id: 'p1', texto: 'Recomendaria?', principal: true }];
const rascunho = { nome: 'Junho', inicio: '2027-06-01', fim: '2027-06-20', ciclo: 2027, situacao: 'rascunho', perguntas: PERGUNTAS };
const agora = new Date(2027, 4, 20, 10);

beforeEach(() => {
  s.docs = { r1: rascunho };
  s.updates = [];
});

describe('abrirPesquisa', () => {
  it('grava a turma, a situação e a hora', async () => {
    await abrirPesquisa({}, 'r1', { turmas: { p1: 20 }, conhecidas: [{ id: 'r1' }], agora });
    expect(s.updates).toEqual([{ id: 'r1', dados: { situacao: 'aberta', turmas: { p1: 20 }, abertaEm: 'AGORA' } }]);
  });

  it('gera o link de quem está na turma e ainda não tem, e não troca o que existe', async () => {
    s.docs.p1 = { nome: 'Ana' };
    s.docs.p2 = { nome: 'Bia', npsCode: 'k7q2mx9pza' };
    await abrirPesquisa({}, 'r1', { turmas: { p1: 20, p2: 5 }, conhecidas: [{ id: 'r1' }], agora });
    const doP1 = s.updates.filter((u) => u.id === 'p1');
    expect(doP1).toHaveLength(1);
    expect(doP1[0].dados).toEqual({ npsCode: expect.stringMatching(/^[a-km-np-z2-9]{10}$/), npsCodeEm: 'AGORA' });
    expect(s.updates.some((u) => u.id === 'p2')).toBe(false);
    expect(s.updates.find((u) => u.id === 'r1').dados.situacao).toBe('aberta');
  });

  it('recusa sem turma, fora do rascunho e com pesquisa incompleta', async () => {
    await expect(abrirPesquisa({}, 'r1', { turmas: {}, agora })).rejects.toMatchObject({ paraTela: true });
    s.docs.r1 = { ...rascunho, situacao: 'aberta' };
    await expect(abrirPesquisa({}, 'r1', { turmas: { p1: 2 }, agora })).rejects.toThrow('não é mais um rascunho');
    s.docs.r1 = { ...rascunho, nome: '' };
    await expect(abrirPesquisa({}, 'r1', { turmas: { p1: 2 }, agora })).rejects.toThrow('Complete a pesquisa');
    expect(s.updates).toEqual([]);
  });

  it('recusa com outra aberta, mas a vencida não trava', async () => {
    s.docs.v = { ...rascunho, situacao: 'aberta', inicio: '2027-01-01', fim: '2027-01-10' };
    await abrirPesquisa({}, 'r1', { turmas: { p1: 2 }, conhecidas: [{ id: 'v' }], agora });
    expect(s.updates).toHaveLength(1);
    s.updates = [];
    s.docs.a = { ...rascunho, situacao: 'aberta', inicio: '2027-05-01', fim: '2027-05-30' };
    await expect(abrirPesquisa({}, 'r1', { turmas: { p1: 2 }, conhecidas: [{ id: 'v' }, { id: 'a' }], agora })).rejects.toThrow('Já tem uma pesquisa aberta');
    expect(s.updates).toEqual([]);
  });
});

describe('gerarNovoLink', () => {
  it('grava um código novo no professor', async () => {
    const code = await gerarNovoLink({}, 'p1');
    expect(code).toMatch(/^[a-km-np-z2-9]{10}$/);
    expect(s.updates).toEqual([{ id: 'p1', dados: { npsCode: code, npsCodeEm: 'AGORA' } }]);
  });
});
