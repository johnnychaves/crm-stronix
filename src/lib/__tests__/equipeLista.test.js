// src/lib/__tests__/equipeLista.test.js
import { describe, it, expect } from 'vitest';
import { montarEquipe, filtrarEquipe, ACESSOS } from '../equipe/equipe.js';

const AGORA = new Date(2026, 10, 26, 10, 0);
const users = [
  { id: 'u-gestor', name: 'Johnny', role: 'admin', authUid: 'u-gestor' },
  { id: 'u-camila', name: 'Camila', role: 'consultant', authUid: 'u-camila' },
  { id: 'u-diego', name: 'Diego', role: 'professor', professorId: 'p-diego', authUid: 'u-diego' },
];
const professores = [
  { id: 'p-diego', nome: 'Diego Viana', modalidadeIds: ['m'] },
  { id: 'p-marina', nome: 'Marina Prado', modalidadeIds: ['m'] },
  { id: 'p-velho', nome: 'Rui', ativo: false },
];

describe('montarEquipe', () => {
  it('sem ficha nenhuma: um por login e um por professor sem login, em ordem de nome', () => {
    const pessoas = montarEquipe({ fichas: [], users, professores, agora: AGORA });
    expect(pessoas.map((p) => [p.id, p.funcao, p.acesso])).toEqual([
      ['u-camila', 'consultor', 'com'],
      ['u-diego', 'professor', 'com'],
      ['u-gestor', 'gestor', 'com'],
      ['p-marina', 'professor', 'sem'],
      ['p-velho', 'professor', 'desligado'],
    ]);
    const diego = pessoas.find((p) => p.id === 'u-diego');
    expect(diego.professor.id).toBe('p-diego');
    expect(diego.nome).toBe('Diego');
  });

  it('a ficha pega o login e o professor, e o nome da ficha manda', () => {
    const fichas = [{ id: 'u-diego', userId: 'u-diego', professorId: 'p-diego', nome: 'Diego Viana Lopes', status: 'ativo' }];
    const pessoas = montarEquipe({ fichas, users, professores, agora: AGORA });
    expect(pessoas.filter((p) => p.professor?.id === 'p-diego')).toHaveLength(1);
    expect(pessoas.find((p) => p.id === 'u-diego').nome).toBe('Diego Viana Lopes');
  });

  it('ficha de professor sem login acha o login novo pelo professor', () => {
    const fichas = [{ id: 'p-diego', professorId: 'p-diego', status: 'ativo' }];
    const pessoas = montarEquipe({ fichas, users, professores, agora: AGORA });
    const diego = pessoas.find((p) => p.id === 'p-diego');
    expect(diego.user.id).toBe('u-diego');
    expect(pessoas.some((p) => p.id === 'u-diego')).toBe(false);
  });

  it('desligada pela ficha; convite que venceu vira sem acesso', () => {
    const fichas = [
      { id: 'f-carla', funcao: 'consultor', nome: 'Carla', status: 'desligado' },
      { id: 'f-bruna', funcao: 'consultor', nome: 'Bruna', status: 'ativo', convite: { email: 'b@x.com', papel: 'consultant', expiraEm: '2026-12-01T00:00:00.000Z' } },
      { id: 'f-rita', funcao: 'consultor', nome: 'Rita', status: 'ativo', convite: { email: 'r@x.com', papel: 'consultant', expiraEm: '2026-11-01T00:00:00.000Z' } },
    ];
    const por = Object.fromEntries(montarEquipe({ fichas, users: [], professores: [], agora: AGORA }).map((p) => [p.id, p]));
    expect(por['f-carla']).toMatchObject({ desligada: true, acesso: 'desligado' });
    expect(por['f-bruna'].acesso).toBe('convite');
    expect(por['f-rita'].acesso).toBe('sem');
  });

  it('ficha com userId de login que sumiu fica sem acesso, com a função da ficha', () => {
    const fichas = [{ id: 'u-sumiu', userId: 'u-sumiu', funcao: 'consultor', nome: 'Léo', status: 'ativo' }];
    const [leo] = montarEquipe({ fichas, users: [], professores: [], agora: AGORA });
    expect(leo).toMatchObject({ funcao: 'consultor', acesso: 'sem', user: null });
  });

  it('ignora entrada sem id', () => {
    expect(montarEquipe({ fichas: [null, {}], users: [null], professores: [{}], agora: AGORA })).toEqual([]);
  });
});

describe('filtrarEquipe', () => {
  const pessoas = montarEquipe({
    fichas: [{ id: 'p-marina', professorId: 'p-marina', vinculo: 'estagio', status: 'ativo' }],
    users, professores, agora: AGORA,
  });
  it('ativos por padrão, desligados à parte', () => {
    expect(filtrarEquipe(pessoas, {}).some((p) => p.desligada)).toBe(false);
    expect(filtrarEquipe(pessoas, { situacao: 'desligados' }).map((p) => p.id)).toEqual(['p-velho']);
  });
  it('função, vínculo, acesso e busca sem acento', () => {
    expect(filtrarEquipe(pessoas, { funcao: 'professor' }).map((p) => p.id)).toEqual(['u-diego', 'p-marina']);
    expect(filtrarEquipe(pessoas, { vinculo: 'estagio' }).map((p) => p.id)).toEqual(['p-marina']);
    expect(filtrarEquipe(pessoas, { acesso: 'sem' }).map((p) => p.id)).toEqual(['p-marina']);
    expect(filtrarEquipe(pessoas, {}, 'MARÍ').map((p) => p.id)).toEqual(['p-marina']);
  });
  it('os acessos da pílula', () => {
    expect(ACESSOS).toEqual(['com', 'convite', 'sem']);
  });
});
