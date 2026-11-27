// A gravação da trilha (plano 2026-11-26-plano-de-carreira-02, tarefa 2): o
// campo trilhas.<id> inteiro pelo caminho do campo, sem mesclar; o documento
// que não existe nasce com setDoc e merge; o que o problemaDaTrilha recusa não
// grava.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const banco = vi.hoisted(() => ({ existe: true, falha: null, updates: [], sets: [] }));
vi.mock('../firebase.js', () => ({ appId: 'acad', CONFIG_PATH: 'stronix_config' }));
vi.mock('firebase/firestore', () => {
  class FieldPath {
    constructor(...segs) { this.segs = segs; }
  }
  return {
    FieldPath,
    doc: (_db, ...partes) => ({ path: partes.join('/') }),
    serverTimestamp: () => 'AGORA',
    updateDoc: async (ref, campo, valor, ...resto) => {
      if (banco.falha) throw banco.falha;
      if (!banco.existe) throw Object.assign(new Error('No document to update'), { code: 'not-found' });
      banco.updates.push({ path: ref.path, campo: campo.segs, valor, resto });
    },
    setDoc: async (ref, dados, opcoes) => { banco.sets.push({ path: ref.path, dados, opcoes }); },
  };
});

const { salvarTrilha } = await import('../carreiraWrites.js');
const { trilhasDe } = await import('../carreira/trilhas.js');
const { com, MOTIVO_DO_ARQUIVAR, trilhaParaGravar } = await import('../carreira/rascunho.js');

const [PROFESSOR, ESTAGIARIO, CONSULTOR] = trilhasDe(null);
const CAMINHO = 'artifacts/acad/public/data/stronix_config/carreira';
const salvar = (trilha, extra = {}) => salvarTrilha({}, {
  trilha, gravada: PROFESSOR, outras: [ESTAGIARIO, CONSULTOR], pessoasPorNivel: { junior: 2 }, appUser: { id: 'g1' }, ...extra,
});

beforeEach(() => {
  banco.existe = true;
  banco.falha = null;
  banco.updates = [];
  banco.sets = [];
});

describe('salvarTrilha', () => {
  it('troca o campo trilhas.<id> inteiro, com quem gravou e a hora', async () => {
    const t = com(PROFESSOR, { nome: 'Professor formado' });
    await salvar(t);
    expect(banco.updates).toEqual([{
      path: CAMINHO,
      campo: ['trilhas', 'professor'],
      valor: { ...trilhaParaGravar(t), updatedAt: 'AGORA', updatedBy: 'g1' },
      resto: [],
    }]);
    expect(banco.updates[0].valor).not.toHaveProperty('id');
    expect(banco.updates[0].valor).not.toHaveProperty('padrao');
    expect(banco.sets).toEqual([]);
  });

  it('sem documento, cria com setDoc e merge', async () => {
    banco.existe = false;
    await salvar(PROFESSOR);
    expect(banco.sets).toEqual([{
      path: CAMINHO,
      dados: { trilhas: { professor: { ...trilhaParaGravar(PROFESSOR), updatedAt: 'AGORA', updatedBy: 'g1' } } },
      opcoes: { merge: true },
    }]);
  });

  it('sem quem gravou, grava null', async () => {
    await salvar(PROFESSOR, { appUser: null });
    expect(banco.updates[0].valor.updatedBy).toBeNull();
  });

  it('o que o problemaDaTrilha recusa não grava, com o texto para a tela', async () => {
    await expect(salvar(com(PROFESSOR, { nome: ' ' }))).rejects.toMatchObject({ message: 'Dê um nome à trilha.', paraTela: true });
    await expect(salvar(com(PROFESSOR, { nome: 'Estagiário' }))).rejects.toMatchObject({ message: 'Já existe uma trilha com esse nome.' });
    expect(banco.updates).toEqual([]);
  });

  it('arquivar só sem gente', async () => {
    await expect(salvar(com(PROFESSOR, { arquivada: true }))).rejects.toMatchObject({ message: MOTIVO_DO_ARQUIVAR, paraTela: true });
    expect(banco.updates).toEqual([]);
    await salvar(com(PROFESSOR, { arquivada: true }), { pessoasPorNivel: {} });
    expect(banco.updates[0].valor.arquivada).toBe(true);
  });

  it('outro erro do Firestore sobe e não cria o documento', async () => {
    banco.falha = Object.assign(new Error('permission-denied'), { code: 'permission-denied' });
    await expect(salvar(PROFESSOR)).rejects.toThrow('permission-denied');
    expect(banco.sets).toEqual([]);
  });
});
