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
    expect(parseValorBRL('1.2.3')).toBeNull();
    expect(parseValorBRL(undefined)).toBeNull();
  });
  it('ponto seguido de três dígitos, sem vírgula, é separador de milhar', () => {
    expect(parseValorBRL('1.240')).toBe(1240);
    expect(parseValorBRL('2.988')).toBe(2988);
    expect(parseValorBRL('12.500')).toBe(12500);
    expect(parseValorBRL('1.234.567')).toBe(1234567);
    expect(parseValorBRL('R$ 2.988')).toBe(2988);
  });
  it('milhar com vírgula decimal continua como antes', () => {
    expect(parseValorBRL('1.240,00')).toBe(1240);
    expect(parseValorBRL('12.500,50')).toBe(12500.5);
    expect(parseValorBRL('R$ 1.240,00')).toBe(1240);
  });
  it('inteiro e vírgula decimal continuam como antes', () => {
    expect(parseValorBRL('249')).toBe(249);
    expect(parseValorBRL('249,90')).toBe(249.9);
  });
  it('ponto com uma ou duas casas continua decimal', () => {
    expect(parseValorBRL('249.9')).toBe(249.9);
    expect(parseValorBRL('1.24')).toBe(1.24);
    // Grupo de milhar não começa com zero: "0.500" é meio real, não quinhentos.
    expect(parseValorBRL('0.500')).toBe(0.5);
  });
});
