// Os textos do editor de Configurações → Plano de carreira (plano
// 2026-11-26-plano-de-carreira-02, tarefa 6).
import { describe, it, expect } from 'vitest';
import { NUMEROS } from '../carreira/numeros.js';
import { trilhasDe } from '../carreira/trilhas.js';
import { com, novaTrilha } from '../carreira/rascunho.js';
import {
  lerNumero, NUMERO_UI, numerosContamTexto, numeroParaTexto, paraQuemTexto, periodoTexto, pessoasTexto, quandoTexto, unidadeDe,
} from '../../views/settings/carreira/carreiraTexto.js';

const [PROFESSOR, ESTAGIARIO, CONSULTOR] = trilhasDe(null);

describe('textos da trilha', () => {
  it('para quem', () => {
    expect(paraQuemTexto(PROFESSOR)).toBe('Para professores formados');
    expect(paraQuemTexto(ESTAGIARIO)).toBe('Para estagiários');
    expect(paraQuemTexto(CONSULTOR)).toBe('Para consultores');
    expect(paraQuemTexto(novaTrilha('professor', [], () => 0))).toBe('Para professores');
  });

  it('quando avalia e o período, no anual e no semestral', () => {
    expect(quandoTexto(PROFESSOR)).toBe('Avaliação em dezembro');
    expect(quandoTexto(ESTAGIARIO)).toBe('Avaliação em junho e dezembro');
    expect(periodoTexto(PROFESSOR)).toBe('Os números contam de 1º de dezembro a 30 de novembro.');
    expect(periodoTexto(com(PROFESSOR, { mes: 3 }))).toBe('Os números contam de 1º de março a 28 ou 29 de fevereiro.');
    expect(periodoTexto(ESTAGIARIO)).toBe('Os números contam de 1º de dezembro a 31 de maio e de 1º de junho a 30 de novembro.');
    expect(periodoTexto(com(ESTAGIARIO, { mes: 1 }))).toBe('Os números contam de 1º de julho a 31 de dezembro e de 1º de janeiro a 30 de junho.');
  });

  it('pessoas e números', () => {
    expect([0, 1, 7].map(pessoasTexto)).toEqual(['ninguém', '1 pessoa', '7 pessoas']);
    expect([0, 1, 4].map(numerosContamTexto)).toEqual(['Nenhum número conta', '1 número conta', '4 números contam']);
  });
});

describe('números da grade', () => {
  it('todo número da lista tem ícone, legenda e regra', () => {
    for (const id of Object.keys(NUMEROS)) {
      expect(NUMERO_UI[id]?.icone, id).toBeTruthy();
      expect(typeof NUMERO_UI[id].legenda({}), id).toBe('string');
      expect(NUMERO_UI[id].regra, id).toBeTruthy();
    }
    expect(Object.keys(NUMERO_UI).sort()).toEqual(Object.keys(NUMEROS).sort());
  });

  it('a legenda segue o ajuste da trilha', () => {
    expect(NUMERO_UI.aderencia.legenda({ barra: 3 })).toBe('semanas com 3 aulas ou mais');
    expect(NUMERO_UI.vendas.legenda({ vendasEm: 'reais' })).toBe('valor fechado, média por mês');
    expect(NUMERO_UI.vendas.legenda({ vendasEm: 'quantidade' })).toBe('vendas fechadas, média por mês');
  });

  it('a unidade dentro do campo; vendas em reais mostram mil e gravam reais', () => {
    expect(unidadeDe('renovacao', {})).toEqual({ depois: '% ou mais' });
    expect(unidadeDe('nps', {})).toEqual({ depois: 'ou mais' });
    expect(unidadeDe('conversao', {})).toEqual({ depois: 'pts' });
    expect(unidadeDe('metaDiaria', {})).toEqual({ depois: '% dos dias' });
    expect(unidadeDe('vendas', { vendasEm: 'reais' })).toEqual({ antes: 'R$', depois: 'mil', escala: 1000 });
    expect(unidadeDe('vendas', { vendasEm: 'quantidade' })).toEqual({ depois: 'por mês' });
  });
});

describe('leitura do número digitado', () => {
  it('vazio é sem valor, vírgula é decimal e o resto não é número', () => {
    expect(lerNumero('')).toBeNull();
    expect(lerNumero('  ')).toBeNull();
    expect(lerNumero('45')).toBe(45);
    expect(lerNumero('9,5')).toBe(9.5);
    expect(lerNumero('-3')).toBe(-3);
    expect(Number.isNaN(lerNumero('9,'))).toBe(false);
    expect(Number.isNaN(lerNumero('abc'))).toBe(true);
  });

  it('o texto do número usa vírgula', () => {
    expect(numeroParaTexto(null)).toBe('');
    expect(numeroParaTexto(Number.NaN)).toBe('');
    expect(numeroParaTexto(9.5)).toBe('9,5');
    expect(numeroParaTexto(12)).toBe('12');
  });
});
