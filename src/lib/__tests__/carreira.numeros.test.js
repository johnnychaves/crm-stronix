import { describe, it, expect } from 'vitest';
import { AJUSTES, metaBatida, metaValida, NUMEROS, numerosDaBase, VENDAS_EM } from '../carreira/numeros.js';

describe('numerosDaBase', () => {
  it('quatro de professor e quatro de consultor, na ordem da grade', () => {
    expect(numerosDaBase('professor')).toEqual(['renovacao', 'nps', 'conversao', 'aderencia']);
    expect(numerosDaBase('consultor')).toEqual(['consultorConversao', 'vendas', 'consultorRenovacao', 'metaDiaria']);
    expect(numerosDaBase('outra')).toEqual([]);
  });
});

describe('metaValida', () => {
  it('confere o limite de cada número', () => {
    expect(metaValida('renovacao', 0)).toBe(true);
    expect(metaValida('renovacao', 100)).toBe(true);
    expect(metaValida('renovacao', 101)).toBe(false);
    expect(metaValida('nps', 9.5)).toBe(true);
    expect(metaValida('nps', 10.5)).toBe(false);
    expect(metaValida('conversao', -3)).toBe(true);
    expect(metaValida('conversao', -51)).toBe(false);
    expect(metaValida('vendas', 15000)).toBe(true);
    expect(metaValida('renovacao', '45')).toBe(false);
    expect(metaValida('renovacao', NaN)).toBe(false);
    expect(metaValida('desconhecido', 1)).toBe(false);
  });
});

describe('metaBatida', () => {
  it('sem meta ou sem resultado, null', () => {
    expect(metaBatida('renovacao', { valor: 50, meta: null })).toBeNull();
    expect(metaBatida('renovacao', { valor: null, meta: 45 })).toBeNull();
  });

  it('a renovação, a nota, a aderência e a meta diária batem ao chegar na meta', () => {
    expect(metaBatida('renovacao', { valor: 45, meta: 45 })).toBe(true);
    expect(metaBatida('renovacao', { valor: 44, meta: 45 })).toBe(false);
    expect(metaBatida('nps', { valor: 9.33, meta: 9 })).toBe(true);
    expect(metaBatida('nps', { valor: 8.92, meta: 9 })).toBe(false);
  });

  it('a conversão passa da academia mais os pontos; empate não bate', () => {
    expect(metaBatida('conversao', { valor: 53, meta: 0, academia: 45 })).toBe(true);
    expect(metaBatida('conversao', { valor: 45, meta: 0, academia: 45 })).toBe(false);
    expect(metaBatida('conversao', { valor: 43, meta: -3, academia: 45 })).toBe(true);
    expect(metaBatida('consultorConversao', { valor: 31, meta: 3, academia: 27 })).toBe(true);
    expect(metaBatida('conversao', { valor: 53, meta: 0, academia: null })).toBeNull();
  });
});

describe('AJUSTES e VENDAS_EM', () => {
  it('os padrões são os de hoje', () => {
    expect(AJUSTES.janelaDias.padrao).toBe(30);
    expect(AJUSTES.barra.padrao).toBe(2);
    expect(AJUSTES.faixaMax.padrao).toBe(70);
    expect(VENDAS_EM).toEqual(['reais', 'quantidade']);
    expect(NUMEROS.conversao.contraAcademia).toBe(true);
  });
});
