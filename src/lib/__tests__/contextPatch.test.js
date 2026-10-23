import { describe, it, expect } from 'vitest';
import { buildContextPatch, CONTEXT_FIELDS, tagsDiff } from '../contextPatch.js';

const usersList = [
  { id: 'u1', name: 'Júlia Andrade', authUid: 'auth-1' },
  { id: 'u2', name: 'Hosiel Martins', authUid: null }
];
const professores = [{ id: 'p1', nome: 'Marcos Vieira' }];

describe('buildContextPatch', () => {
  it('lista os sete campos do contexto', () => {
    expect([...CONTEXT_FIELDS]).toEqual(['dor', 'modalidade', 'source', 'consultantId', 'professorId', 'tags', 'observation']);
  });

  it('dor e modalidade gravam o nome, ou null quando limpa', () => {
    expect(buildContextPatch('dor', 'Emagrecimento')).toEqual({ dor: 'Emagrecimento' });
    expect(buildContextPatch('dor', null)).toEqual({ dor: null });
    expect(buildContextPatch('modalidade', '')).toEqual({ modalidade: null });
    expect(buildContextPatch('modalidade', '   ')).toEqual({ modalidade: null });
  });

  it('origem grava o texto, vazio quando limpa (como o cadastro completo)', () => {
    expect(buildContextPatch('source', 'Instagram')).toEqual({ source: 'Instagram' });
    expect(buildContextPatch('source', null)).toEqual({ source: '' });
    expect(buildContextPatch('source', '  ')).toEqual({ source: '' });
  });

  it('o nome do catálogo vai como está, com o espaço do fim, para casar com o catálogo', () => {
    // Há catálogo gravado com espaço no fim. A tela de Todos os leads e as
    // Configurações comparam o nome exato (l.source === item.name).
    expect(buildContextPatch('source', 'Site ')).toEqual({ source: 'Site ' });
    expect(buildContextPatch('dor', 'Saúde ')).toEqual({ dor: 'Saúde ' });
    expect(buildContextPatch('modalidade', 'Pilates ')).toEqual({ modalidade: 'Pilates ' });
  });

  it('professor grava o id e o nome do catálogo, ou os dois nulos', () => {
    expect(buildContextPatch('professorId', 'p1', { professores })).toEqual({ professorId: 'p1', professorName: 'Marcos Vieira' });
    expect(buildContextPatch('professorId', null, { professores })).toEqual({ professorId: null, professorName: null });
  });

  it('observação grava o texto aparado, e vazio quando limpa', () => {
    expect(buildContextPatch('observation', '  Casamento em dezembro.  ')).toEqual({ observation: 'Casamento em dezembro.' });
    expect(buildContextPatch('observation', '')).toEqual({ observation: '' });
  });

  it('etiquetas gravam a lista sem vazio nem repetido, na ordem, com o nome como veio', () => {
    expect(buildContextPatch('tags', ['vip', 'vip', '', '  ', 'noite', 'Aluna '])).toEqual({ tags: ['vip', 'noite', 'Aluna '] });
    expect(buildContextPatch('tags', null)).toEqual({ tags: [] });
  });

  it('tagsDiff diz o que entrou e o que saiu desde a abertura', () => {
    expect(tagsDiff(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] });
    expect(tagsDiff(['a'], ['a'])).toEqual({ added: [], removed: [] });
    expect(tagsDiff(null, ['a', 'a'])).toEqual({ added: ['a'], removed: [] });
  });

  it('consultor grava os três campos juntos, com o authUid do cadastro', () => {
    expect(buildContextPatch('consultantId', 'u1', { usersList })).toEqual({
      consultantId: 'u1', consultantName: 'Júlia Andrade', consultantAuthUid: 'auth-1'
    });
    expect(buildContextPatch('consultantId', 'u2', { usersList })).toEqual({
      consultantId: 'u2', consultantName: 'Hosiel Martins', consultantAuthUid: null
    });
  });

  it('consultor que não está na equipe não grava nada', () => {
    expect(buildContextPatch('consultantId', 'zzz', { usersList })).toBeNull();
    expect(buildContextPatch('consultantId', null, { usersList })).toBeNull();
  });

  it('campo desconhecido não grava nada', () => {
    expect(buildContextPatch('cpf', '123')).toBeNull();
    expect(buildContextPatch('name', 'Outro')).toBeNull();
  });
});
