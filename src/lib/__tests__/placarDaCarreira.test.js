import { describe, it, expect } from 'vitest';
import { estadoTexto, metaTexto, proximaTexto, valorTexto } from '../../views/professores/criterios.js';

describe('textos do placar', () => {
  it('o valor de cada número', () => {
    expect(valorTexto('renovacao', 47)).toBe('47%');
    expect(valorTexto('nps', 9.2)).toBe('9,20');
    expect(valorTexto('conversao', 30)).toBe('30%');
    expect(valorTexto('aderencia', null)).toBeNull();
  });

  it('a meta, e a da conversão contra a academia', () => {
    expect(metaTexto('renovacao', 50)).toBe('50%');
    expect(metaTexto('nps', 9)).toBe('9,00');
    expect(metaTexto('conversao', 3, 27)).toBe('3 pontos acima da academia, 30%');
    expect(metaTexto('conversao', 0, 27)).toBe('acima da academia, 27%');
    expect(metaTexto('conversao', -3, 27)).toBe('até 3 pontos abaixo da academia, 24%');
    expect(metaTexto('conversao', 3, null)).toBe('3 pontos acima da academia');
    expect(metaTexto('renovacao', null)).toBeNull();
  });

  it('o estado e a linha do próximo nível', () => {
    expect(estadoTexto({ estado: 'ok' }, { nome: 'Júnior' })).toBe('Na meta do Júnior');
    expect(estadoTexto({ estado: 'baixo' }, { nome: 'Júnior' })).toBe('Abaixo da meta do Júnior');
    expect(estadoTexto({ estado: 'semMeta' }, { nome: 'Júnior' })).toBe('Sem meta definida.');
    expect(estadoTexto({ estado: 'semMeta' }, null)).toBe('Sem nível: defina a trilha e o nível.');
    expect(estadoTexto({ estado: 'sem' }, { nome: 'Júnior' })).toBeNull();
    expect(proximaTexto({ id: 'renovacao', metaProxima: 55 }, { nome: 'Pleno' })).toBe('Para Pleno: 55%');
    expect(proximaTexto({ id: 'conversao', metaProxima: 3, academia: 27 }, { nome: 'Pleno' })).toBe('Para Pleno: 3 pontos acima da academia, 30%');
    expect(proximaTexto({ id: 'renovacao', metaProxima: null }, { nome: 'Pleno' })).toBeNull();
    expect(proximaTexto({ id: 'renovacao', metaProxima: 55 }, null)).toBeNull();
  });
});
