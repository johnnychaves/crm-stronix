// Testes da formatação/parse de moeda BRL. fmtBRL passou a sempre mostrar 2
// casas (padrão de moeda); parseValorBRL lê o que o usuário digita no campo de
// valor (vírgula ou ponto decimal, milhar com ponto, prefixo R$).

import { describe, it, expect } from 'vitest';
import { fmtBRL, parseValorBRL, valorToInput } from '../format.js';

describe('fmtBRL', () => {
  it('mostra sempre 2 casas em valor inteiro', () => {
    expect(fmtBRL(199)).toBe('R$ 199,00');
  });
  it('mostra os centavos quando existem', () => {
    expect(fmtBRL(197.9)).toBe('R$ 197,90');
  });
  it('zero e nulo viram R$ 0,00', () => {
    expect(fmtBRL(0)).toBe('R$ 0,00');
    expect(fmtBRL(null)).toBe('R$ 0,00');
    expect(fmtBRL(undefined)).toBe('R$ 0,00');
  });
  it('usa separador de milhar pt-BR com 2 casas', () => {
    expect(fmtBRL(1234.5)).toBe('R$ 1.234,50');
  });
});

describe('valorToInput', () => {
  it('formata número com vírgula e 2 casas para o campo', () => {
    expect(valorToInput(197.9)).toBe('197,90');
    expect(valorToInput(199)).toBe('199,00');
  });
  it('vazio ou nulo vira string vazia', () => {
    expect(valorToInput(null)).toBe('');
    expect(valorToInput('')).toBe('');
    expect(valorToInput(undefined)).toBe('');
  });
  it('faz round-trip com parseValorBRL', () => {
    expect(parseValorBRL(valorToInput(197.9))).toBe(197.9);
    expect(parseValorBRL(valorToInput(199))).toBe(199);
  });
});

describe('parseValorBRL', () => {
  it('número redondo', () => {
    expect(parseValorBRL('199')).toBe(199);
  });
  it('vírgula como decimal', () => {
    expect(parseValorBRL('197,90')).toBe(197.9);
  });
  it('ponto como decimal quando não há vírgula', () => {
    expect(parseValorBRL('197.90')).toBe(197.9);
  });
  it('milhar com ponto e decimal com vírgula', () => {
    expect(parseValorBRL('1.997,90')).toBe(1997.9);
  });
  it('aceita prefixo R$ e espaços', () => {
    expect(parseValorBRL('R$ 197,90')).toBe(197.9);
  });
  it('já numérico passa direto', () => {
    expect(parseValorBRL(197.9)).toBe(197.9);
  });
  it('vazio ou só espaço vira null', () => {
    expect(parseValorBRL('')).toBeNull();
    expect(parseValorBRL('   ')).toBeNull();
    expect(parseValorBRL(null)).toBeNull();
  });
  it('lixo não numérico vira null', () => {
    expect(parseValorBRL('abc')).toBeNull();
  });
});
