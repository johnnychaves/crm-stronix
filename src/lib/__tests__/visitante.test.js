// src/lib/__tests__/visitante.test.js
import { describe, it, expect } from 'vitest';
import {
  normalizeFreepassTypes, freepassTypeProblem, saveFreepassType, freepassQuantityText
} from '../visitante.js';

const tipo = (over = {}) => ({ id: 't1', name: 'Pilates 2 aulas', modalidadeId: 'm1', kind: 'aulas', quantity: 2, padrao: false, ativo: true, ...over });

describe('normalizeFreepassTypes', () => {
  it('devolve lista vazia para o que não é lista', () => {
    expect(normalizeFreepassTypes(undefined)).toEqual([]);
    expect(normalizeFreepassTypes({})).toEqual([]);
  });
  it('descarta tipo sem id, nome, modalidade, tipo de contagem ou quantidade válida', () => {
    const out = normalizeFreepassTypes([
      tipo(), tipo({ id: '' }), tipo({ id: 'x', name: '  ' }), tipo({ id: 'y', modalidadeId: '' }),
      tipo({ id: 'z', kind: 'semanas' }), tipo({ id: 'w', quantity: 0 }), tipo({ id: 'v', quantity: 100 })
    ]);
    expect(out.map(t => t.id)).toEqual(['t1']);
  });
  it('apara o nome, arredonda a quantidade e lê ativo ausente como ativo', () => {
    const [t] = normalizeFreepassTypes([{ id: 'a', name: ' Muscu 7 ', modalidadeId: 'm', kind: 'dias', quantity: '7.9' }]);
    expect(t).toEqual({ id: 'a', name: 'Muscu 7', modalidadeId: 'm', kind: 'dias', quantity: 7, padrao: false, ativo: true });
  });
  it('deixa um padrão só por modalidade, o primeiro ativo', () => {
    const out = normalizeFreepassTypes([
      tipo({ id: 'a', padrao: true, ativo: false }), tipo({ id: 'b', padrao: true }), tipo({ id: 'c', padrao: true }),
      tipo({ id: 'd', modalidadeId: 'm2', padrao: true })
    ]);
    expect(out.filter(t => t.padrao).map(t => t.id)).toEqual(['b', 'd']);
  });
});

describe('freepassTypeProblem', () => {
  const types = [tipo()];
  it('aceita um tipo completo', () => {
    expect(freepassTypeProblem(tipo({ id: 't2', name: 'Pilates 1 aula', quantity: 1 }), types)).toBeNull();
  });
  it('pede nome, modalidade, contagem e quantidade, nessa ordem', () => {
    expect(freepassTypeProblem(tipo({ id: 'n', name: '' }), types).field).toBe('name');
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'X', modalidadeId: '' }), types).field).toBe('modalidadeId');
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'X', kind: '' }), types).field).toBe('kind');
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'X', quantity: 0 }), types).field).toBe('quantity');
  });
  it('recusa nome repetido sem contar maiúscula, mas aceita o próprio tipo', () => {
    expect(freepassTypeProblem(tipo({ id: 'n', name: 'pilates 2 AULAS' }), types).message).toBe('Já existe um freepass com esse nome.');
    expect(freepassTypeProblem(tipo(), types)).toBeNull();
  });
});

describe('saveFreepassType', () => {
  it('acrescenta o tipo novo e troca o que já existe', () => {
    const a = saveFreepassType([tipo()], tipo({ id: 't2', name: 'Outro' }));
    expect(a.map(t => t.id)).toEqual(['t1', 't2']);
    const b = saveFreepassType(a, tipo({ name: 'Pilates 3 aulas', quantity: 3 }));
    expect(b[0].quantity).toBe(3);
    expect(b).toHaveLength(2);
  });
  it('o padrão novo tira o padrão dos outros da mesma modalidade', () => {
    const lista = [tipo({ padrao: true }), tipo({ id: 'm2', modalidadeId: 'm2', padrao: true })];
    const out = saveFreepassType(lista, tipo({ id: 't9', name: 'Novo', padrao: true }));
    expect(out.find(t => t.id === 't1').padrao).toBe(false);
    expect(out.find(t => t.id === 'm2').padrao).toBe(true);
    expect(out.find(t => t.id === 't9').padrao).toBe(true);
  });
});

describe('freepassQuantityText', () => {
  it('escreve no singular e no plural', () => {
    expect(freepassQuantityText({ kind: 'dias', quantity: 1 })).toBe('1 dia');
    expect(freepassQuantityText({ kind: 'dias', quantity: 7 })).toBe('7 dias');
    expect(freepassQuantityText({ kind: 'aulas', quantity: 1 })).toBe('1 aula');
    expect(freepassQuantityText({ kind: 'aulas', quantity: 2 })).toBe('2 aulas');
  });
});
